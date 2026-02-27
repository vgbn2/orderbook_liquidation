import type { WebSocket } from 'ws';
import { logger } from '../logger.js';
import type { WSTopic } from '../adapters/types.js';

// ══════════════════════════════════════════════════════════════
//  Client Hub — manages frontend WebSocket connections
//  Handles subscriptions, broadcasting, and backpressure.
// ══════════════════════════════════════════════════════════════

interface ClientConnection {
    id: string;
    ws: WebSocket;
    subscriptions: Set<WSTopic>;
    bufferedAmount: number;
    lastActivity: number;
}

const MAX_BUFFER = 64 * 1024; // 64KB — drop messages if client can't keep up

export class ClientHub {
    private clients = new Map<string, ClientConnection>();
    private topicSubscribers = new Map<WSTopic, Set<string>>();
    private clientIdCounter = 0;

    /**
     * Register a new frontend client WebSocket.
     */
    addClient(ws: WebSocket): string {
        const id = `client_${++this.clientIdCounter}_${Date.now()}`;

        const client: ClientConnection = {
            id,
            ws,
            subscriptions: new Set(),
            bufferedAmount: 0,
            lastActivity: Date.now(),
        };

        this.clients.set(id, client);

        ws.on('message', (raw) => {
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

        logger.info({ clientId: id }, 'Client connected');
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

        for (const topic of client.subscriptions) {
            this.topicSubscribers.get(topic)?.delete(clientId);
        }

        this.clients.delete(clientId);
        logger.info({ clientId }, 'Client disconnected');
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
