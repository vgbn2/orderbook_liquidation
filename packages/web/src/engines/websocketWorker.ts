export function createWorker() {
    return new Worker(new URL('./data_processor.worker.ts', import.meta.url), {
        type: 'module'
    });
}
