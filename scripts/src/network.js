    // Network Client (Abstracts GM_xmlhttpRequest for potential extension migration)
    class NetworkClient {
        async request(url, options = {}) {
            return new Promise((resolve, reject) => {
                const method = options.method || 'GET';
                const headers = options.headers || {};
                const data = options.data || null;
                const timeout = options.timeout || 30000;
                const signal = options.signal;

                if (signal && signal.aborted) {
                    return reject(new Error('Aborted'));
                }

                const req = GM_xmlhttpRequest({
                    method: method,
                    url: url,
                    headers: headers,
                    data: data,
                    timeout: timeout,
                    onload: (response) => {
                        resolve({
                            status: response.status,
                            statusText: response.statusText,
                            responseText: response.responseText,
                            responseHeaders: response.responseHeaders
                        });
                    },
                    onerror: (err) => reject(new Error('Network Error')),
                    ontimeout: () => reject(new Error('Timeout'))
                });

                if (signal) {
                    signal.addEventListener('abort', () => {
                        if (req.abort) req.abort();
                        reject(new Error('Aborted'));
                    });
                }
            });
        }
    }
