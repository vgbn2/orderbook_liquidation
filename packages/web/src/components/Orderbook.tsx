import { useMarketStore } from '../stores/marketStore';

export function Orderbook() {
    const { orderbook } = useMarketStore();

    if (!orderbook) {
        return (
            <div className="panel">
                <div className="panel-header">
                    <span className="panel-title">ORDERBOOK</span>
                    <span className="panel-badge">WAITING</span>
                </div>
                <p className="ob-waiting">Waiting for data...</p>
            </div>
        );
    }

    const { bids, asks, walls } = orderbook;

    // Filter for PASSIVE (resting) big limit orders
    const allQtys = [...bids, ...asks].map((l: { qty: number }) => l.qty).sort((a, b) => a - b);
    const medianQty = allQtys.length > 0 ? allQtys[Math.floor(allQtys.length * 0.5)] : 0;
    const minQty = medianQty * 1.5;

    const filteredBids = bids.filter((l: { qty: number }) => l.qty >= minQty).slice(0, 10);
    const filteredAsks = asks.filter((l: { qty: number }) => l.qty >= minQty).slice(0, 10);

    const maxQty = Math.max(
        ...filteredBids.map((l: { qty: number }) => l.qty),
        ...filteredAsks.map((l: { qty: number }) => l.qty),
        1,
    );

    const spread = asks.length > 0 && bids.length > 0
        ? (asks[0].price - bids[0].price).toFixed(1)
        : '—';

    const wallPrices = new Set([
        ...(walls?.bid_walls ?? []).map((w: { price: number }) => w.price),
        ...(walls?.ask_walls ?? []).map((w: { price: number }) => w.price),
    ]);

    const formatQty = (q: number) => q >= 1 ? q.toFixed(2) : q.toFixed(3);

    return (
        <div className="panel ob-panel">
            <div className="panel-header">
                <span className="panel-title">PASSIVE ORDERBOOK</span>
                <span className="panel-badge">{spread} SPR</span>
            </div>

            <div className="ob-container">
                {/* Asks (Resting) */}
                <div className="ob-side ob-asks">
                    {[...filteredAsks].reverse().map((level: { price: number; qty: number }) => (
                        <div
                            key={level.price}
                            className={`ob-row ob-ask ${wallPrices.has(level.price) ? 'ob-wall' : ''}`}
                        >
                            <div
                                className="ob-depth-bar ob-depth-ask"
                                style={{ width: `${(level.qty / maxQty) * 100}%` }}
                            />
                            <span className="ob-price">{level.price.toFixed(1)}</span>
                            <span className="ob-qty">{formatQty(level.qty)}</span>
                        </div>
                    ))}
                </div>

                <div className="ob-mid-section">
                    <div className="ob-spread-line">
                        <span>SPREAD {spread}</span>
                    </div>
                </div>

                {/* Bids (Resting) */}
                <div className="ob-side ob-bids">
                    {filteredBids.map((level: { price: number; qty: number }) => (
                        <div
                            key={level.price}
                            className={`ob-row ob-bid ${wallPrices.has(level.price) ? 'ob-wall' : ''}`}
                        >
                            <div
                                className="ob-depth-bar ob-depth-bid"
                                style={{ width: `${(level.qty / maxQty) * 100}%` }}
                            />
                            <span className="ob-price">{level.price.toFixed(1)}</span>
                            <span className="ob-qty">{formatQty(level.qty)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
