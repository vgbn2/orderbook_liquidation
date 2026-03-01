import type { WebSocket } from 'ws';
import { logger } from '../logger.js';
import type { WSTopic } from '../adapters/types.js';
import type { FastifyRequest } from 'fastify';

// ══════════════════════════════════════════════════════════════
//  Client Hub — manages frontend WebSocket connections
//  Handles subscriptions, broadcasting, and backpressure.
// ══════════════════════════════════════════════════════════════

interface ClientConnection {
    id: string;
    ip: string;
    ws: WebSocket;
    subscriptions: Set<WSTopic>;
    bufferedAmount: number;
    lastActivity: number;
    isAlive: boolean; // For ping/pong heartbeat
}

// Security Configuration
const MAX_BUFFER = 1024 * 1024; // 1MB — drop messages if client can't keep up
const MAX_CONNECTIONS_PER_IP = 5;
const MAX_MESSAGES_PER_SECOND = 20;
const HEARTBEAT_INTERVAL_MS = 30000;

export class ClientHub {
    private clients = new Map<string, ClientConnection>();
    private topicSubscribers = new Map<WSTopic, Set<string>>();
    private clientIdCounter = 0;

    // IP tracking for rate limiting
    private ipConnections = new Map<string, number>();
    private ipMessageCounts = new Map<string, { count: number; windowStart: number }>();
    private heartbeatInterval: NodeJS.Timeout;

    constructor() {
        // Start ping/pong heartbeat interval to kill zombie TCP connections
        this.heartbeatInterval = setInterval(() => {
            for (const [id, client] of this.clients.entries()) {
                if (!client.isAlive) {
                    logger.warn({ clientId: id, ip: client.ip }, 'Terminating unresponsive client (zombie)');
                    client.ws.terminate(); // Violently kill dead connection
                    this.removeClient(id);
                    continue;
                }
                client.isAlive = false; // Require pong before next interval
                client.ws.ping();
            }
        }, HEARTBEAT_INTERVAL_MS);
    }

    /**
     * Terminate the hub (cleans up intervals)
     */
    destroy() {
        clearInterval(this.heartbeatInterval);
        for (const client of this.clients.values()) {
            client.ws.terminate();
        }
        this.clients.clear();
    }

    /**
     * Get IP address from FastifyRequest
     */
    private getIp(req: FastifyRequest): string {
        const xForwardedFor = req.headers['x-forwarded-for'];
        if (typeof xForwardedFor === 'string') return xForwardedFor.split(',')[0].trim();
        if (Array.isArray(xForwardedFor)) return xForwardedFor[0].trim();
        return req.ip || 'unknown';
    }

    /**
     * Register a new frontend client WebSocket.
     */
    addClient(ws: WebSocket, req: FastifyRequest): string | null {
        const ip = this.getIp(req);

        // Security: IP Connection Limiting
        const currentConns = this.ipConnections.get(ip) || 0;
        if (currentConns >= MAX_CONNECTIONS_PER_IP) {
            logger.warn({ ip, limit: MAX_CONNECTIONS_PER_IP }, 'Rejected connection: IP limit reached');
            ws.close(1008, 'Max connections per IP reached');
            return null;
        }
        this.ipConnections.set(ip, currentConns + 1);

        const id = `client_${++this.clientIdCounter}_${Date.now()}`;

        const client: ClientConnection = {
            id,
            ip,
            ws,
            subscriptions: new Set(),
            bufferedAmount: 0,
            lastActivity: Date.now(),
            isAlive: true, // Start alive
        };

        this.clients.set(id, client);

        ws.on('pong', () => {
            client.isAlive = true;
        });

        ws.on('message', (raw) => {
            // Security: Message Rate Limiting
            const now = Date.now();
            let tracker = this.ipMessageCounts.get(ip);

            if (!tracker || now - tracker.windowStart > 1000) {
                tracker = { count: 0, windowStart: now };
                this.ipMessageCounts.set(ip, tracker);
            }

            tracker.count++;
            if (tracker.count > MAX_MESSAGES_PER_SECOND) {
                logger.warn({ clientId: id, ip, count: tracker.count }, 'Terminating client: Rate limit exceeded');
                ws.terminate();
                this.removeClient(id);
                return;
            }

            try {
                const msg = JSON.parse(raw.toString());
                this._handleClientMessage(id, msg);
            } catch {
                // Ignore malformed messages
            }
        });

        ws.on('close', () => {
            this.removeClient(id);
        });

        ws.on('error', () => {
            this.removeClient(id);
        });

        logger.info({ clientId: id, ip }, 'Client connected');
        return id;
    }

    /**
     * Handle subscription messages from clients.
     * Expected format: { action: "subscribe" | "unsubscribe", topics: WSTopic[] }
     */
    private _handleClientMessage(clientId: string, msg: any): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.lastActivity = Date.now();

        if (msg.action === 'subscribe' && Array.isArray(msg.topics)) {
            for (const topic of msg.topics as WSTopic[]) {
                client.subscriptions.add(topic);
                if (!this.topicSubscribers.has(topic)) {
                    this.topicSubscribers.set(topic, new Set());
                }
                this.topicSubscribers.get(topic)!.add(clientId);
            }
            logger.debug({ clientId, topics: msg.topics }, 'Client subscribed');
        }

        if (msg.action === 'unsubscribe' && Array.isArray(msg.topics)) {
            for (const topic of msg.topics as WSTopic[]) {
                client.subscriptions.delete(topic);
                this.topicSubscribers.get(topic)?.delete(clientId);
            }
        }
    }

    /**
     * Remove a client and clean up all its subscriptions.
     */
    removeClient(clientId: string): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Cleanup IP tracking
        const currentConns = this.ipConnections.get(client.ip) || 0;
        if (currentConns > 1) {
            this.ipConnections.set(client.ip, currentConns - 1);
        } else {
            this.ipConnections.delete(client.ip);
            this.ipMessageCounts.delete(client.ip);
        }

        for (const topic of client.subscriptions) {
            this.topicSubscribers.get(topic)?.delete(clientId);
        }

        this.clients.delete(clientId);
        logger.info({ clientId, ip: client.ip }, 'Client disconnected');
    }

    /**
     * Broadcast a message to all clients subscribed to a topic.
     * Implements backpressure: drops messages if the client socket
     * buffer exceeds MAX_BUFFER (prevents memory leaks).
     */
    broadcast(topic: WSTopic, data: unknown): void {
        const subscribers = this.topicSubscribers.get(topic);
        if (!subscribers || subscribers.size === 0) return;

        const payload = JSON.stringify({ topic, data, ts: Date.now() });

        let sent = 0;
        let dropped = 0;

        for (const clientId of subscribers) {
            const client = this.clients.get(clientId);
            if (!client || client.ws.readyState !== 1) continue;

            // Backpressure check
            if (client.ws.bufferedAmount > MAX_BUFFER) {
                dropped++;
                continue;
            }

            client.ws.send(payload);
            sent++;
        }

        if (dropped > 0) {
            logger.warn({ topic, sent, dropped }, 'Backpressure — dropped messages');
        }
    }

    /**
     * Send a direct message to a specific client (e.g., initial snapshot).
     */
    sendToClient(clientId: string, topic: WSTopic, data: unknown): void {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== 1) return;

        client.ws.send(JSON.stringify({ topic, data, ts: Date.now() }));
    }

    /**
     * Get stats for health/monitoring.
     */
    getStats(): { clients: number; subscriptions: Record<string, number> } {
        const subscriptions: Record<string, number> = {};
        for (const [topic, subs] of this.topicSubscribers) {
            subscriptions[topic] = subs.size;
        }
        return { clients: this.clients.size, subscriptions };
    }
}

export const clientHub = new ClientHub();
