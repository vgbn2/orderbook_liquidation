let cumulativeDelta = 0;

self.onmessage = (event) => {
    const { type, payload } = event.data;

    switch (type) {
        case 'INIT':
            cumulativeDelta = 0;
            break;
        case 'RESET_CVD':
            cumulativeDelta = payload || 0;
            break;
        case 'WS_MESSAGE':
            try {
                const msg = JSON.parse(payload);

                // Inline CVD calculation for high-frequency candle updates
                if (msg.topic && msg.topic.startsWith('candles.')) {
                    const c = msg.data;
                    const delta = c.close >= c.open ? c.volume : -c.volume;

                    // If it's a new candle (not an update), we add, 
                    // if it's an update, we'd need the previous candle's delta to adjust.
                    // To keep it simple and stateless for updates, we'll let the worker 
                    // just tag the message. For high-frequency, the worker is the source of truth.

                    // Actually, to be accurate with updates, we'd need to know 
                    // the previous state of THIS specific candle.

                    // Optimization: Only compute cumulative on "bake-in" (isUpdate: false)
                    // and provide a raw delta for updates.
                    if (c.isUpdate === false) {
                        cumulativeDelta += delta;
                    }

                    msg._cvd = cumulativeDelta + (c.isUpdate ? delta : 0);
                }

                self.postMessage({
                    type: 'PARSED_MESSAGE',
                    payload: msg
                });
            } catch (e) {
                // Ignore
            }
            break;
    }
};
