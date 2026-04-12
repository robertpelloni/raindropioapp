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


// Basic background scraper
async function bgScrapeUrl(url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0)' } });
        if (!res.ok) return { error: res.status };
        const html = await res.text();

        // Very basic extraction for background context (strip scripts, tags, get body text)
        let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                       .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                       .replace(/<[^>]+>/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();

        // Limit to 10k chars to save tokens
        return { text: text.substring(0, 10000) };
    } catch(e) {
        return { error: 'network_error' };
    }
}

// Background LLM Call
async function bgCallLLM(config, promptText) {
    const provider = config.provider || 'openai';

    if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.openaiKey}`
            },
            body: JSON.stringify({
                model: config.openaiModel || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are an expert librarian.' },
                    { role: 'user', content: promptText }
                ],
                response_format: { type: "json_object" }
            })
        });
        if (!res.ok) throw new Error("OpenAI API Error");
        const data = await res.json();
        return JSON.parse(data.choices[0].message.content);
    }
    else if (provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.anthropicKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: config.anthropicModel || 'claude-3-haiku-20240307',
                max_tokens: 1024,
                system: 'You are an expert librarian. Output ONLY valid JSON.',
                messages: [{ role: 'user', content: promptText }]
            })
        });
        if (!res.ok) throw new Error("Anthropic API Error");
        const data = await res.json();
        // Simple regex to extract JSON
        const match = data.content[0].text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        return JSON.parse(match ? match[0] : data.content[0].text);
    }
    throw new Error(`Background LLM not fully supported for provider: ${provider}`);
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


            // Fallback to LLM if enabled and no deterministic rules matched
            if (tagsToAdd.length === 0 && !targetFolder && config.smartTriggersLLM) {
                console.log(`[RAS Background] No rules matched for "${bm.title}". Calling LLM...`);
                try {
                    const scraped = await bgScrapeUrl(bm.link);
                    const contentSnippet = scraped.text || "No content extracted.";

                    const prompt = `
${config.taggingPrompt}
Title: ${bm.title}
Domain: ${new URL(bm.link).hostname}
Content: ${contentSnippet.substring(0, 2000)}

Output ONLY a JSON object with a "tags" array containing strings.`;

                    const llmResult = await bgCallLLM(config, prompt);
                    if (llmResult && Array.isArray(llmResult.tags)) {
                        tagsToAdd = llmResult.tags.slice(0, config.maxTags || 3);
                    }
                } catch(e) {
                    console.log(`[RAS Background] LLM fallback failed for "${bm.title}":`, e);
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
                message: `The Sentinel automatically processed ${sortedCount} items from your Unsorted folder.`
            });
        }

    } catch(e) {
        console.error("[RAS Background] Polling error:", e);
    }
}
