/**
 * Web Extension NetworkClient
 */
export class NetworkClient {
    constructor() {
        this.activeRequests = new Map();
    }

    async fetch(options, signal = null) {
        const requestId = Date.now().toString() + Math.random().toString();

        return new Promise((resolve, reject) => {
            const handleAbort = () => {
                this.activeRequests.delete(requestId);
                reject(new Error('Aborted'));
            };

            if (signal) {
                if (signal.aborted) return handleAbort();
                signal.addEventListener('abort', handleAbort);
            }

            this.activeRequests.set(requestId, true);

            chrome.runtime.sendMessage({
                action: 'fetch_api',
                payload: {
                    url: options.url,
                    options: {
                        method: options.method || 'GET',
                        headers: options.headers || {},
                        body: options.data || null,
                    }
                }
            }, (response) => {
                if (signal) signal.removeEventListener('abort', handleAbort);
                if (!this.activeRequests.has(requestId)) return;
                this.activeRequests.delete(requestId);

                if (!response) {
                    reject(new Error('Background worker did not respond.'));
                    return;
                }

                if (!response.success) {
                    reject(new Error(`Network Request Failed: ${response.error}`));
                    return;
                }

                const result = {
                    status: response.status,
                    responseText: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
                    responseHeaders: Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')
                };

                resolve(result);
            });
        });
    }
}
