// Background Service Worker (Manifest V3)
// Responsible for bypassing CORS for the content script

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetch') {
        const { url, options } = request.payload;

        fetch(url, options)
            .then(async (res) => {
                const text = await res.text();
                // Send back serializable data
                sendResponse({
                    ok: res.ok,
                    status: res.status,
                    statusText: res.statusText,
                    headers: Object.fromEntries(res.headers.entries()),
                    text: text
                });
            })
            .catch(error => {
                console.error("Background Fetch Error:", error);
                sendResponse({ error: error.message });
            });

        return true; // Keep the message channel open for async response
    }
});
