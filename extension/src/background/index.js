// Background Service Worker (Manifest V3)
// Responsible for bypassing CORS for the content script AND running Smart Triggers

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Legacy CORS bypass for content scripts
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

    // Handle UI updates to Smart Triggers
    if (request.action === 'update_alarms') {
        const { enabled, interval } = request.payload;
        chrome.alarms.clear('smartTriggerPolling', () => {
            if (enabled) {
                console.log(`[RAS Background] Scheduling Smart Trigger polling every ${interval} minutes.`);
                chrome.alarms.create('smartTriggerPolling', { periodInMinutes: interval });
            } else {
                console.log(`[RAS Background] Smart Trigger polling disabled.`);
            }
        });
        sendResponse({ success: true });
        return true;
    }
});

// Listener for Alarms
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'smartTriggerPolling') {
        console.log(`[RAS Background] Alarm triggered. Polling Raindrop.io Unsorted...`);
        executeSmartTriggers();
    }
});

// Function to fetch state manually from storage in background context
async function getStoredConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(null, (result) => {
            resolve(result || {});
        });
    });
}

// Background Raindrop API calls
async function fetchRaindrop(endpoint, token, options = {}) {
    const url = `https://api.raindrop.io/rest/v1/${endpoint}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    if (res.status === 401) {
        throw new Error("Invalid Token");
    }

    if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
    }

    return await res.json();
}

// The Librarian: Autonomous background sorting
async function executeSmartTriggers() {
    const config = await getStoredConfig();

    if (!config.raindropToken || !config.smartTriggers) {
        console.log("[RAS Background] Polling skipped. No token or disabled.");
        return;
    }

    try {
        // 1. Fetch Unsorted (-1) bookmarks
        const data = await fetchRaindrop('raindrops/-1?perpage=50', config.raindropToken);
        if (!data || !data.items || data.items.length === 0) {
            console.log("[RAS Background] Unsorted is empty. Nothing to do.");
            return;
        }

        console.log(`[RAS Background] Found ${data.items.length} unsorted items. Evaluating macros...`);

        // 2. Parse Macros & Rules from config
        const macros = JSON.parse(config.batch_macros || '[]');
        const rules = JSON.parse(config.smart_rules || '[]');

        if (macros.length === 0 && rules.length === 0) {
            console.log("[RAS Background] No macros or rules defined to run autonomously.");
            return;
        }

        // Cache collections for name matching
        const collectionsData = await fetchRaindrop('collections', config.raindropToken);
        const collections = collectionsData.items || [];

        let sortedCount = 0;

        // 3. Process each item
        for (const bm of data.items) {
            let tagsToAdd = [];
            let targetFolder = null;

            // Evaluate Rules (Direct Matches)
            try {
                const domain = new URL(bm.link).hostname;
                const domainRule = rules.find(r => r.type === 'move_bookmark' && r.source === domain);
                if (domainRule) {
                    targetFolder = domainRule.target;
                }
            } catch(e) {}

            // Evaluate Macros (Recipes)
            for (const macro of macros) {
                let matches = false;
                if (macro.condition.type === 'domain_equals') {
                    try {
                        const domain = new URL(bm.link).hostname;
                        if (domain === macro.condition.value) matches = true;
                    } catch(e) {}
                } else if (macro.condition.type === 'has_tag') {
                    if (bm.tags && bm.tags.includes(macro.condition.value)) matches = true;
                } else if (macro.condition.type === 'title_contains') {
                    if (bm.title && bm.title.toLowerCase().includes(macro.condition.value.toLowerCase())) matches = true;
                }

                if (matches) {
                    if (macro.action.type === 'add_tag') tagsToAdd.push(macro.action.value);
                    if (macro.action.type === 'move_to_folder' && !targetFolder) targetFolder = macro.action.value;
                }
            }

            // Apply Updates
            let updates = {};
            if (tagsToAdd.length > 0) {
                const newTags = [...new Set([...bm.tags, ...tagsToAdd])];
                if (newTags.length !== bm.tags.length) {
                    updates.tags = newTags;
                }
            }

            if (targetFolder) {
                const targetCol = collections.find(c => c.title.toLowerCase() === targetFolder.toLowerCase());
                if (targetCol && targetCol._id !== bm.collectionId) {
                    updates.collectionId = targetCol._id;
                }
            }

            if (Object.keys(updates).length > 0) {
                console.log(`[RAS Background] Autonomous update for "${bm.title}":`, updates);
                await fetchRaindrop(`raindrop/${bm._id}`, config.raindropToken, {
                    method: 'PUT',
                    body: JSON.stringify(updates)
                });
                sortedCount++;
            }
        }

        // Notify user if things were sorted
        if (sortedCount > 0) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon.png', // Assuming we have or will have an icon
                title: 'Raindrop AI Sorter',
                message: `The Sentinel automatically sorted ${sortedCount} items from your Unsorted folder based on your Macros & Rules.`
            });
        }

    } catch(e) {
        console.error("[RAS Background] Polling error:", e);
    }
}
