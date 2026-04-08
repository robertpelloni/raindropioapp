chrome.runtime.onInstalled.addListener(() => {
    console.log('[Raindrop AI Sorter] Extension installed/updated.');
});

// Listener for cross-origin fetch requests from Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetch_api') {
        const { url, options } = request.payload;

        fetch(url, options)
            .then(async res => {
                const contentType = res.headers.get('content-type');
                let data;
                if (contentType && contentType.includes('application/json')) {
                    data = await res.json();
                } else {
                    data = await res.text();
                }

                sendResponse({
                    success: true,
                    status: res.status,
                    headers: Object.fromEntries(res.headers.entries()),
                    data: data
                });
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message
                });
            });

        return true; // Indicates asynchronous response
    }
});
