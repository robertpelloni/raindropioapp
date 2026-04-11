// NetworkClient adapter for Web Extension
// Relays fetch requests to the background script to bypass CORS

export class NetworkClient {
    async fetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'fetch', payload: { url, options } },
                (response) => {
                    if (chrome.runtime.lastError) {
                        return reject(new Error(chrome.runtime.lastError.message));
                    }
                    if (response.error) {
                        return reject(new Error(response.error));
                    }

                    // Reconstruct a Response-like object for the legacy userscript code
                    const resLike = {
                        ok: response.ok,
                        status: response.status,
                        statusText: response.statusText,
                        headers: {
                            get: (key) => response.headers[key.toLowerCase()] || null
                        },
                        text: async () => response.text,
                        json: async () => JSON.parse(response.text)
                    };

                    resolve(resLike);
                }
            );
        });
    }
}
