// ==UserScript==
// @name         Raindrop.io AI Sorter
// @namespace    http://tampermonkey.net/
// @version      1.0.26
// @description  Scrapes Raindrop.io bookmarks, tags them using AI, and organizes them into collections.
// @author       You
// @match        https://app.raindrop.io/*
// @updateURL    https://raw.githubusercontent.com/robertpelloni/raindropioapp/master/raindrop_ai_sorter.user.js
// @downloadURL  https://raw.githubusercontent.com/robertpelloni/raindropioapp/master/raindrop_ai_sorter.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';


    // Application State
    const STATE = {
        isRunning: false,
        stopRequested: false,
        log: [],
        stats: {
            processed: 0,
            updated: 0,
            broken: 0,
            moved: 0,
            errors: 0,
            deleted: 0,
            tokens: { input: 0, output: 0 }
        },
        actionLog: [],
        config: {
            openaiKey: GM_getValue('openaiKey', ''),
            openaiModel: GM_getValue('openaiModel', 'gpt-4o-mini'),
            anthropicKey: GM_getValue('anthropicKey', ''),
            anthropicModel: GM_getValue('anthropicModel', 'claude-3-haiku-20240307'),
            raindropToken: GM_getValue('raindropToken', ''),
            provider: GM_getValue('provider', 'openai'), // 'openai', 'anthropic', 'groq', 'deepseek', or 'custom'
            groqKey: GM_getValue('groqKey', ''),
            groqModel: GM_getValue('groqModel', 'llama3-70b-8192'),
            deepseekKey: GM_getValue('deepseekKey', ''),
            deepseekModel: GM_getValue('deepseekModel', 'deepseek-chat'),
            customBaseUrl: GM_getValue('customBaseUrl', 'http://localhost:11434/v1'),
            customModel: GM_getValue('customModel', 'llama3'),
            concurrency: GM_getValue('concurrency', 20),
            maxTags: GM_getValue('maxTags', 5),
            targetCollectionId: 0, // 0 is 'All bookmarks'
            skipTagged: GM_getValue('skipTagged', false),
            dryRun: GM_getValue('dryRun', false),

            // Refined Default Prompts
            taggingPrompt: GM_getValue('taggingPrompt', `
                Analyze the following content (text and/or image) to understand its core topic, context, and utility.

                Task 1: Generate {{MAX_TAGS}} tags.
                - Tags should be hierarchical where possible (e.g., "Dev", "Dev > Web").
                - Tags should be broad enough for grouping but specific enough to be useful.
                - If the content is a tool, tag its purpose (e.g., "Productivity", "Utility").
                - If it's a receipt/invoice, tag as "Finance > Receipt".
                - Avoid these tags: {{IGNORED_TAGS}}

                ${GM_getValue('autoDescribe', false) ? 'Task 2: Summarize the content in 1 sentence.' : ''}

                Output JSON ONLY:
                {
                    "tags": ["tag1", "tag2"],
                    "description": "Summary..."
                }

                Content:
                {{CONTENT}}
            `.trim()),

            clusteringPrompt: GM_getValue('clusteringPrompt', `
                You are a Librarian. Organize these tags into a clean folder structure.

                Rules:
                1. Group related tags into broad categories (e.g., "React", "Vue" -> "Development > Web > Frameworks").
                2. Use nested paths separated by " > " if "Allow Nested Folders" is enabled.
                3. Create 5-15 high-level categories maximum.
                4. Do not force tags that don't fit into a "Misc" category unless absolutely necessary.

                Output JSON ONLY:
                { "Folder Name": ["tag1", "tag2"] }

                Tags:
                {{TAGS}}
            `.trim()),

            classificationPrompt: GM_getValue('classificationPrompt', `
                Determine the single best folder for this bookmark based on the existing structure.

                Bookmark:
                {{BOOKMARK}}

                Existing Folders:
                {{CATEGORIES}}

                Rules:
                1. Choose the most specific matching folder.
                2. If the bookmark is a receipt/purchase, look for "Finance" or "Purchases".
                3. If it's a tutorial, look for "Reference" or "Dev".
                4. Return null if it fits nowhere.

                Output JSON ONLY: { "category": "Folder Name" }
            `.trim()),

            ignoredTags: GM_getValue('ignoredTags', 'unsorted, import, bookmark'),
            autoDescribe: GM_getValue('autoDescribe', false),
            useVision: GM_getValue('useVision', false),
            descriptionPrompt: GM_getValue('descriptionPrompt', 'Summarize this in one sentence.'),
            nestedCollections: GM_getValue('nestedCollections', false),
            tagBrokenLinks: GM_getValue('tagBrokenLinks', false),
            debugMode: GM_getValue('debugMode', false),
            reviewClusters: GM_getValue('reviewClusters', false),
            minTagCount: GM_getValue('minTagCount', 2),
            deleteEmptyCols: GM_getValue('deleteEmptyCols', false),
            safeMode: GM_getValue('safeMode', true),
            minVotes: GM_getValue('minVotes', 2),
            language: GM_getValue('language', 'en')
        }

        init() {
            this.config = {
                openaiKey: typeof GM_getValue !== 'undefined' ? GM_getValue('openaiKey', '') : '',
                openaiModel: typeof GM_getValue !== 'undefined' ? GM_getValue('openaiModel', 'gpt-4o-mini') : 'gpt-4o-mini',
                anthropicKey: typeof GM_getValue !== 'undefined' ? GM_getValue('anthropicKey', '') : '',
                anthropicModel: typeof GM_getValue !== 'undefined' ? GM_getValue('anthropicModel', 'claude-3-haiku-20240307') : 'claude-3-haiku-20240307',
                raindropToken: typeof GM_getValue !== 'undefined' ? GM_getValue('raindropToken', '') : '',
                provider: typeof GM_getValue !== 'undefined' ? GM_getValue('provider', 'openai') : 'openai', // 'openai', 'anthropic', 'groq', 'deepseek', or 'custom'
                groqKey: typeof GM_getValue !== 'undefined' ? GM_getValue('groqKey', '') : '',
                groqModel: typeof GM_getValue !== 'undefined' ? GM_getValue('groqModel', 'llama3-70b-8192') : 'llama3-70b-8192',
                deepseekKey: typeof GM_getValue !== 'undefined' ? GM_getValue('deepseekKey', '') : '',
                deepseekModel: typeof GM_getValue !== 'undefined' ? GM_getValue('deepseekModel', 'deepseek-chat') : 'deepseek-chat',
                customBaseUrl: typeof GM_getValue !== 'undefined' ? GM_getValue('customBaseUrl', 'http://localhost:11434/v1') : 'http://localhost:11434/v1',
                customModel: typeof GM_getValue !== 'undefined' ? GM_getValue('customModel', 'llama3') : 'llama3',
                concurrency: typeof GM_getValue !== 'undefined' ? GM_getValue('concurrency', 20) : 20,
                maxTags: typeof GM_getValue !== 'undefined' ? GM_getValue('maxTags', 5) : 5,
                targetCollectionId: 0, // 0 is 'All bookmarks'
                skipTagged: typeof GM_getValue !== 'undefined' ? GM_getValue('skipTagged', false) : false,
                dryRun: typeof GM_getValue !== 'undefined' ? GM_getValue('dryRun', false) : false,

                // Refined Default Prompts
                taggingPrompt: typeof GM_getValue !== 'undefined' ? GM_getValue('taggingPrompt', `
                    Analyze the following content (text and/or image) to understand its core topic, context, and utility.

                    Task 1: Generate {{MAX_TAGS}} tags.
                    - Tags should be hierarchical where possible (e.g., "Dev", "Dev > Web").
                    - Tags should be broad enough for grouping but specific enough to be useful.
                    - If the content is a tool, tag its purpose (e.g., "Productivity", "Utility").
                    - If it's a receipt/invoice, tag as "Finance > Receipt".
                    - Avoid these tags: {{IGNORED_TAGS}}

                    ${GM_getValue('autoDescribe', false) ? 'Task 2: Summarize the content in 1 sentence.' : ''}

                    Output JSON ONLY:
                    {
                        "tags": ["tag1", "tag2"],
                        "description": "Summary..."
                    }

                    Content:
                    {{CONTENT}}
                `.trim()) : '',

                clusteringPrompt: typeof GM_getValue !== 'undefined' ? GM_getValue('clusteringPrompt', `
                    You are a Librarian. Organize these tags into a clean folder structure.

                    Rules:
                    1. Group related tags into broad categories (e.g., "React", "Vue" -> "Development > Web > Frameworks").
                    2. Use nested paths separated by " > " if "Allow Nested Folders" is enabled.
                    3. Create 5-15 high-level categories maximum.
                    4. Do not force tags that don't fit into a "Misc" category unless absolutely necessary.

                    Output JSON ONLY:
                    { "Folder Name": ["tag1", "tag2"] }

                    Tags:
                    {{TAGS}}
                `.trim()) : '',

                classificationPrompt: typeof GM_getValue !== 'undefined' ? GM_getValue('classificationPrompt', `
                    Determine the single best folder for this bookmark based on the existing structure.

                    Bookmark:
                    {{BOOKMARK}}

                    Existing Folders:
                    {{CATEGORIES}}

                    Rules:
                    1. Choose the most specific matching folder.
                    2. If the bookmark is a receipt/purchase, look for "Finance" or "Purchases".
                    3. If it's a tutorial, look for "Reference" or "Dev".
                    4. Return null if it fits nowhere.

                    Output JSON ONLY: { "category": "Folder Name" }
                `.trim()) : '',

                ignoredTags: typeof GM_getValue !== 'undefined' ? GM_getValue('ignoredTags', 'unsorted, import, bookmark') : 'unsorted, import, bookmark',
                autoDescribe: typeof GM_getValue !== 'undefined' ? GM_getValue('autoDescribe', false) : false,
                useVision: typeof GM_getValue !== 'undefined' ? GM_getValue('useVision', false) : false,
                descriptionPrompt: typeof GM_getValue !== 'undefined' ? GM_getValue('descriptionPrompt', 'Summarize this in one sentence.') : 'Summarize this in one sentence.',
                nestedCollections: typeof GM_getValue !== 'undefined' ? GM_getValue('nestedCollections', false) : false,
                tagBrokenLinks: typeof GM_getValue !== 'undefined' ? GM_getValue('tagBrokenLinks', false) : false,
                debugMode: typeof GM_getValue !== 'undefined' ? GM_getValue('debugMode', false) : false,
                reviewClusters: typeof GM_getValue !== 'undefined' ? GM_getValue('reviewClusters', false) : false,
                minTagCount: typeof GM_getValue !== 'undefined' ? GM_getValue('minTagCount', 2) : 2,
                deleteEmptyCols: typeof GM_getValue !== 'undefined' ? GM_getValue('deleteEmptyCols', false) : false,
                semanticDedupe: typeof GM_getValue !== 'undefined' ? GM_getValue('semanticDedupe', false) : false,
                localEmbeddings: typeof GM_getValue !== 'undefined' ? GM_getValue('localEmbeddings', false) : false,
                safeMode: typeof GM_getValue !== 'undefined' ? GM_getValue('safeMode', true) : true,
                minVotes: typeof GM_getValue !== 'undefined' ? GM_getValue('minVotes', 2) : 2,
                language: typeof GM_getValue !== 'undefined' ? GM_getValue('language', 'en') : 'en',
                darkMode: typeof GM_getValue !== 'undefined' ? GM_getValue('darkMode', false) : false,
                smartTriggers: typeof GM_getValue !== 'undefined' ? GM_getValue('smartTriggers', false) : false,
                costBudget: typeof GM_getValue !== 'undefined' ? parseFloat(GM_getValue('costBudget', 0)) : 0
            };
        }
    }

    const STATE = new StateManager();

    console.log('Raindrop.io AI Sorter loaded');


    // --- Vision Helper ---
    async function fetchImageAsBase64(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                responseType: "blob",
                onload: function(response) {
                    if (response.status === 200) {
                        const reader = new FileReader();
                        reader.onloadend = function() {
                            resolve(reader.result); // Returns data:image/jpeg;base64,...
                        }
                        reader.onerror = reject;
                        reader.readAsDataURL(response.response);
                    } else {
                        reject(new Error(`Image fetch failed: ${response.status}`));
                    }
                },
                onerror: reject
            });
        });
    }

    function createTooltipIcon(text) {
        return `<span class="ras-tooltip-icon" title="${text.replace(/"/g, '&quot;')}" data-tooltip="${text.replace(/"/g, '&quot;')}">?</span>`;
    }

    function log(message, type='info') {
        const logContainer = document.getElementById('ras-log');
        if (logContainer) {
            const entry = document.createElement('div');
            entry.className = `ras-log-entry ras-log-${type}`;
            entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logContainer.prepend(entry);
        }

        if (type === 'error') {
            console.error(`[RAS] ${message}`);
        } else {
            console.log(`[RAS] ${message}`);
        }

        // Toast integration
        if (typeof showToast === 'function' && (type === 'error' || type === 'success')) {
            showToast(message, type);
        }
    }

    function logAction(actionType, details) {
        if (!STATE.actionLog) STATE.actionLog = [];
        const entry = {
            timestamp: new Date().toISOString(),
            type: actionType,
            ...details
        };
        STATE.actionLog.push(entry);
    }

    function exportAuditLog() {
        if (!STATE.actionLog || STATE.actionLog.length === 0) {
            alert("No actions recorded yet.");
            return;
        }
        const blob = new Blob([JSON.stringify(STATE.actionLog, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `raindrop-sorter-log-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function debug(obj, label='DEBUG') {
        if (STATE.config && STATE.config.debugMode) {
            console.group(`[RAS] ${label}`);
            console.log(obj);
            console.groupEnd();
        }
    }

    function updateProgress(percent) {
        const bar = document.getElementById('ras-progress-bar');
        const container = document.getElementById('ras-progress-container');
        if (bar && container) {
            container.style.display = 'block';
            bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    }

    function updateTokenStats(inputLen, outputLen) {
        // Approx 4 chars per token
        const inputTokens = Math.ceil(inputLen / 4);
        const outputTokens = Math.ceil(outputLen / 4);

        if (!STATE.stats) STATE.stats = { tokens: { input: 0, output: 0 } };
        if (!STATE.stats.tokens) STATE.stats.tokens = { input: 0, output: 0 };

        STATE.stats.tokens.input += inputTokens;
        STATE.stats.tokens.output += outputTokens;

        const total = STATE.stats.tokens.input + STATE.stats.tokens.output;

        // Very rough cost est
        const cost = (STATE.stats.tokens.input * 0.0000005) + (STATE.stats.tokens.output * 0.0000015);

        const tokenEl = document.getElementById('ras-stats-tokens');
        const costEl = document.getElementById('ras-stats-cost');

        if(tokenEl) tokenEl.textContent = `Tokens: ${(total/1000).toFixed(1)}k`;
        if(costEl) costEl.textContent = `Est: $${cost.toFixed(4)}`;

        // Cost Alert Logic
        const budgetLimit = STATE.config.costBudget || 0;
        if (budgetLimit > 0 && cost >= budgetLimit) {
            if (!STATE.budgetAlertShown) {
                STATE.budgetAlertShown = true;
                alert(`[Raindrop AI Sorter]\n\nWARNING: You have reached your estimated API cost budget of $${budgetLimit.toFixed(2)} for this session. Current estimated cost: $${cost.toFixed(4)}.\n\nExecution will pause. You can stop the process or continue at your own risk.`);

                // If running, ask to abort
                if (STATE.isRunning) {
                    const stopNow = confirm("Do you want to STOP the current process?");
                    if (stopNow) {
                        if (typeof stopSorting === 'function') {
                            stopSorting();
                        } else if (STATE.abortController) {
                            STATE.stopRequested = true;
                            STATE.abortController.abort();
                        }
                    }
                }
            }
        }
    }

    // Expose config management to window for UI modules
    window.exportConfig = function() {
        const config = { ...STATE.config };
        const blob = new Blob([JSON.stringify(config, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `raindrop-sorter-config-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    window.importConfig = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const config = JSON.parse(evt.target.result);
                Object.keys(config).forEach(k => {
                    if (typeof STATE.config[k] !== 'undefined') {
                        GM_setValue(k, config[k]);
                    }
                });
                alert('Configuration imported. Reloading page to apply...');
                window.location.reload();
            } catch(err) {
                alert('Failed to parse config file: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    // Archivist: Wayback Machine Check
    async function checkWaybackMachine(url) {
        return new Promise((resolve) => {
            const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
            GM_xmlhttpRequest({
                method: 'GET',
                url: apiUrl,
                timeout: 5000,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data && data.archived_snapshots && data.archived_snapshots.closest) {
                            resolve(data.archived_snapshots.closest.url);
                        } else {
                            resolve(null);
                        }
                    } catch(e) {
                        resolve(null);
                    }
                },
                onerror: () => resolve(null),
                ontimeout: () => resolve(null)
            });
        });
    }

    // Wayback Machine Availability Check
    async function checkWaybackMachine(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
                timeout: 5000,
                onload: (res) => {
                    if (res.status === 200) {
                        try {
                            const data = JSON.parse(res.responseText);
                            if (data.archived_snapshots && data.archived_snapshots.closest) {
                                resolve(data.archived_snapshots.closest.url);
                            } else {
                                resolve(null);
                            }
                        } catch(e) { resolve(null); }
                    } else {
                        resolve(null);
                    }
                },
                onerror: () => resolve(null),
                ontimeout: () => resolve(null)
            });
        });
    }

    // Scraper
    async function scrapeUrl(url, signal = null) {
        return new Promise((resolve, reject) => {
            if (signal && signal.aborted) {
                return resolve({ error: 'aborted' });
            }

            const req = GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 15000, // Increased timeout
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                         const contentType = (response.responseHeaders.match(/content-type:\s*(.*)/i) || [])[1] || '';
                         if (contentType && !contentType.includes('text') && !contentType.includes('html') && !contentType.includes('json') && !contentType.includes('xml')) {
                             console.warn(`Skipping non-text content: ${contentType}`);
                             resolve({ error: 'skipped_binary' });
                             return;
                         }

                         const parser = new DOMParser();
                         const doc = parser.parseFromString(response.responseText, "text/html");

                         // Clean up junk
                         const toRemove = doc.querySelectorAll('script, style, nav, footer, header, aside, iframe, noscript, svg, [role="alert"], .ads, .comment, .menu, .cookie-banner, .modal, .popup, .newsletter, .ad, .advertisement, .sidebar, .widget');
                         toRemove.forEach(s => s.remove());

                         // Improved Extraction (Readability-lite v2)
                         // 1. Find all text containers
                         const blockElements = doc.querySelectorAll('p, div, article, section, li, h1, h2, h3, h4, h5, h6');
                         let candidates = [];

                         blockElements.forEach(el => {
                             const text = (el.innerText || el.textContent || "").replace(/\s+/g, ' ').trim();
                             if (text.length < 30) return; // Skip fragments

                             // Score based on length and punctuation
                             let score = text.length;
                             score += (text.split(',').length * 5);
                             score += (text.split('.').length * 5);

                             // Penalize high link density (navigation)
                             const linkLength = Array.from(el.querySelectorAll('a')).reduce((acc, a) => acc + (a.innerText||"").length, 0);
                             if (linkLength > text.length * 0.5) score *= 0.2;

                             candidates.push({ el, score, text });
                         });

                         // Sort by score
                         candidates.sort((a,b) => b.score - a.score);

                         // Take top 5 chunks
                         let cleanText = candidates.slice(0, 5).map(c => c.text).join("\n\n");

                         // Fallback to body if extraction failed to find anything substantial
                         if (cleanText.length < 200) {
                             const contentEl = doc.querySelector('main') || doc.querySelector('article') || doc.body;
                             cleanText = (contentEl.innerText || contentEl.textContent).replace(/\s+/g, ' ').trim();
                         }

                         // JSON-LD Metadata extraction
                         let jsonLdData = "";
                         const jsonLd = doc.querySelector('script[type="application/ld+json"]');
                         if (jsonLd) {
                             try {
                                 const data = JSON.parse(jsonLd.textContent);
                                 if (data.headline) jsonLdData += data.headline + "\n";
                                 if (data.description) jsonLdData += data.description + "\n";
                                 if (data.articleBody) jsonLdData += data.articleBody.substring(0, 1000) + "\n";
                             } catch(e) {}
                         }

                         // Standard Metadata Fallback
                         const ogDesc = doc.querySelector('meta[property="og:description"]')?.content || "";
                         const metaDesc = doc.querySelector('meta[name="description"]')?.content || "";
                         const ogTitle = doc.querySelector('meta[property="og:title"]')?.content || "";

                         const metadata = [jsonLdData, ogTitle, ogDesc, metaDesc].filter(s => s).join("\n");

                         // Prepend metadata to text for context
                         if (metadata.length > 0) {
                             cleanText = `[METADATA]\n${metadata}\n\n[CONTENT]\n${cleanText}`;
                         }

                         // SPA / JS-heavy fallback (Jina Reader API)
                         if (combinedText.length < 500 && !fallbackUsed) {
                             console.log(`[RAS] Insufficient text extracted from ${url}. Attempting SPA fallback via r.jina.ai...`);

                             // Initiate fallback request
                             const jinaReq = GM_xmlhttpRequest({
                                 method: 'GET',
                                 url: `https://r.jina.ai/${encodeURIComponent(url)}`,
                                 timeout: 15000,
                                 onload: function(jinaRes) {
                                     if (jinaRes.status >= 200 && jinaRes.status < 300) {
                                         console.log(`[RAS] SPA fallback successful for ${url}`);
                                         resolve({
                                             title: doc.title,
                                             text: jinaRes.responseText.substring(0, 15000)
                                         });
                                     } else {
                                         // If fallback fails, return what we have (even if tiny)
                                         resolve({
                                             title: doc.title,
                                             text: combinedText.substring(0, 15000)
                                         });
                                     }
                                 },
                                 onerror: function() {
                                     resolve({
                                         title: doc.title,
                                         text: combinedText.substring(0, 15000)
                                     });
                                 },
                                 ontimeout: function() {
                                     resolve({
                                         title: doc.title,
                                         text: combinedText.substring(0, 15000)
                                     });
                                 }
                             });

                             if (signal) {
                                 signal.addEventListener('abort', () => {
                                     if (jinaReq && jinaReq.abort) jinaReq.abort();
                                 });
                             }
                             return; // Wait for Jina to finish
                         }

                         resolve({
                             title: doc.title,
                             text: cleanText.substring(0, 20000) // Increased limit
                         });
                    } else {
                        // Pass status for 404 handling
                        resolve({ error: response.status });
                    }
                },
                onerror: function(err) {
                    console.warn(`Error scraping ${url}:`, err);
                    resolve({ error: 'network_error' });
                },
                ontimeout: function() {
                     console.warn(`Timeout scraping ${url}`);
                     resolve({ error: 'timeout' });
                }
            });

            if (signal) {
                signal.addEventListener('abort', () => {
                    if (req && req.abort) req.abort();
                    resolve({ error: 'aborted' });
                });
            }
        });
    }


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


    // Raindrop API Client
    class RaindropAPI {
        constructor(token, network) {
            this.baseUrl = 'https://api.raindrop.io/rest/v1';
            this.token = token;
            this.network = network || new NetworkClient();
            this.collectionCache = null; // Flat list cache
        }

        async loadCollectionCache(force = false) {
            if (this.collectionCache && !force) return;
            console.log('Loading Collection Cache...');
            try {
                // Fetch all collections. Raindrop /collections returns flattened hierarchy
                const res = await this.request('/collections');
                if (res.items) {
                    this.collectionCache = res.items;
                    console.log(`Cache loaded: ${this.collectionCache.length} collections`);
                }
            } catch(e) {
                console.warn('Failed to load collection cache', e);
            }
        }

        async request(endpoint, method = 'GET', body = null) {
            return this.fetchWithRetry(`${this.baseUrl}${endpoint}`, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                data: body ? JSON.stringify(body) : null,
                signal: STATE.abortController ? STATE.abortController.signal : null
            });
        }

        async fetchWithRetry(url, options, retries = 3, delay = 1000) {
            return new Promise((resolve, reject) => {
                const makeRequest = async (attempt) => {
                    if (options.signal && options.signal.aborted) return reject(new Error('Aborted'));

                    try {
                        const response = await this.network.request(url, options);

                        if (response.status === 429) {
                            const retryAfter = parseInt(response.responseHeaders?.match(/Retry-After: (\d+)/i)?.[1] || 60);
                            const waitTime = (retryAfter * 1000) + 1000;
                            console.warn(`[Raindrop API] Rate Limit 429. Waiting ${waitTime/1000}s...`);
                            if (attempt <= retries + 2) {
                                setTimeout(() => makeRequest(attempt + 1), waitTime);
                                return;
                            }
                        }

                        if (response.status >= 200 && response.status < 300) {
                            try {
                                resolve(JSON.parse(response.responseText));
                            } catch (e) {
                                reject(new Error('Failed to parse JSON response'));
                            }
                        } else if (response.status >= 500 && attempt <= retries) {
                            const backoff = delay * Math.pow(2, attempt - 1);
                            console.warn(`[Raindrop API] Error ${response.status}. Retrying in ${backoff/1000}s...`);
                            setTimeout(() => makeRequest(attempt + 1), backoff);
                        } else {
                            reject(new Error(`API Error ${response.status}: ${response.statusText}`));
                        }
                    } catch (error) {
                        if (error.message === 'Aborted') return reject(error);
                        if (attempt <= retries) {
                            const backoff = delay * Math.pow(2, attempt - 1);
                            setTimeout(() => makeRequest(attempt + 1), backoff);
                        } else {
                            reject(error);
                        }
                    }
                };
                makeRequest(1);
            });
        }

        async getCollections() {
            if (this.collectionCache) return this.collectionCache;
            const res = await this.request('/collections');
            return res.items;
        }

        async deleteCollection(id) {
            if (STATE.config.dryRun) {
                console.log(`[DryRun] Delete Collection ID: ${id}`);
                return {};
            }
            logAction('DELETE_COLLECTION', { id });
            return await this.request(`/collection/${id}`, 'DELETE');
        }

        async getAllTags() {
            const res = await this.request('/tags');
            return res.items; // [{_id: "tagname", count: 10}, ...]
        }

        async removeTag(tagName) {
            if (STATE.config.dryRun) {
                console.log(`[DryRun] Delete Tag: ${tagName}`);
                return {};
            }
            logAction('REMOVE_TAG', { tag: tagName });
            return await this.request('/tags', 'DELETE', { ids: [tagName] });
        }

        async removeTagsBatch(tagNames) {
            if (STATE.config.dryRun) {
                console.log(`[DryRun] Delete Tags Batch: ${tagNames.join(', ')}`);
                return {};
            }
            logAction('REMOVE_TAGS_BATCH', { tags: tagNames });
            // Raindrop DELETE /tags body: { tags: ["tag1", "tag2"] }
            return await this.request('/tags/0', 'DELETE', { tags: tagNames });
        }

        async mergeTags(tags, newName) {
            if (STATE.config.dryRun) {
                console.log(`[DryRun] Merge Tags [${tags.join(', ')}] -> ${newName}`);
                return {};
            }
            logAction('MERGE_TAGS', { tags, newName });
            // PUT /tags/{collectionId}
            return await this.request('/tags/0', 'PUT', { tags, replace: newName });
        }

        async getChildCollections() {
             const res = await this.request('/collections/childrens');
             return res.items;
        }

        async getBookmarks(collectionId = 0, page = 0, search = null) {
            let url = `/raindrops/${collectionId}?page=${page}&perpage=50`;
            if (search) {
                url += `&search=${encodeURIComponent(search)}`;
            }
            return this.request(url);
        }


    async deleteBookmark(id) {
        if (!this.token) throw new Error("No token");
        try {
            const res = await this.network.fetch(`https://api.raindrop.io/rest/v1/raindrop/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            if (res.status === 429) {
                // We should theoretically retry, but keeping it simple for delete
                throw new Error("Rate limit exceeded");
            }
            if (!res.ok) throw new Error(`Failed to delete bookmark ${id}: ${res.status}`);
            return true;
        } catch (e) {
            console.error("Raindrop API Error (deleteBookmark):", e);
            throw e;
        }
    }

    async updateBookmark(id, data) {
            if (STATE.config.dryRun) {
                console.log(`[DryRun] Update Bookmark ${id}:`, data);
                return { item: { _id: id, ...data } };
            }
            if (STATE.config.debugMode) {
                console.log(`[UpdateBookmark] ID: ${id}`, data);
            }
            logAction('UPDATE_BOOKMARK', { id, changes: data });
            return await this.request(`/raindrop/${id}`, 'PUT', data);
        }

        async createCollection(title, parentId = null) {
            if (STATE.config.dryRun) {
                console.log(`[DryRun] Create Collection: ${title} (Parent: ${parentId})`);
                // Fake item for cache logic
                const fake = { _id: 999999999 + Math.floor(Math.random()*1000), title, parent: parentId ? {$id: parentId} : undefined };
                if (this.collectionCache) this.collectionCache.push(fake);
                return { item: fake };
            }
            const data = { title };
            if (parentId) data.parent = { $id: parentId };
            const res = await this.request('/collection', 'POST', data);

            // Update cache
            if (res && res.item && this.collectionCache) {
                this.collectionCache.push(res.item);
            }
            return res;
        }

        async ensureCollectionPath(pathString, rootParentId = null) {
            // Path e.g., "Dev > Web > React"
            const parts = pathString.split(/[>/\\]/).map(s => s.trim()).filter(s => s);
            let currentParentId = rootParentId;
            let currentCollectionId = null;

            for (const part of parts) {
                // Find collection with this title and currentParentId
                try {
                    // Ensure cache is loaded at least once if not already
                    if (!this.collectionCache) await this.loadCollectionCache();
                    const allCols = this.collectionCache || [];

                    let found = null;
                    if (currentParentId) {
                        // Look for child
                        found = allCols.find(c =>
                            c.title.toLowerCase() === part.toLowerCase() &&
                            c.parent && c.parent.$id === currentParentId
                        );
                    } else {
                        // Look for root
                        found = allCols.find(c =>
                            c.title.toLowerCase() === part.toLowerCase() &&
                            (!c.parent)
                        );
                    }

                    if (found) {
                        currentCollectionId = found._id;
                        currentParentId = found._id;
                    } else {
                        // Create
                        const newCol = await this.createCollection(part, currentParentId);
                        if (newCol && newCol.item) {
                            currentCollectionId = newCol.item._id;
                            currentParentId = newCol.item._id;
                        } else {
                            throw new Error('Failed to create collection');
                        }
                    }
                } catch (e) {
                    console.error('Error ensuring path:', e);
                    return null;
                }
            }
            return currentCollectionId;
        }

        async moveBookmark(id, collectionId) {
             if (STATE.config.dryRun) {
                console.log(`[DryRun] Move Bookmark ${id} to ${collectionId}`);
                return { item: { _id: id, collection: { $id: collectionId } } };
            }
             logAction('MOVE_BOOKMARK', { id, targetCollectionId: collectionId });
             return await this.request(`/raindrop/${id}`, 'PUT', { collection: { $id: collectionId } });
        }
    }


    class LLMClient {
        constructor(config, network) {
            this.config = config;
            // Inject network client, or fallback to a new instance if missing to prevent crashes
            this.network = network || new NetworkClient();
        }

        async generateTags(content, existingTags = [], imageUrl = null) {
            let prompt = this.config.taggingPrompt;
            if (!prompt.includes('{{CONTENT}}')) {
                prompt += '\n\nContent:\n{{CONTENT}}';
            }
            prompt = prompt.replace('{{CONTENT}}', content.substring(0, 8000)); // Limit context

            if (existingTags && existingTags.length > 0) {
                prompt += `\n\nExisting Tags: ${existingTags.join(', ')}`;
            }

            // Add Max Tags instruction if not present
            if (!prompt.includes('max tags')) {
                prompt += `\n\nLimit to ${this.config.maxTags} relevant tags.`;
            }

            if (this.config.autoDescribe) {
                 prompt += `\n\nAlso provide a short description (max 200 chars) in the JSON field "description".`;
            }

            prompt += `\n\nOutput ONLY valid JSON: { "tags": ["tag1", "tag2"], "description": "..." }`;

            // Vision
            if (imageUrl && this.config.useVision && (this.config.provider === 'openai' || this.config.provider === 'anthropic')) {
                 try {
                     const base64Image = await fetchImageAsBase64(imageUrl);
                     if (base64Image) {
                         // Pass structured content to callLLMVision
                         return await this.callLLMVision(prompt, base64Image, true);
                     }
                 } catch(e) {
                     console.warn(`[Vision] Failed to fetch image ${imageUrl}: ${e.message}`);
                     // Fallback to text only
                 }
            }

            return await this.callLLM(prompt, true);
        }

        async clusterTags(tags) {
            let prompt = this.config.clusteringPrompt;
            if (!prompt.includes('{{TAGS}}')) {
                prompt += '\n\nTags:\n{{TAGS}}';
            }
            prompt = prompt.replace('{{TAGS}}', JSON.stringify(tags));
            prompt += `\n\nGroup these tags into semantic categories. Output ONLY valid JSON: { "Category Name": ["tag1", "tag2"] }`;

            return await this.callLLM(prompt, true);
        }

        async analyzeTagConsolidation(tags) {
             let prompt = `
                Analyze the following list of tags and identify duplicates, synonyms, or very similar tags that should be merged.
                Tags: ${JSON.stringify(tags)}

                Return a JSON object where the key is the "bad" tag (to be removed) and the value is the "good" tag (to keep).
                Example: { "js": "javascript", "reactjs": "react" }
                Strictly avoid identity mappings (e.g. "tag": "tag").
                Output ONLY valid JSON.
             `;
             return await this.callLLM(prompt, true);
        }

        async classifyBookmarkSemantic(bookmark, existingPaths) {
            let prompt = `
                Classify the bookmark into a folder structure based on its content.
                Bookmark:
                Title: ${bookmark.title}
                Excerpt: ${bookmark.excerpt}
                URL: ${bookmark.link}
                Tags: ${bookmark.tags.join(', ')}

                Existing Folder Paths:
                ${existingPaths.join('\n')}

                Choose the best existing path or suggest a new one.
                Output ONLY valid JSON: { "path": "Folder > Subfolder" }
            `;
            return await this.callLLM(prompt, true);
        }

        async classifyBookmarkIntoExisting(bookmark, collectionNames, smartContext = false) {
            let prompt = this.config.classificationPrompt || "";

            // Build Smart Context
            let contextExamples = "";
            if (smartContext && typeof RuleEngine !== 'undefined') {
                const rules = RuleEngine.getRules();
                // Future expansion
            }

            if (!prompt || prompt.trim() === '') {
                prompt = `
                    Classify the following bookmark into exactly ONE of the provided categories.

                    Bookmark:
                    {{BOOKMARK}}

                    Categories:
                    {{CATEGORIES}}
                    ${contextExamples}

                    Output ONLY a JSON object: { "category": "Exact Category Name" }
                    If no category fits well, return null for category.
                `;
            }

            const bookmarkDetails = `Title: ${bookmark.title}\nExcerpt: ${bookmark.excerpt}\nURL: ${bookmark.link}\nTags: ${bookmark.tags ? bookmark.tags.join(', ') : 'none'}`;
            prompt = prompt.replace('{{BOOKMARK}}', bookmarkDetails);
            prompt = prompt.replace('{{CATEGORIES}}', JSON.stringify(collectionNames));

            if (contextExamples && !prompt.includes(contextExamples.trim())) {
                prompt += `\n\n${contextExamples}`;
            }

            return await this.callLLM(prompt, true);
        }

        async summarizeContent(title, content) {
            let prompt = `
                Summarize the following content into a concise paragraph (max 3 sentences).
                Title: ${title}
                Content: ${content.substring(0, 10000)}

                Output ONLY the summary text.
            `;
            return await this.callLLM(prompt, false); // Expect string
        }

        async callLLM(prompt, expectJson = false) {
            if (this.config.provider === 'openai') return await this.callOpenAI(prompt, expectJson);
            if (this.config.provider === 'anthropic') return await this.callAnthropic(prompt, expectJson);
            if (this.config.provider === 'groq') return await this.callGroq(prompt, expectJson);
            if (this.config.provider === 'deepseek') return await this.callDeepSeek(prompt, expectJson);
            if (this.config.provider === 'custom') return await this.callCustom(prompt, expectJson);
            throw new Error('Unknown provider');
        }

        async callLLMVision(promptText, base64Image, expectJson) {
            if (this.config.provider === 'openai') {
                // OpenAI Structure
                const messages = [{
                    role: 'user',
                    content: [
                        { type: "text", text: promptText },
                        { type: "image_url", image_url: { url: base64Image } }
                    ]
                }];
                return await this.callOpenAICompatible(messages, expectJson, 'https://api.openai.com/v1', this.config.openaiKey, 'gpt-4o');
            }
            if (this.config.provider === 'anthropic') {
                 // Anthropic Structure
                 // Extract MIME and Data
                 const match = base64Image.match(/^data:(.+);base64,(.+)$/);
                 if (!match) throw new Error("Invalid base64 image");
                 const mimeType = match[1];
                 const b64Data = match[2];

                 const messages = [{
                     role: 'user',
                     content: [
                         {
                             type: "image",
                             source: {
                                 type: "base64",
                                 media_type: mimeType,
                                 data: b64Data
                             }
                         },
                         { type: "text", text: promptText }
                     ]
                 }];
                 // Use specific Anthropic call with messages array
                 return await this.callAnthropicStructured(messages, expectJson);
            }
            // Fallback for others
            return await this.callLLM(promptText, expectJson);
        }

        // Provider Implementations
        async callOpenAI(prompt, expectJson, isCustom = false) {
             const baseUrl = isCustom ? this.config.customBaseUrl : 'https://api.openai.com/v1';
             const key = isCustom ? null : this.config.openaiKey;
             const model = isCustom ? this.config.customModel : 'gpt-4o-mini';

             // Wrap simple prompt
             const messages = [{role: 'user', content: prompt}];
             return this.callOpenAICompatible(messages, expectJson, baseUrl, key, model);
        }

        async callGroq(prompt, expectJson) {
            const messages = [{role: 'user', content: prompt}];
            return this.callOpenAICompatible(messages, expectJson, 'https://api.groq.com/openai/v1', this.config.groqKey, 'llama3-70b-8192');
        }

        async callDeepSeek(prompt, expectJson) {
            const messages = [{role: 'user', content: prompt}];
            return this.callOpenAICompatible(messages, expectJson, 'https://api.deepseek.com', this.config.deepseekKey, 'deepseek-chat');
        }

        async callCustom(prompt, expectJson) {
            const messages = [{role: 'user', content: prompt}];
            return this.callOpenAICompatible(messages, expectJson, this.config.customBaseUrl, null, this.config.customModel);
        }

        async callAnthropic(prompt, expectJson) {
            const messages = [{role: 'user', content: prompt}];
            return this.callAnthropicStructured(messages, expectJson);
        }

        // Unified Anthropic Call
        async callAnthropicStructured(messages, expectJson) {
             // Calculate stats roughly
             let len = 0;
             messages.forEach(m => {
                 if (typeof m.content === 'string') len += m.content.length;
                 else if (Array.isArray(m.content)) {
                     m.content.forEach(c => {
                         if (c.text) len += c.text.length;
                         if (c.source) len += 1000; // rough image est
                     });
                 }
             });
             updateTokenStats(len, 0);

             return new Promise((resolve, reject) => {
                const options = {
                    method: 'POST',
                    headers: {
                        'x-api-key': this.config.anthropicKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        model: 'claude-3-haiku-20240307', // Or use config model if added
                        max_tokens: 1024,
                        messages: messages
                    }),
                    signal: STATE.abortController ? STATE.abortController.signal : null
                };

                this.fetchWithRetry('https://api.anthropic.com/v1/messages', options).then(response => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.error) throw new Error(data.error.message);
                            const text = data.content[0].text.trim();
                            updateTokenStats(0, text.length);

                            if (this.config.debugMode) {
                                console.log('[LLM Raw Response]', text);
                                if (!STATE.aiDiagnosticsLog) STATE.aiDiagnosticsLog = [];
                                STATE.aiDiagnosticsLog.push(`--- Anthropic Response ---\nPrompt Hash/Size: ${messages.length} messages\nResponse:\n${text}`);
                            }

                            if (expectJson) {
                                const cleanText = this.extractJSON(text);
                                try {
                                    resolve(JSON.parse(cleanText));
                                } catch (e) {
                                    console.warn('JSON Parse failed. Attempting repair...');
                                    const repaired = this.repairJSON(cleanText);
                                    resolve(JSON.parse(repaired));
                                }
                            } else {
                                resolve(text);
                            }
                        } catch (e) {
                             console.error('Anthropic Error', e, response.responseText);
                             reject(e);
                        }
                    }).catch(reject);
            });
        }

        // Unified OpenAI Call
        async callOpenAICompatible(messages, expectJson, baseUrl, key, model) {
             const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
             const headers = { 'Content-Type': 'application/json' };

             if (key) {
                 headers['Authorization'] = `Bearer ${key}`;
             }

             // Stats
             let len = 0;
             messages.forEach(m => {
                 if (typeof m.content === 'string') len += m.content.length;
                 else if (Array.isArray(m.content)) {
                     m.content.forEach(c => {
                         if (c.text) len += c.text.length;
                         if (c.image_url) len += 1000;
                     });
                 }
             });
             updateTokenStats(len, 0);

             return new Promise((resolve, reject) => {
                 this.fetchWithRetry(url, {
                    method: 'POST',
                    headers: headers,
                    data: JSON.stringify({
                        model: model || 'gpt-3.5-turbo',
                        messages: messages,
                        temperature: 0.3,
                        stream: false
                    }),
                    signal: STATE.abortController ? STATE.abortController.signal : null
                 }).then(data => {
                     try {
                         const response = JSON.parse(data.responseText);
                         if (response.error) throw new Error(response.error.message || JSON.stringify(response.error));
                         if (!response.choices || !response.choices[0]) throw new Error('Invalid API response');

                         const text = response.choices[0].message.content.trim();
                         updateTokenStats(0, text.length);

                         if (this.config.debugMode) {
                             console.log('[LLM Raw Response]', text);
                             if (!STATE.aiDiagnosticsLog) STATE.aiDiagnosticsLog = [];
                             STATE.aiDiagnosticsLog.push(`--- OpenAI/Compatible Response ---\nPrompt Hash/Size: ${messages.length} messages\nResponse:\n${text}`);
                         }

                         if (expectJson) {
                             const cleanText = this.extractJSON(text);
                             try {
                                 resolve(JSON.parse(cleanText));
                             } catch(e) {
                                 console.warn('JSON Parse failed. Attempting repair...');
                                 const repaired = this.repairJSON(cleanText);
                                 resolve(JSON.parse(repaired));
                             }
                         } else {
                             resolve(text);
                         }
                     } catch(e) {
                         reject(e);
                     }
                 }).catch(reject);
             });
        }

        async fetchWithRetry(url, options, retries = 3, delay = 1000) {
            return new Promise((resolve, reject) => {
                const makeRequest = async (attempt) => {
                    if (options.signal && options.signal.aborted) return reject(new Error('Aborted'));

                    try {
                        const response = await this.network.request(url, options);

                        if (response.status === 429) {
                            const retryAfter = parseInt(response.responseHeaders?.match(/Retry-After: (\d+)/i)?.[1] || 60);
                            const waitTime = (retryAfter * 1000) + 1000;
                            console.warn(`[LLM API] Rate Limit 429. Waiting ${waitTime/1000}s...`);
                            if (attempt <= retries + 2) {
                                setTimeout(() => makeRequest(attempt + 1), waitTime);
                                return;
                            }
                        }

                        if (response.status >= 200 && response.status < 300) {
                            resolve(response);
                        } else if (response.status >= 500 && attempt <= retries) {
                            const backoff = delay * Math.pow(2, attempt - 1);
                            console.warn(`[LLM API] Error ${response.status}. Retrying in ${backoff/1000}s...`);
                            setTimeout(() => makeRequest(attempt + 1), backoff);
                        } else {
                            reject(new Error(`API Error ${response.status}: ${response.statusText || response.responseText}`));
                        }
                    } catch (error) {
                        if (error.message === 'Aborted') return reject(error);
                        if (attempt <= retries) {
                            const backoff = delay * Math.pow(2, attempt - 1);
                            setTimeout(() => makeRequest(attempt + 1), backoff);
                        } else {
                            reject(error);
                        }
                    }
                };
                makeRequest(1);
            });
        }

        extractJSON(text) {
             let cleanText = text.replace(/```json/g, '').replace(/```/g, '');
             const firstBrace = cleanText.indexOf('{');
             if (firstBrace !== -1) {
                 cleanText = cleanText.substring(firstBrace);
             }
             const lastBrace = cleanText.lastIndexOf('}');
             if (lastBrace !== -1) {
                 cleanText = cleanText.substring(0, lastBrace + 1);
             }
             return cleanText;
        }

        repairJSON(jsonStr) {
            let cleaned = jsonStr.trim();
            // Remove trailing commas before closing braces
            // Regex to remove , followed by whitespace and } or ]
            cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

            // Try parse first
            try {
                JSON.parse(cleaned);
                return cleaned;
            } catch(e) {}

            // Stack-based repair
            let stack = [];
            let inString = false;
            let escape = false;

            for (let i = 0; i < cleaned.length; i++) {
                const char = cleaned[i];
                if (escape) { escape = false; continue; }
                if (char === '\\') { escape = true; continue; }
                if (char === '"') { inString = !inString; continue; }
                if (!inString) {
                    if (char === '{') stack.push('}');
                    else if (char === '[') stack.push(']');
                    else if (char === '}') stack.pop();
                    else if (char === ']') stack.pop();
                }
            }

            // Close open strings
            if (inString) cleaned += '"';

            // Remove trailing comma if present at the end of the partial string
            // (e.g. `{"a":1,`)
            if (cleaned.trim().endsWith(',')) {
                cleaned = cleaned.trim().slice(0, -1);
            }

            // Close open structures in reverse order
            while (stack.length > 0) {
                cleaned += stack.pop();
            }

            try {
                JSON.parse(repaired);
                return repaired;
            } catch(e) {}

            // Fallback
            const lastComma = cleaned.lastIndexOf(',');
            if (lastComma > 0) {
                let truncated = cleaned.substring(0, lastComma);
                stack = [];
                inString = false;
                escape = false;

                for (let i = 0; i < truncated.length; i++) {
                    const char = truncated[i];
                    if (escape) { escape = false; continue; }
                    if (char === '\\') { escape = true; continue; }
                    if (char === '"') { inString = !inString; continue; }
                    if (!inString) {
                        if (char === '{') stack.push('}');
                        else if (char === '[') stack.push(']');
                        else if (char === '}') stack.pop();
                        else if (char === ']') stack.pop();
                    }
                }

                while (stack.length > 0) {
                    truncated += stack.pop();
                }
                return truncated;
            }

            return isObject ? "{}" : "[]";
        }

        async callGroq(prompt, isObject = false) {
            return this.callOpenAICompatible(prompt, isObject, 'https://api.groq.com/openai/v1', this.config.groqKey, this.config.groqModel || 'llama3-70b-8192');
        }

        async callDeepSeek(prompt, isObject = false) {
            return this.callOpenAICompatible(prompt, isObject, 'https://api.deepseek.com', this.config.deepseekKey, this.config.deepseekModel || 'deepseek-chat');
        }

        async callOpenAI(prompt, isObject = false, isCustom = false) {
             if (isCustom) {
                 return this.callOpenAICompatible(prompt, isObject, this.config.customBaseUrl, null, this.config.customModel);
             }
             return this.callOpenAICompatible(prompt, isObject, 'https://api.openai.com/v1', this.config.openaiKey, this.config.openaiModel || 'gpt-4o-mini');
        }

        async callOpenAICompatible(prompt, isObject, baseUrl, key, model) {
             const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
             const headers = { 'Content-Type': 'application/json' };

             if (key) {
                 headers['Authorization'] = `Bearer ${key}`;
             }

             updateTokenStats(prompt.length, 0); // Track input

             return this.fetchWithRetry(url, {
                method: 'POST',
                headers: headers,
                data: JSON.stringify({
                    model: model || 'gpt-3.5-turbo',
                    messages: [{role: 'user', content: prompt}],
                    temperature: 0.3,
                    stream: false,
                    max_tokens: 4096
                }),
                signal: STATE.abortController ? STATE.abortController.signal : null
             }).then(data => {
                 if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
                 if (!data.choices || !data.choices[0]) throw new Error('Invalid API response');

                 const text = data.choices[0].message.content.trim();
                 updateTokenStats(0, text.length); // Track output

                 if (STATE.config.debugMode) {
                     console.log('[LLM Raw Response]', text);
                 }

                 // Robust JSON extraction
                 let cleanText = text.replace(/```json/g, '').replace(/```/g, '');
                 const firstBrace = cleanText.indexOf('{');
                 if (firstBrace !== -1) {
                     cleanText = cleanText.substring(firstBrace);
                 }

                 try {
                     return JSON.parse(cleanText);
                 } catch(e) {
                     console.warn('JSON Parse failed. Attempting repair...');
                     const repaired = this.repairJSON(cleanText);
                     if (STATE.config.debugMode) console.log('[Repaired JSON]', repaired);
                     return JSON.parse(repaired);
                 }
             }).catch(e => {
                 console.error('LLM Error', e);
                 throw e;
             });
        }

        async fetchWithRetry(url, options, retries = 3, delay = 2000) {
            return new Promise((resolve, reject) => {
                const makeRequest = async (attempt) => {
                    if (options.signal && options.signal.aborted) return reject(new Error('Aborted'));

                    try {
                        const response = await this.network.request(url, options);

                        if (response.status === 429) {
                            const waitTime = 5000 * attempt;
                            console.warn(`[LLM API] Rate Limit 429. Waiting ${waitTime/1000}s...`);
                            if (attempt <= retries + 2) {
                                setTimeout(() => makeRequest(attempt + 1), waitTime);
                                return;
                            }
                        }

                        if (response.status >= 200 && response.status < 300) {
                            try {
                                resolve(JSON.parse(response.responseText));
                            } catch (e) {
                                reject(new Error('Failed to parse JSON response'));
                            }
                        } else if (response.status >= 500 && attempt <= retries) {
                            const backoff = delay * Math.pow(2, attempt - 1);
                            setTimeout(() => makeRequest(attempt + 1), backoff);
                        } else {
                            reject(new Error(`API Error ${response.status}: ${response.responseText}`));
                        }
                    } catch (error) {
                        if (error.message === 'Aborted') return reject(error);
                        if (attempt <= retries) {
                            setTimeout(() => makeRequest(attempt + 1), delay * attempt);
                        } else {
                            reject(error);
                        }
                    }
                };
                makeRequest(1);
            });
        }

        async callAnthropic(prompt, isObject = false) {
             updateTokenStats(prompt.length, 0);
             return new Promise((resolve, reject) => {
                const options = {
                    method: 'POST',
                    headers: {
                        'x-api-key': this.config.anthropicKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        model: this.config.anthropicModel || 'claude-3-haiku-20240307',
                        max_tokens: 1024,
                        messages: [{role: 'user', content: prompt}]
                    }),
                    signal: STATE.abortController ? STATE.abortController.signal : null
                };

                this.network.request('https://api.anthropic.com/v1/messages', options).then(response => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.error) throw new Error(data.error.message);
                            const text = data.content[0].text.trim();
                            updateTokenStats(0, text.length);

                            if (STATE.config.debugMode) {
                                console.log('[LLM Raw Response]', text);
                            }

                            let cleanText = text.replace(/```json/g, '').replace(/```/g, '');
                            const firstBrace = cleanText.indexOf('{');
                            if (firstBrace !== -1) {
                                cleanText = cleanText.substring(firstBrace);
                            }

                            try {
                                resolve(JSON.parse(cleanText));
                            } catch (e) {
                                console.warn('JSON Parse failed. Attempting repair...');
                                const repaired = this.repairJSON(cleanText);
                                resolve(JSON.parse(repaired));
                            }
                        } catch (e) {
                             console.error('Anthropic Error', e, response.responseText);
                             reject(e); // Propagate error
                        }
                    }).catch(reject);
            });
        }
    }


const I18N = {
    en: {
        title: "Raindrop AI Sorter",
        dashboard: "Dashboard",
        settings: "Settings",
        prompts: "Prompts",
        help: "Help",
        collection: "Collection",
        mode: "Mode",
        search: "Search Filter",
        start: "Start",
        stop: "Stop",
        tokens: "Tokens",
        cost: "Est",
        tag_only: "Tag Bookmarks Only",
        organize: "Organize (Recursive Clusters)",
        full: "Full (Tag + Organize)",
        org_existing: "Organize (Existing Folders)",
        org_semantic: "Organize (Semantic)",
        org_freq: "Organize (Tag Frequency)",
        cleanup: "Cleanup Tags (Deduplicate)",
        prune: "Prune Infrequent Tags",
        flatten: "Flatten Library (Reset)",
        delete_all: "Delete ALL Tags",
        summarize: "Generate Newsletter / Summary",
        deduplicate: "Deduplicate Links",
        apply_macros: "Apply Macros (Recipes)",
        dry_run: "Dry Run",
        safe_mode: "Safe Mode",
        preset_name: "Enter preset name:",
        delete_preset: "Delete preset",
        confirm_delete_preset: "Delete preset \"{{name}}\"?",

        // New UI Labels & Tooltips
        lbl_language: "Language",
        tt_language: "Select the interface language.",
        lbl_raindrop_token: "Raindrop Test Token",
        tt_raindrop_token: "Your Raindrop.io API Test Token. Required for bookmark operations.",
        lbl_provider: "AI Provider",
        tt_provider: "The AI service to use for analyzing bookmarks.",
        lbl_openai_key: "OpenAI API Key",
        tt_openai_key: "Your OpenAI API Key (starts with sk-).",
        lbl_openai_model: "OpenAI Model",
        tt_openai_model: "The model to use (e.g. gpt-4o-mini).",
        lbl_anthropic_key: "Anthropic API Key",
        tt_anthropic_key: "Your Anthropic API Key (starts with sk-ant-).",
        lbl_anthropic_model: "Anthropic Model",
        tt_anthropic_model: "The model to use (e.g. claude-3-haiku-20240307).",
        lbl_groq_key: "Groq API Key",
        tt_groq_key: "Your Groq API Key.",
        lbl_groq_model: "Groq Model",
        tt_groq_model: "The model to use (e.g. llama3-70b-8192).",
        lbl_deepseek_key: "DeepSeek API Key",
        tt_deepseek_key: "Your DeepSeek API Key.",
        lbl_deepseek_model: "DeepSeek Model",
        tt_deepseek_model: "The model to use (e.g. deepseek-chat).",
        lbl_custom_url: "Base URL",
        tt_custom_url: "The API endpoint for your custom/local LLM.",
        lbl_custom_model: "Model Name",
        tt_custom_model: "The model name for your custom/local LLM.",
        lbl_concurrency: "Concurrency",
        tt_concurrency: "Number of bookmarks to process in parallel.",
        lbl_max_tags: "Max Tags",
        tt_max_tags: "Maximum number of tags to generate per bookmark.",
        lbl_min_tag_count: "Min Tag Count (Pruning)",
        tt_min_tag_count: "Tags used fewer than this many times will be deleted in Prune mode.",
        lbl_skip_tagged: "Skip tagged",
        tt_skip_tagged: "If checked, bookmarks that already have tags will be ignored.",
        lbl_dry_run: "Dry Run",
        tt_dry_run: "Simulate actions without making any changes.",
        lbl_tag_broken: "Tag Broken Links",
        tt_tag_broken: "If checked, adds a 'broken-link' tag to inaccessible URLs.",
        lbl_delete_empty: "Delete Empty Folders",
        tt_delete_empty: "If checked, removes collections that become empty after moving bookmarks.",
        lbl_nested_col: "Allow Nested Folders",
        tt_nested_col: "If checked, AI can create nested folder structures.",
        lbl_safe_mode: "Safe Mode",
        tt_safe_mode: "Requires multiple votes or high confidence before moving bookmarks.",
        lbl_min_votes: "Min Votes",
        lbl_review_clusters: "Review Actions",
        tt_review_clusters: "Pauses execution to let you manually approve proposed changes.",
        lbl_debug_mode: "Debug Logs",
        tt_debug_mode: "Enables detailed logging to the browser console.",
        lbl_config_mgmt: "Config Management",
        btn_export_config: "Export Settings",
        btn_import_config: "Import Settings",
        lbl_presets: "Presets",
        tt_presets: "Load or save prompt configurations.",
        lbl_tag_prompt: "Tagging Prompt {{CONTENT}}",
        tt_tag_prompt: "Prompt used for Tag Only mode. Must contain {{CONTENT}} placeholder.",
        lbl_cluster_prompt: "Clustering Prompt {{TAGS}}",
        tt_cluster_prompt: "Prompt used for Organize (Clusters) mode. Must contain {{TAGS}}.",
        lbl_class_prompt: "Classification Prompt {{BOOKMARK}}",
        tt_class_prompt: "Prompt used for Organize (Existing) mode. Must contain placeholders.",
        lbl_ignored_tags: "Ignored Tags",
        tt_ignored_tags: "Comma-separated list of tags to exclude from generation.",
        lbl_auto_describe: "Auto-describe",
        tt_auto_describe: "Generate a description for the bookmark.",
        lbl_use_vision: "Use Vision",
        tt_use_vision: "Use the bookmark's cover image for analysis.",
        lbl_desc_prompt: "Description Prompt",
        tt_desc_prompt: "Instructions for the description generation.",
        tt_collection: "The specific collection to process. 'All Bookmarks' includes everything.",
        tt_mode: "Select the operation mode.",
        tt_search_filter: "Process only bookmarks matching this query. e.g. '#unread'."
    },
    current: 'en',

    es: {
        title: "Clasificador IA de Raindrop",
        dashboard: "Tablero",
        settings: "Ajustes",
        prompts: "Prompts",
        help: "Ayuda",
        collection: "Colección",
        mode: "Modo",
        search: "Filtro de Búsqueda",
        start: "Iniciar",
        stop: "Detener",
        tag_only: "Solo Etiquetar",
        organize: "Organizar (Clusters)",
        full: "Completo (Etiquetar + Organizar)",
        org_existing: "Organizar (Carpetas Existentes)",
        org_semantic: "Organizar (Semántico)",
        cleanup: "Limpiar Etiquetas",
        prune: "Podar Etiquetas",
        flatten: "Aplanar Librería",
        delete_all: "Borrar TODAS las Etiquetas",
        summarize: "Generar Boletín / Resumen",
        deduplicate: "Deduplicar Enlaces",
        apply_macros: "Aplicar Macros (Recetas)",
        dry_run: "Simulacro",
        safe_mode: "Modo Seguro",
        preset_name: "Introduce el nombre del preset:",
        delete_preset: "Borrar preset",
        confirm_delete_preset: "¿Borrar preset \"{{name}}\"?",

        // New UI Labels & Tooltips (Spanish)
        lbl_language: "Idioma",
        tt_language: "Selecciona el idioma de la interfaz.",
        lbl_raindrop_token: "Token de Prueba de Raindrop",
        tt_raindrop_token: "Tu Token de API de Raindrop.io. Requerido.",
        lbl_provider: "Proveedor de IA",
        tt_provider: "El servicio de IA para analizar marcadores.",
        lbl_openai_key: "Clave API OpenAI",
        tt_openai_key: "Tu Clave API de OpenAI (empieza con sk-).",
        lbl_openai_model: "Modelo OpenAI",
        tt_openai_model: "El modelo a usar (ej. gpt-4o-mini).",
        lbl_anthropic_key: "Clave API Anthropic",
        tt_anthropic_key: "Tu Clave API de Anthropic (empieza con sk-ant-).",
        lbl_anthropic_model: "Modelo Anthropic",
        tt_anthropic_model: "El modelo a usar (ej. claude-3-haiku-20240307).",
        lbl_groq_key: "Clave API Groq",
        tt_groq_key: "Tu Clave API de Groq.",
        lbl_groq_model: "Modelo Groq",
        tt_groq_model: "El modelo a usar (ej. llama3-70b-8192).",
        lbl_deepseek_key: "Clave API DeepSeek",
        tt_deepseek_key: "Tu Clave API de DeepSeek.",
        lbl_deepseek_model: "Modelo DeepSeek",
        tt_deepseek_model: "El modelo a usar (ej. deepseek-chat).",
        lbl_custom_url: "URL Base",
        tt_custom_url: "El endpoint API para tu LLM local/personalizado.",
        lbl_custom_model: "Nombre del Modelo",
        tt_custom_model: "El nombre del modelo para tu LLM local.",
        lbl_concurrency: "Concurrencia",
        tt_concurrency: "Número de marcadores a procesar en paralelo.",
        lbl_max_tags: "Máx Etiquetas",
        tt_max_tags: "Número máximo de etiquetas por marcador.",
        lbl_min_tag_count: "Mín Recuento Etiquetas (Poda)",
        tt_min_tag_count: "Etiquetas usadas menos de este número serán borradas en modo Poda.",
        lbl_skip_tagged: "Saltar etiquetados",
        tt_skip_tagged: "Si marcado, ignora marcadores que ya tienen etiquetas.",
        lbl_dry_run: "Simulacro",
        tt_dry_run: "Simula acciones sin hacer cambios reales.",
        lbl_tag_broken: "Etiquetar Enlaces Rotos",
        tt_tag_broken: "Añade etiqueta 'broken-link' a URLs inaccesibles.",
        lbl_delete_empty: "Borrar Carpetas Vacías",
        tt_delete_empty: "Borra colecciones que quedan vacías tras mover marcadores.",
        lbl_nested_col: "Permitir Carpetas Anidadas",
        tt_nested_col: "Permite a la IA crear estructuras de carpetas anidadas.",
        lbl_safe_mode: "Modo Seguro",
        tt_safe_mode: "Requiere múltiples votos o alta confianza antes de mover.",
        lbl_min_votes: "Votos Mín",
        lbl_review_clusters: "Revisar Acciones",
        tt_review_clusters: "Pausa la ejecución para aprobar cambios manualmente.",
        lbl_debug_mode: "Logs de Depuración",
        tt_debug_mode: "Habilita logs detallados en la consola.",
        lbl_config_mgmt: "Gestión de Config",
        btn_export_config: "Exportar Ajustes",
        btn_import_config: "Importar Ajustes",
        lbl_presets: "Presets",
        tt_presets: "Cargar o guardar configuraciones de prompts.",
        lbl_tag_prompt: "Prompt Etiquetado {{CONTENT}}",
        tt_tag_prompt: "Prompt para modo Solo Etiquetar.",
        lbl_cluster_prompt: "Prompt Clustering {{TAGS}}",
        tt_cluster_prompt: "Prompt para modo Organizar (Clusters).",
        lbl_class_prompt: "Prompt Clasificación {{BOOKMARK}}",
        tt_class_prompt: "Prompt para modo Organizar (Existentes).",
        lbl_ignored_tags: "Etiquetas Ignoradas",
        tt_ignored_tags: "Lista separada por comas de etiquetas a excluir.",
        lbl_auto_describe: "Auto-describir",
        tt_auto_describe: "Generar descripción para el marcador.",
        lbl_use_vision: "Usar Visión",
        tt_use_vision: "Usar imagen de portada para análisis.",
        lbl_desc_prompt: "Prompt Descripción",
        tt_desc_prompt: "Instrucciones para generar la descripción.",
        tt_collection: "La colección específica a procesar.",
        tt_mode: "Selecciona el modo de operación.",
        tt_search_filter: "Procesar solo marcadores que coincidan con esta búsqueda."
    },

    get(key) {
        const lang = this[this.current] || this.en;
        return lang[key] || this.en[key] || key;
    }
};


const STYLES = `
    #ras-toggle-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: #007aff;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 24px;
        transition: transform 0.2s;
    }
    #ras-toggle-btn:hover { transform: scale(1.1); }

    #ras-container {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 350px;
        max-height: 80vh;
        background: var(--ras-bg, white);
        color: var(--ras-text, #333);
    }

    body.ras-dark-mode {
        --ras-bg: #1e1e1e;
        --ras-text: #eee;
        --ras-text-muted: #aaa;
        --ras-header-bg: #2d2d2d;
        --ras-border: #444;
        --ras-input-bg: #333;
        --ras-log-bg: #252525;
        border-radius: 12px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        border: 1px solid #e0e0e0;
        overflow: hidden;
    }

    #ras-header {
        background: var(--ras-header-bg, #f5f5f5);
        padding: 10px 15px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e0e0e0;
    }

    #ras-tabs {
        display: flex;
        background: var(--ras-bg, #fff);
        border-bottom: 1px solid #e0e0e0;
    }
    .ras-tab-btn {
        flex: 1;
        padding: 8px;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 12px;
        color: var(--ras-text-muted, #666);
        border-bottom: 2px solid transparent;
    }
    .ras-tab-btn.active {
        color: #007aff;
        border-bottom: 2px solid #007aff;
        font-weight: 500;
    }

    #ras-body {
        padding: 15px;
        overflow-y: auto;
        flex: 1;
    }

    .ras-tab-content { display: none; }
    .ras-tab-content.active { display: block; }

    .ras-field { margin-bottom: 12px; }
    .ras-field label { display: block; margin-bottom: 4px; color: var(--ras-text, #333); font-weight: 500; }
    .ras-field input[type="text"],
    .ras-field input[type="password"],
    .ras-field input[type="number"],
    .ras-field select,
    .ras-field textarea {
        width: 100%;
        padding: 6px;
        border: 1px solid var(--ras-border, #ddd);
        border-radius: 4px;
        font-size: 12px;
        box-sizing: border-box;
        background: var(--ras-input-bg, #fff);
        color: var(--ras-text, #333);
    }
    .ras-field textarea { resize: vertical; }

    .ras-btn {
        width: 100%;
        padding: 8px;
        background: #007aff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
    }
    .ras-btn:hover { opacity: 0.9; }
    .ras-btn.stop { background: #dc3545; }

    #ras-log {
        margin-top: 10px;
        max-height: 150px;
        overflow-y: auto;
        background: var(--ras-log-bg, #f9f9f9);
        padding: 5px;
        border: 1px solid var(--ras-border, #eee);
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
    }
    .ras-log-entry { margin-bottom: 2px; }
    .ras-log-error { color: #d32f2f; }
    .ras-log-success { color: #28a745; }
    .ras-log-warn { color: #f57f17; }

    #ras-tooltip-overlay {
        position: fixed;
        background: #333;
        color: white;
        padding: 5px 8px;
        border-radius: 4px;
        font-size: 11px;
        z-index: 10001;
        display: none;
        max-width: 200px;
        pointer-events: none;
    }
    .ras-tooltip-icon {
        display: inline-block;
        width: 14px;
        height: 14px;
        background: #ddd;
        color: #666;
        border-radius: 50%;
        text-align: center;
        line-height: 14px;
        font-size: 10px;
        cursor: help;
        margin-left: 4px;
    }

    #ras-stats-bar {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #666;
        margin-bottom: 8px;
        padding: 0 2px;
    }

    /* Review Panel */
    #ras-review-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        max-height: 80vh;
        background: white;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        border-radius: 8px;
        z-index: 10002;
        display: flex;
        flex-direction: column;
        border: 1px solid #ccc;
    }
    #ras-review-header {
        padding: 10px 15px;
        background: #f5f5f5;
        font-weight: bold;
        border-bottom: 1px solid #ddd;
        display: flex;
        justify-content: space-between;
    }
    #ras-review-body {
        padding: 10px;
        overflow-y: auto;
        flex: 1;
        background: #fff;
    }
    #ras-review-footer {
        padding: 10px;
        border-top: 1px solid #ddd;
        text-align: right;
        background: #f5f5f5;
    }
    .ras-review-item {
        display: flex;
        align-items: center;
        padding: 5px;
        border-bottom: 1px solid #eee;
        font-size: 12px;
    }
    .ras-review-item:last-child { border-bottom: none; }
    .ras-review-item input { margin-right: 8px; }

    /* Toast */
    #ras-toast-container {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10005;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .ras-toast {
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        transition: opacity 0.3s;
    }
    .ras-toast.error { background: #d32f2f; }
    .ras-toast.success { background: #28a745; }
`;

if (typeof window !== 'undefined') {
    window.RAS_STYLES = STYLES;
}


// The Curator: Advanced Query Builder for Raindrop.io

class QueryBuilder {
    constructor() {
        this.query = [];
    }

    addTerm(key, value, operator = 'AND') {
        this.query.push({ key, value, operator });
    }

    render() {
        return `
            <div id="ras-query-builder" style="border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #f9f9f9; margin-bottom: 10px;">
                <div style="font-weight:bold; margin-bottom:5px;">Query Builder</div>
                <div id="ras-query-rows">
                    <!-- Rows will be injected here -->
                </div>
                <div style="margin-top:10px;">
                    <button class="ras-btn" style="width:auto; padding: 4px 8px; font-size: 11px;" onclick="window.addQueryRow()">+ Add Condition</button>
                </div>
                <div style="margin-top:10px; border-top: 1px solid #eee; padding-top: 5px;">
                    <span style="font-size:11px; color:#666;">Preview:</span>
                    <code id="ras-query-preview" style="display:block; padding: 5px; background: #fff; border: 1px solid #eee; margin-top: 2px;"></code>
                </div>
            </div>
        `;
    }

    static generateQueryString(rows) {
        // Raindrop Search Syntax:
        // #tag
        // 'phrase'
        // key:val

        let parts = [];
        rows.forEach(row => {
            let part = "";
            const { type, value, operator } = row;

            if (type === 'tag') part = `#${value}`;
            else if (type === 'domain') part = `site:${value}`;
            else if (type === 'title') part = `title:${value}`;
            else if (type === 'content') part = `${value}`; // content search is default
            else if (type === 'status') part = `${value}`; // e.g. match:link

            if (operator === 'NOT') part = `-${part}`;

            parts.push(part);
        });

        return parts.join(' ');
    }
}

// Export for global usage if needed, mostly logic will be in ui.js integration
if (typeof window !== 'undefined') {
    window.QueryBuilder = QueryBuilder;
}


// The Architect: Structural Templates for Raindrop.io

class TemplateManager {
    static getTemplates() {
        return {
            "PARA": {
                description: "Projects, Areas, Resources, Archives (Tiago Forte)",
                structure: ["1. Projects", "2. Areas", "3. Resources", "4. Archives"]
            },
            "Dewey": {
                description: "Simplified Dewey Decimal System",
                structure: ["000 General", "100 Philosophy", "200 Religion", "300 Social", "400 Language", "500 Science", "600 Technology", "700 Arts", "800 Lit", "900 History"]
            },
            "Johnny.Decimal": {
                description: "Johnny.Decimal System (10-99 Categories)",
                structure: ["10-19 Finance", "20-29 Admin", "30-39 Marketing", "40-49 Sales", "50-59 Operations"]
            },
            "Simple": {
                description: "Basic topical organization",
                structure: ["Read Later", "Reference", "Tools", "Inspiration", "News"]
            }
        };
    }

    static getCustomTemplates() {
        return GM_getValue('customTemplates', {});
    }

    static saveCustomTemplate(name, structure) {
        const custom = this.getCustomTemplates();
        custom[name] = {
            description: "Custom Template",
            structure: structure.split('\n').map(s => s.trim()).filter(s => s)
        };
        GM_setValue('customTemplates', custom);
    }

    static deleteCustomTemplate(name) {
        const custom = this.getCustomTemplates();
        delete custom[name];
        GM_setValue('customTemplates', custom);
    }
}

// Export
if (typeof window !== 'undefined') {
    window.TemplateManager = TemplateManager;
}


// Templates UI Injector
// Needs to be called after the main UI is created

window.initTemplatesUI = function() {
    // 1. Add Tab Button if not present
    const tabsContainer = document.getElementById('ras-tabs');
    if (tabsContainer && !document.querySelector('[data-tab="templates"]')) {
        const btn = document.createElement('button');
        btn.className = 'ras-tab-btn';
        btn.setAttribute('data-tab', 'templates');
        btn.textContent = 'Templates'; // I18N later if needed

        // Insert before Help or Rules
        const helpBtn = tabsContainer.querySelector('[data-tab="help"]');
        tabsContainer.insertBefore(btn, helpBtn);

        btn.addEventListener('click', () => {
            // Standard tab switching logic
            document.querySelectorAll('.ras-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.ras-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');

            const tabContent = document.getElementById('ras-tab-templates');
            if(tabContent) {
                tabContent.classList.add('active');
                window.renderTemplatesTab(); // Refresh content
            }
        });
    }

    // 2. Add Tab Content Container if not present
    const bodyContainer = document.getElementById('ras-body');
    if(bodyContainer && !document.getElementById('ras-tab-templates')) {
        const div = document.createElement('div');
        div.id = 'ras-tab-templates';
        div.className = 'ras-tab-content';
        bodyContainer.appendChild(div);

        // Initial Render
        window.renderTemplatesTab();
    }
};

window.renderTemplatesTab = function() {
    const container = document.getElementById('ras-tab-templates');
    if(!container) return;

    // Check if innerHTML needs initialization
    if(container.innerHTML.trim() === '') {
         container.innerHTML = `
            <div style="margin-bottom:10px;">
                <label>Structural Schema</label>
                <select id="ras-template-select" style="width:100%; margin-bottom:5px;">
                    <option value="">None (Free form / Existing)</option>
                </select>
                <p style="font-size:11px; color:#666;" id="ras-template-desc"></p>
            </div>

            <div class="ras-field">
                <label>Preview Structure</label>
                <textarea id="ras-template-preview" rows="8" readonly style="background:#f5f5f5; font-family:monospace; font-size:11px;"></textarea>
            </div>

            <div style="border-top:1px solid #eee; padding-top:10px; margin-top:10px;">
                <label>Create Custom Schema</label>
                <input type="text" id="ras-custom-template-name" placeholder="Name (e.g. My System)" style="margin-bottom:5px;">
                <textarea id="ras-custom-template-body" rows="5" placeholder="Line 1\nLine 2..."></textarea>
                <button id="ras-save-template-btn" class="ras-btn" style="width:auto; margin-top:5px;">Save Template</button>
            </div>
         `;

         // Bind Events
         const sel = document.getElementById('ras-template-select');
         sel.addEventListener('change', () => {
             const val = sel.value;
             if(!val) {
                 document.getElementById('ras-template-desc').textContent = '';
                 document.getElementById('ras-template-preview').value = '';
                 return;
             }

             if(window.TemplateManager) {
                 const builtIn = window.TemplateManager.getTemplates();
                 const custom = window.TemplateManager.getCustomTemplates();

                 let t = builtIn[val] || custom[val];
                 if(t) {
                     document.getElementById('ras-template-desc').textContent = t.description;
                     document.getElementById('ras-template-preview').value = t.structure.join('\n');
                 }
             }
         });

         document.getElementById('ras-save-template-btn').addEventListener('click', () => {
             const name = document.getElementById('ras-custom-template-name').value;
             const body = document.getElementById('ras-custom-template-body').value;
             if(name && body && window.TemplateManager) {
                 window.TemplateManager.saveCustomTemplate(name, body);
                 alert('Template saved.');
                 window.refreshTemplateSelect();
                 // Select it
                 document.getElementById('ras-template-select').value = name;
                 document.getElementById('ras-template-select').dispatchEvent(new Event('change'));
             }
         });

         window.refreshTemplateSelect();
    }
};

window.refreshTemplateSelect = function() {
    const sel = document.getElementById('ras-template-select');
    if(!sel || !window.TemplateManager) return;

    // Save current selection
    const current = sel.value;

    sel.innerHTML = '<option value="">None (Free form / Existing)</option>';

    const builtIn = window.TemplateManager.getTemplates();
    const custom = window.TemplateManager.getCustomTemplates();

    const grp1 = document.createElement('optgroup');
    grp1.label = "Standard";
    Object.keys(builtIn).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.innerText = k;
        grp1.appendChild(opt);
    });
    sel.appendChild(grp1);

    if(Object.keys(custom).length > 0) {
        const grp2 = document.createElement('optgroup');
        grp2.label = "Custom";
        Object.keys(custom).forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.innerText = k;
            grp2.appendChild(opt);
        });
        sel.appendChild(grp2);
    }

    // Restore selection if possible
    if(current) sel.value = current;
};


const SettingsUI = {
    render() {
        const config = STATE.config;
        return `
            <div id="ras-tab-settings" class="ras-tab-content">
                <div class="ras-field">
                    <label>${I18N.get('lbl_language')} ${createTooltipIcon(I18N.get('tt_language'))}</label>
                    <select id="ras-language">
                        <option value="en" ${config.language === 'en' ? 'selected' : ''}>English</option>
                        <option value="es" ${config.language === 'es' ? 'selected' : ''}>Español</option>
                        <option value="de" ${config.language === 'de' ? 'selected' : ''}>Deutsch</option>
                        <option value="fr" ${config.language === 'fr' ? 'selected' : ''}>Français</option>
                        <option value="ja" ${config.language === 'ja' ? 'selected' : ''}>日本語</option>
                        <option value="zh" ${config.language === 'zh' ? 'selected' : ''}>中文</option>
                    </select>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_raindrop_token')} ${createTooltipIcon(I18N.get('tt_raindrop_token'))}</label>
                    <input type="password" id="ras-raindrop-token" value="${config.raindropToken}">
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_provider')} ${createTooltipIcon(I18N.get('tt_provider'))}</label>
                    <select id="ras-provider">
                        <option value="openai" ${config.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                        <option value="anthropic" ${config.provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                        <option value="groq" ${config.provider === 'groq' ? 'selected' : ''}>Groq</option>
                        <option value="deepseek" ${config.provider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                        <option value="custom" ${config.provider === 'custom' ? 'selected' : ''}>Custom / Local</option>
                    </select>
                </div>

                <div class="ras-field" id="ras-openai-group">
                    <label>${I18N.get('lbl_openai_key')} ${createTooltipIcon(I18N.get('tt_openai_key'))}</label>
                    <input type="password" id="ras-openai-key" value="${config.openaiKey}">
                </div>

                <div class="ras-field" id="ras-anthropic-group" style="display:none">
                    <label>${I18N.get('lbl_anthropic_key')} ${createTooltipIcon(I18N.get('tt_anthropic_key'))}</label>
                    <input type="password" id="ras-anthropic-key" value="${config.anthropicKey}">
                </div>

                <div class="ras-field" id="ras-groq-group" style="display:none">
                    <label>${I18N.get('lbl_groq_key')} ${createTooltipIcon(I18N.get('tt_groq_key'))}</label>
                    <input type="password" id="ras-groq-key" value="${config.groqKey || ''}">
                </div>

                <div class="ras-field" id="ras-deepseek-group" style="display:none">
                    <label>${I18N.get('lbl_deepseek_key')} ${createTooltipIcon(I18N.get('tt_deepseek_key'))}</label>
                    <input type="password" id="ras-deepseek-key" value="${config.deepseekKey || ''}">
                </div>

                <div id="ras-custom-group" style="display:none">
                     <div class="ras-field">
                        <label>${I18N.get('lbl_custom_url')} ${createTooltipIcon(I18N.get('tt_custom_url'))}</label>
                        <input type="text" id="ras-custom-url" placeholder="http://localhost:11434/v1" value="${config.customBaseUrl}">
                    </div>
                     <div class="ras-field">
                        <label>${I18N.get('lbl_custom_model')} ${createTooltipIcon(I18N.get('tt_custom_model'))}</label>
                        <input type="text" id="ras-custom-model" placeholder="llama3" value="${config.customModel}">
                    </div>
                </div>

                <div style="display:flex; gap: 10px;">
                    <div class="ras-field" style="flex:1">
                        <label>${I18N.get('lbl_concurrency')} ${createTooltipIcon(I18N.get('tt_concurrency'))}</label>
                        <input type="number" id="ras-concurrency" min="1" max="50" value="${config.concurrency}">
                    </div>
                    <div class="ras-field" style="flex:1">
                        <label>${I18N.get('lbl_max_tags')} ${createTooltipIcon(I18N.get('tt_max_tags'))}</label>
                        <input type="number" id="ras-max-tags" min="1" max="20" value="${config.maxTags}">
                    </div>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_min_tag_count')} ${createTooltipIcon(I18N.get('tt_min_tag_count'))}</label>
                    <input type="number" id="ras-min-tag-count" min="1" max="1000" value="${config.minTagCount}">
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-skip-tagged" ${config.skipTagged ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_skip_tagged')}
                    </label>
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-dry-run" ${config.dryRun ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_dry_run')}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-tag-broken" ${config.tagBrokenLinks ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_tag_broken')}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                         <input type="checkbox" id="ras-delete-empty" ${config.deleteEmptyCols ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_delete_empty')}
                    </label>
                    <label style="display:inline-flex; align-items:center;">
                         <input type="checkbox" id="ras-nested-collections" ${config.nestedCollections ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_nested_col')}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-semantic-dedupe" ${config.semanticDedupe ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_semantic_dedupe')} ${createTooltipIcon(I18N.get('tt_semantic_dedupe'))}
                    </label>
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-local-embeddings" ${config.localEmbeddings ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_local_embeddings')} ${createTooltipIcon(I18N.get('tt_local_embeddings'))}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-safe-mode" ${config.safeMode ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_safe_mode')} ${createTooltipIcon(I18N.get('tt_safe_mode'))}
                    </label>
                    <span id="ras-min-votes-container" style="${config.safeMode ? '' : 'display:none'}">
                        ${I18N.get('lbl_min_votes')}: <input type="number" id="ras-min-votes" min="1" max="10" value="${config.minVotes}" style="width: 40px;">
                    </span>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-review-clusters" ${config.reviewClusters ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_review_clusters')} ${createTooltipIcon(I18N.get('tt_review_clusters'))}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-debug-mode" ${config.debugMode ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_debug_mode')} ${createTooltipIcon(I18N.get('tt_debug_mode'))}
                    </label>
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-dark-mode" ${config.darkMode ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_dark_mode')}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-smart-triggers" ${config.smartTriggers ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_smart_triggers')} ${createTooltipIcon(I18N.get('tt_smart_triggers'))}
                    </label>
                </div>

                <div class="ras-field">
                    <label>Session Cost Budget Alert ($) ${createTooltipIcon('Pauses the execution and alerts you if estimated API cost for the session exceeds this value. Enter 0 to disable.')}</label>
                    <input type="number" id="ras-cost-budget" step="0.05" min="0" max="100" value="${config.costBudget || 0}">
                </div>

                <div class="ras-field" style="border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px;">
                    <label>${I18N.get('lbl_config_mgmt')}</label>
                    <div style="display:flex; gap: 5px;">
                        <button id="ras-export-config-btn" class="ras-btn" style="background:#6c757d;">${I18N.get('btn_export_config')}</button>
                        <button id="ras-import-config-btn" class="ras-btn" style="background:#6c757d;">${I18N.get('btn_import_config')}</button>
                        <input type="file" id="ras-import-file" style="display:none" accept=".json">
                    </div>
                </div>
            </div>
        `;
    },

    init() {
        document.getElementById('ras-provider').addEventListener('change', () => {
            this.updateProviderVisibility();
            window.saveConfig();
        });

        // Config Management
        document.getElementById('ras-export-config-btn').addEventListener('click', window.exportConfig);
        document.getElementById('ras-import-config-btn').addEventListener('click', () => {
            document.getElementById('ras-import-file').click();
        });
        document.getElementById('ras-import-file').addEventListener('change', window.importConfig);

        // Safe Mode Toggle
        document.getElementById('ras-safe-mode').addEventListener('change', (e) => {
             document.getElementById('ras-min-votes-container').style.display = e.target.checked ? 'inline' : 'none';
        });

        // Input Listeners
        const inputs = [
            'ras-language', 'ras-raindrop-token', 'ras-openai-key', 'ras-anthropic-key',
            'ras-groq-key', 'ras-deepseek-key', 'ras-skip-tagged', 'ras-custom-url',
            'ras-custom-model', 'ras-concurrency', 'ras-max-tags', 'ras-dry-run',
            'ras-nested-collections', 'ras-tag-broken', 'ras-debug-mode', 'ras-dark-mode',
            'ras-review-clusters', 'ras-min-tag-count', 'ras-delete-empty',
            'ras-safe-mode', 'ras-min-votes', 'ras-semantic-dedupe', 'ras-local-embeddings', 'ras-smart-triggers',
            'ras-cost-budget', 'ras-tag-prompt', 'ras-cluster-prompt', 'ras-class-prompt',
            'ras-ignored-tags', 'ras-auto-describe', 'ras-use-vision', 'ras-desc-prompt'
        ];

        inputs.forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.addEventListener('change', (e) => {
                    window.saveConfig();
                    if(e.target.id === 'ras-language') window.location.reload();
                });
            }
        });

        // Prompts tab toggles
        document.getElementById('ras-auto-describe').addEventListener('change', (e) => {
             document.getElementById('ras-desc-prompt-group').style.display = e.target.checked ? 'block' : 'none';
        });

        this.updateProviderVisibility();
    },

    updateProviderVisibility() {
        const val = document.getElementById('ras-provider').value;
        document.getElementById('ras-openai-group').style.display = val === 'openai' ? 'block' : 'none';
        document.getElementById('ras-anthropic-group').style.display = val === 'anthropic' ? 'block' : 'none';
        document.getElementById('ras-groq-group').style.display = val === 'groq' ? 'block' : 'none';
        document.getElementById('ras-deepseek-group').style.display = val === 'deepseek' ? 'block' : 'none';
        document.getElementById('ras-custom-group').style.display = val === 'custom' ? 'block' : 'none';
    },

    save() {
        STATE.config.raindropToken = document.getElementById('ras-raindrop-token').value;
        STATE.config.openaiKey = document.getElementById('ras-openai-key').value;
        STATE.config.anthropicKey = document.getElementById('ras-anthropic-key').value;
        STATE.config.groqKey = document.getElementById('ras-groq-key').value;
        STATE.config.deepseekKey = document.getElementById('ras-deepseek-key').value;
        STATE.config.provider = document.getElementById('ras-provider').value;
        STATE.config.skipTagged = document.getElementById('ras-skip-tagged').checked;
        STATE.config.customBaseUrl = document.getElementById('ras-custom-url').value;
        STATE.config.customModel = document.getElementById('ras-custom-model').value;
        STATE.config.concurrency = parseInt(document.getElementById('ras-concurrency').value) || 3;
        STATE.config.maxTags = parseInt(document.getElementById('ras-max-tags').value) || 5;
        STATE.config.dryRun = document.getElementById('ras-dry-run').checked;
        STATE.config.nestedCollections = document.getElementById('ras-nested-collections').checked;
        STATE.config.tagBrokenLinks = document.getElementById('ras-tag-broken').checked;
        STATE.config.debugMode = document.getElementById('ras-debug-mode').checked;
        STATE.config.darkMode = document.getElementById('ras-dark-mode').checked;

        if (STATE.config.darkMode) {
            document.body.classList.add('ras-dark-mode');
        } else {
            document.body.classList.remove('ras-dark-mode');
        }
        STATE.config.smartTriggers = document.getElementById('ras-smart-triggers').checked;
        STATE.config.reviewClusters = document.getElementById('ras-review-clusters').checked;
        STATE.config.minTagCount = parseInt(document.getElementById('ras-min-tag-count').value) || 2;
        STATE.config.deleteEmptyCols = document.getElementById('ras-delete-empty').checked;
        STATE.config.semanticDedupe = document.getElementById('ras-semantic-dedupe').checked;
        STATE.config.localEmbeddings = document.getElementById('ras-local-embeddings').checked;
        STATE.config.safeMode = document.getElementById('ras-safe-mode').checked;
        STATE.config.minVotes = parseInt(document.getElementById('ras-min-votes').value) || 2;
        STATE.config.language = document.getElementById('ras-language').value;
        STATE.config.costBudget = parseFloat(document.getElementById('ras-cost-budget').value) || 0;

        STATE.config.taggingPrompt = document.getElementById('ras-tag-prompt').value;
        STATE.config.clusteringPrompt = document.getElementById('ras-cluster-prompt').value;
        STATE.config.ignoredTags = document.getElementById('ras-ignored-tags').value;
        STATE.config.autoDescribe = document.getElementById('ras-auto-describe').checked;
        STATE.config.useVision = document.getElementById('ras-use-vision').checked;
        STATE.config.descriptionPrompt = document.getElementById('ras-desc-prompt').value;

        // Persist
        GM_setValue('language', STATE.config.language);
        GM_setValue('raindropToken', STATE.config.raindropToken);
        GM_setValue('openaiKey', STATE.config.openaiKey);
        GM_setValue('anthropicKey', STATE.config.anthropicKey);
        GM_setValue('groqKey', STATE.config.groqKey);
        GM_setValue('deepseekKey', STATE.config.deepseekKey);
        GM_setValue('provider', STATE.config.provider);
        GM_setValue('customBaseUrl', STATE.config.customBaseUrl);
        GM_setValue('customModel', STATE.config.customModel);
        GM_setValue('concurrency', STATE.config.concurrency);
        GM_setValue('maxTags', STATE.config.maxTags);
        GM_setValue('tagBrokenLinks', STATE.config.tagBrokenLinks);
        GM_setValue('reviewClusters', STATE.config.reviewClusters);
        GM_setValue('minTagCount', STATE.config.minTagCount);
        GM_setValue('deleteEmptyCols', STATE.config.deleteEmptyCols);
        GM_setValue('semanticDedupe', STATE.config.semanticDedupe);
        GM_setValue('localEmbeddings', STATE.config.localEmbeddings);
        GM_setValue('safeMode', STATE.config.safeMode);
        GM_setValue('minVotes', STATE.config.minVotes);
        GM_setValue('darkMode', STATE.config.darkMode);
        GM_setValue('smartTriggers', STATE.config.smartTriggers);
        GM_setValue('costBudget', STATE.config.costBudget);

        GM_setValue('taggingPrompt', STATE.config.taggingPrompt);
        GM_setValue('clusteringPrompt', STATE.config.clusteringPrompt);
        GM_setValue('ignoredTags', STATE.config.ignoredTags);
        GM_setValue('autoDescribe', STATE.config.autoDescribe);
        GM_setValue('useVision', STATE.config.useVision);
        GM_setValue('descriptionPrompt', STATE.config.descriptionPrompt);
    }
};

if (typeof window !== 'undefined') {
    window.SettingsUI = SettingsUI;
}


const RuleEngine = {
    getRules() {
        return GM_getValue('automationRules', []);
    },
    addRule(type, source, target) {
        const rules = this.getRules();
        // Dedup
        if (rules.find(r => r.type === type && r.source === source && r.target === target)) return;

        rules.push({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            type,
            source,
            target,
            created: Date.now()
        });
        GM_setValue('automationRules', rules);
        if(typeof log === 'function') log(`Rule saved: ${source} -> ${target}`, 'success');
    },
    deleteRule(id) {
        const rules = this.getRules();
        const newRules = rules.filter(r => r.id !== id);
        GM_setValue('automationRules', newRules);
        if(typeof log === 'function') log('Rule deleted.', 'info');
    },
    findRule(type, source) {
        const rules = this.getRules();
        return rules.find(r => r.type === type && r.source.toLowerCase() === source.toLowerCase());
    }
};

// Make globally available for UI and Logic
if (typeof window !== 'undefined') {
    window.RuleEngine = RuleEngine;
}


const MacrosUI = {
    render() {
        return `
            <div id="ras-tab-macros" class="ras-tab-content">
                <p style="font-size:12px; color:var(--ras-text-muted);">
                    Define IF/THEN automation recipes to process bookmarks without AI.
                </p>

                <div id="ras-macros-list" style="margin-bottom: 10px; max-height: 200px; overflow-y: auto; border: 1px solid var(--ras-border); padding: 5px; border-radius: 4px; background: var(--ras-input-bg);">
                    <!-- Macro Items Injected Here -->
                </div>

                <div style="border-top: 1px solid var(--ras-border); padding-top: 10px;">
                    <div style="font-weight:bold; margin-bottom:5px; font-size:12px;">Create New Recipe</div>

                    <div style="display:flex; gap:5px; margin-bottom:5px; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; width:30px;">IF</span>
                        <select id="ras-macro-condition" style="width:100px;">
                            <option value="has_tag">Has Tag</option>
                            <option value="no_tags">Has No Tags</option>
                            <option value="domain_is">Domain Is</option>
                            <option value="title_contains">Title Contains</option>
                        </select>
                        <input type="text" id="ras-macro-cond-val" placeholder="Value..." style="flex:1;">
                    </div>

                    <div style="display:flex; gap:5px; margin-bottom:5px; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; width:30px;">THEN</span>
                        <select id="ras-macro-action" style="width:100px;">
                            <option value="add_tag">Add Tag</option>
                            <option value="remove_tag">Remove Tag</option>
                            <option value="move_to">Move to Folder</option>
                        </select>
                        <input type="text" id="ras-macro-action-val" placeholder="Value (e.g. 'Finance' or '#receipt')..." style="flex:1;">
                    </div>

                    <button id="ras-save-macro-btn" class="ras-btn" style="width:auto; padding:4px 10px; font-size:11px;">Save Recipe</button>
                </div>
            </div>
        `;
    },

    init() {
        this.refreshList();

        document.getElementById('ras-save-macro-btn').addEventListener('click', () => {
            const cond = document.getElementById('ras-macro-condition').value;
            const condVal = document.getElementById('ras-macro-cond-val').value.trim();
            const action = document.getElementById('ras-macro-action').value;
            const actionVal = document.getElementById('ras-macro-action-val').value.trim();

            if (cond !== 'no_tags' && !condVal) {
                alert("Condition value required.");
                return;
            }
            if (!actionVal) {
                alert("Action value required.");
                return;
            }

            const macros = GM_getValue('macros', []);
            macros.push({
                id: Date.now().toString(),
                condition: cond,
                conditionValue: condVal,
                action: action,
                actionValue: actionVal
            });
            GM_setValue('macros', macros);

            // Reset inputs
            document.getElementById('ras-macro-cond-val').value = '';
            document.getElementById('ras-macro-action-val').value = '';

            this.refreshList();
            if(typeof log === 'function') log('Recipe saved.', 'success');
        });
    },

    refreshList() {
        const list = document.getElementById('ras-macros-list');
        if (!list) return;

        const macros = GM_getValue('macros', []);
        list.innerHTML = '';

        if (macros.length === 0) {
            list.innerHTML = '<div style="font-size:11px; color:var(--ras-text-muted); text-align:center; padding:10px;">No recipes defined.</div>';
            return;
        }

        macros.forEach(m => {
            const div = document.createElement('div');
            div.style = "display:flex; justify-content:space-between; align-items:center; padding: 5px; border-bottom: 1px solid var(--ras-border); font-size: 11px;";

            const condText = m.condition === 'no_tags' ? 'Has No Tags' : `${m.condition.replace('_', ' ')} "${m.conditionValue}"`;
            const actText = `${m.action.replace('_', ' ')} "${m.actionValue}"`;

            div.innerHTML = `
                <div style="flex:1;">
                    <span style="font-weight:bold; color:#007aff;">IF</span> ${condText}
                    <span style="font-weight:bold; color:#28a745; margin-left:5px;">THEN</span> ${actText}
                </div>
                <button class="ras-del-macro-btn" data-id="${m.id}" style="background:none; border:none; color:#d32f2f; cursor:pointer;">✖</button>
            `;
            list.appendChild(div);
        });

        document.querySelectorAll('.ras-del-macro-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                let macros = GM_getValue('macros', []);
                macros = macros.filter(m => m.id !== id);
                GM_setValue('macros', macros);
                this.refreshList();
            });
        });
    }
};

if (typeof window !== 'undefined') {
    window.MacrosUI = MacrosUI;
}


const SmartTriggers = {
    interval: null,

    start() {
        if (!STATE.config.smartTriggers || !STATE.config.raindropToken) return;

        // Run once shortly after load, then every 2 minutes
        setTimeout(() => this.runSilently(), 5000);
        this.interval = setInterval(() => this.runSilently(), 120000);
    },

    stop() {
        if (this.interval) clearInterval(this.interval);
    },

    async runSilently() {
        if (STATE.isRunning) return; // Don't interrupt manual runs

        const macros = GM_getValue('macros', []);
        if (macros.length === 0) return;

        try {
            // We need a dummy network client to pass to API
            const network = typeof NetworkClient !== 'undefined' ? new NetworkClient() : null;
            const api = new RaindropAPI(STATE.config.raindropToken, network);

            // Fetch newest bookmarks from Unsorted (Collection ID -1)
            const res = await api.getBookmarks(-1, 0, "");
            if (!res.items || res.items.length === 0) return;

            const needsCollections = macros.some(m => m.action === 'move_to');
            if (needsCollections) {
                await api.loadCollectionCache(true);
            }

            for (const bm of res.items) {
                let updatePayload = {};
                let newCollectionId = null;
                let tagsModified = false;
                let currentTags = new Set(bm.tags || []);

                for (const macro of macros) {
                    let match = false;

                    if (macro.condition === 'has_tag') {
                        match = currentTags.has(macro.conditionValue.toLowerCase().replace(/^#/, ''));
                    } else if (macro.condition === 'no_tags') {
                        match = currentTags.size === 0;
                    } else if (macro.condition === 'domain_is') {
                        match = bm.link.toLowerCase().includes(macro.conditionValue.toLowerCase());
                    } else if (macro.condition === 'title_contains') {
                        match = bm.title.toLowerCase().includes(macro.conditionValue.toLowerCase());
                    }

                    if (match) {
                        if (macro.action === 'add_tag') {
                            const tagToAdd = macro.actionValue.replace(/^#/, '').toLowerCase();
                            if (!currentTags.has(tagToAdd)) {
                                currentTags.add(tagToAdd);
                                tagsModified = true;
                                if(typeof log === 'function') log(`[Smart Trigger] Added tag "${tagToAdd}" to "${bm.title}"`);
                                console.log(`[Smart Trigger] Added tag "${tagToAdd}" to "${bm.title}"`);
                            }
                        } else if (macro.action === 'remove_tag') {
                            const tagToRemove = macro.actionValue.replace(/^#/, '').toLowerCase();
                            if (currentTags.has(tagToRemove)) {
                                currentTags.delete(tagToRemove);
                                tagsModified = true;
                                if(typeof log === 'function') log(`[Smart Trigger] Removed tag "${tagToRemove}" from "${bm.title}"`);
                                console.log(`[Smart Trigger] Removed tag "${tagToRemove}" from "${bm.title}"`);
                            }
                        } else if (macro.action === 'move_to') {
                            const targetName = macro.actionValue.toLowerCase();
                            const targetId = Object.keys(api.collectionCache).find(
                                id => api.collectionCache[id].title.toLowerCase() === targetName
                            );
                            if (targetId && targetId !== String(bm.collectionId)) {
                                newCollectionId = targetId;
                                if(typeof log === 'function') log(`[Smart Trigger] Moved "${bm.title}" to folder "${macro.actionValue}"`);
                                console.log(`[Smart Trigger] Moved "${bm.title}" to folder "${macro.actionValue}"`);
                            }
                        }
                    }
                }

                if (tagsModified) {
                    updatePayload.tags = Array.from(currentTags);
                }
                if (newCollectionId !== null) {
                    updatePayload.collectionId = parseInt(newCollectionId, 10);
                }

                if (Object.keys(updatePayload).length > 0) {
                    if (!STATE.config.dryRun) {
                        await api.updateBookmark(bm._id, updatePayload);
                    }
                }
            }
        } catch (e) {
            console.error("[Smart Triggers] Error:", e);
        }
    }
};

if (typeof window !== 'undefined') {
    window.SmartTriggers = SmartTriggers;
}


const SemanticGraphUI = {
    render() {
        return `
            <div id="ras-tab-graph" class="ras-tab-content" style="display:none; flex-direction:column; height:100%;">
                <div style="padding: 10px; background: var(--ras-header-bg); border-bottom: 1px solid var(--ras-border); display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; font-weight:bold;">Semantic Graph (Tags & Folders)</span>
                    <button id="ras-load-graph-btn" class="ras-btn" style="width:auto; padding:4px 10px; font-size:11px;">Generate Graph</button>
                </div>
                <div id="ras-graph-container" style="flex:1; position:relative; overflow:hidden; background: var(--ras-bg); min-height: 400px; border-bottom: 1px solid var(--ras-border);">
                    <div id="ras-graph-status" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:var(--ras-text-muted); font-size:12px; text-align:center;">
                        Click "Generate Graph" to map the relationships between your tags and collections.
                    </div>
                    <div id="ras-graph-canvas" style="width: 100%; height: 100%;"></div>
                </div>
            </div>
        `;
    },

    init() {
        const btn = document.getElementById('ras-load-graph-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                const status = document.getElementById('ras-graph-status');
                const canvas = document.getElementById('ras-graph-canvas');

                status.style.display = 'block';
                status.textContent = 'Loading library data...';
                canvas.innerHTML = ''; // Clear existing graph

                try {
                    await this.loadVisJs();
                    await this.buildGraph();
                    status.style.display = 'none';
                } catch (e) {
                    status.textContent = 'Error building graph: ' + e.message;
                    console.error('[SemanticGraph]', e);
                }
            });
        }
    },

    loadVisJs() {
        return new Promise((resolve, reject) => {
            if (typeof vis !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/vis-network/standalone/umd/vis-network.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load vis-network.js from unpkg'));
            document.head.appendChild(script);
        });
    },

    async buildGraph() {
        if (!STATE.config.raindropToken) {
            throw new Error("Raindrop token required.");
        }

        // We need network client
        const network = typeof NetworkClient !== 'undefined' ? new NetworkClient() : null;
        const api = new RaindropAPI(STATE.config.raindropToken, network);

        // Load collections to map IDs to Titles
        await api.loadCollectionCache(false);
        const collections = api.collectionCache || {};

        // Fetch ALL tags and their counts
        const allTags = await api.getAllTags();
        if (!allTags || allTags.length === 0) {
            throw new Error("No tags found to graph.");
        }

        // We need to fetch bookmarks to see co-occurrences of tags and collection mappings.
        // To not overwhelm the API, we fetch the first N pages (e.g., 500 items).
        let page = 0;
        let items = [];
        let hasMore = true;
        const MAX_PAGES = 5;

        document.getElementById('ras-graph-status').textContent = 'Analyzing co-occurrences...';

        while (hasMore && page < MAX_PAGES) {
            const res = await api.getBookmarks(0, page, "");
            if (!res.items || res.items.length === 0) {
                hasMore = false;
            } else {
                items = items.concat(res.items);
                page++;
            }
        }

        // --- Build Nodes and Edges ---

        const nodesData = [];
        const edgesData = [];
        const nodeMap = new Map(); // id -> node
        const edgeMap = new Map(); // "idA-idB" -> weight

        let nodeIdCounter = 1;

        // 1. Add Collection Nodes (Root level)
        Object.keys(collections).forEach(id => {
            const cId = `col_${id}`;
            nodeMap.set(cId, {
                id: cId,
                label: collections[id].title,
                group: 'collection',
                value: 20 // Base size
            });
        });

        // 'Unsorted' Collection
        nodeMap.set('col_-1', { id: 'col_-1', label: 'Unsorted', group: 'collection', value: 15 });

        // 2. Map Tags to Collections & Co-occurrences
        const tagCounts = {};

        items.forEach(bm => {
            const colId = `col_${bm.collectionId}`;
            const bmtags = bm.tags || [];

            bmtags.forEach(tag => {
                const tagId = `tag_${tag.toLowerCase()}`;

                // Track Tag count for size
                tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;

                // Add tag node if not exists
                if (!nodeMap.has(tagId)) {
                    nodeMap.set(tagId, {
                        id: tagId,
                        label: tag,
                        group: 'tag'
                    });
                }

                // Link Tag -> Collection
                const edgeKey1 = `${tagId}-${colId}`;
                edgeMap.set(edgeKey1, (edgeMap.get(edgeKey1) || 0) + 1);

                // Link Tag -> Tag (Co-occurrence in same bookmark)
                bmtags.forEach(otherTag => {
                    const otherTagId = `tag_${otherTag.toLowerCase()}`;
                    if (tagId !== otherTagId) {
                        // Sort IDs to prevent directionality (A->B == B->A)
                        const sorted = [tagId, otherTagId].sort();
                        const edgeKey2 = `${sorted[0]}-${sorted[1]}`;
                        edgeMap.set(edgeKey2, (edgeMap.get(edgeKey2) || 0) + 1);
                    }
                });
            });
        });

        // Update Tag node sizes
        nodeMap.forEach((node, id) => {
            if (node.group === 'tag') {
                node.value = (tagCounts[id] || 1) * 3;
            }
            nodesData.push(node);
        });

        // Filter edges to remove noise (weight < 2)
        edgeMap.forEach((weight, key) => {
            if (weight > 1) { // Min threshold for visibility
                const [from, to] = key.split('-');
                edgesData.push({
                    from: from,
                    to: to,
                    value: weight,
                    title: `Strength: ${weight}` // Tooltip
                });
            }
        });

        const container = document.getElementById('ras-graph-canvas');
        const data = {
            nodes: new vis.DataSet(nodesData),
            edges: new vis.DataSet(edgesData)
        };

        const options = {
            nodes: {
                shape: 'dot',
                scaling: { min: 10, max: 40 },
                font: { size: 12, face: 'Tahoma', color: STATE.config.darkMode ? '#fff' : '#333' }
            },
            edges: {
                color: { inherit: 'both', opacity: 0.5 },
                smooth: { type: 'continuous' }
            },
            groups: {
                collection: { color: { background: '#007aff', border: '#0056b3' } },
                tag: { color: { background: '#28a745', border: '#1e7e34' } }
            },
            physics: {
                forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 100, springConstant: 0.08 },
                maxVelocity: 50,
                solver: 'forceAtlas2Based',
                timestep: 0.35,
                stabilization: { iterations: 150 }
            },
            interaction: {
                tooltipDelay: 200,
                hideEdgesOnDrag: true
            }
        };

        new vis.Network(container, data, options);
    }
};

if (typeof window !== 'undefined') {
    window.SemanticGraphUI = SemanticGraphUI;
}


const LocalEmbeddings = {
    pipeline: null,
    extractor: null,
    statusEl: null,

    async init() {
        if (!STATE.config.localEmbeddings) return false;
        if (this.extractor) return true; // already loaded

        // Create a status toast or utilize existing UI
        if(typeof log === 'function') log('Downloading Local AI Model (~22MB). This only happens once...', 'info');

        try {
            // Load Transformers.js from CDN
            await this.loadScript();

            // Configure env to use WASM backend and cache models
            env.allowLocalModels = false;
            env.useBrowserCache = true;

            // Load the feature extraction pipeline (all-MiniLM-L6-v2 is small and fast)
            this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

            if(typeof log === 'function') log('Local AI Model ready.', 'success');
            return true;
        } catch (e) {
            console.error('[LocalEmbeddings] Error loading model:', e);
            if(typeof log === 'function') log('Failed to load Local AI Model.', 'error');
            return false;
        }
    },

    loadScript() {
        return new Promise((resolve, reject) => {
            if (typeof pipeline !== 'undefined') {
                resolve();
                return;
            }
            // Use module import for modern browsers
            import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1').then(module => {
                window.pipeline = module.pipeline;
                window.env = module.env;
                resolve();
            }).catch(e => {
                // Fallback to script tag if module import fails
                const script = document.createElement('script');
                script.type = 'module';
                script.innerHTML = `
                    import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';
                    window.pipeline = pipeline;
                    window.env = env;
                    window.transformersLoaded = true;
                `;
                document.head.appendChild(script);

                // Poll until loaded
                let attempts = 0;
                const check = setInterval(() => {
                    if (typeof pipeline !== 'undefined') {
                        clearInterval(check);
                        resolve();
                    }
                    if (++attempts > 50) {
                        clearInterval(check);
                        reject(new Error('Timeout loading transformers.js'));
                    }
                }, 100);
            });
        });
    },

    async getEmbedding(text) {
        if (!this.extractor) await this.init();
        if (!this.extractor) return null;

        try {
            // Generate embedding (returns a tensor)
            const output = await this.extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);
        } catch(e) {
            console.error('[LocalEmbeddings] Error extracting feature:', e);
            return null;
        }
    },

    // Cosine similarity between two vectors
    similarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
};

if (typeof window !== 'undefined') {
    window.LocalEmbeddings = LocalEmbeddings;
}


// Modern Preact Component using HTM (Hyperscript Tagged Markup)
// This serves as the first step towards a full React/Preact rewrite (Roadmap Phase 4).

const PreactStats = {
    loaded: false,

    async init() {
        if (this.loaded) return;

        try {
            await this.loadPreact();
            this.mountComponent();
            this.loaded = true;
        } catch(e) {
            console.error('[PreactStats] Failed to load Preact:', e);
        }
    },

    loadPreact() {
        return new Promise((resolve, reject) => {
            if (typeof preact !== 'undefined' && typeof htm !== 'undefined') {
                resolve();
                return;
            }
            // Use dynamic import for modern modules
            import('https://unpkg.com/htm/preact/standalone.module.js').then(module => {
                window.preact = module.preact || module;
                window.html = module.html;
                window.render = module.render;
                window.useState = module.useState;
                window.useEffect = module.useEffect;
                resolve();
            }).catch(e => reject(e));
        });
    },

    mountComponent() {
        const { html, render, useState, useEffect } = window;
        const I18N = window.I18N; // Global reference

        const StatsBar = () => {
            const [stats, setStats] = useState({ tokens: 0, cost: 0, progress: 0, isRunning: false });

            // Subscribe to state changes from StateManager via CustomEvents (or polling for this PoC)
            useEffect(() => {
                const checkState = () => {
                    if (window.STATE) {
                        let t = 0; let c = 0; let p = 0;
                        if (window.STATE.stats && window.STATE.stats.tokens) {
                            t = window.STATE.stats.tokens.input + window.STATE.stats.tokens.output;
                            c = (window.STATE.stats.tokens.input * 0.0000005) + (window.STATE.stats.tokens.output * 0.0000015);
                        }

                        // Parse progress from the DOM width since we don't have a state var for it yet
                        const pBar = document.getElementById('ras-progress-bar');
                        if (pBar) {
                            p = parseFloat(pBar.style.width) || 0;
                        }

                        setStats({
                            tokens: t,
                            cost: c,
                            progress: p,
                            isRunning: window.STATE.isRunning || false
                        });
                    }
                };

                const interval = setInterval(checkState, 500);
                return () => clearInterval(interval);
            }, []);

            return html`
                <div style="display:flex; flex-direction:column; width:100%; gap: 5px;">
                    ${stats.isRunning || stats.progress > 0 ? html`
                        <div style="background: var(--ras-border); height: 10px; border-radius: 5px; overflow: hidden; width: 100%;">
                            <div style="width: ${stats.progress}%; height: 100%; background: #28a745; transition: width 0.3s;"></div>
                        </div>
                    ` : null}

                    <div id="ras-stats-bar" style="display:flex; justify-content:space-between; font-size:11px; color:var(--ras-text-muted); background:var(--ras-header-bg); padding:5px; border-radius:4px; border: 1px solid var(--ras-border);">
                        <span>${I18N.get('tokens')}: ${(stats.tokens/1000).toFixed(1)}k</span>
                        <span style="font-weight:bold; color: ${stats.cost > 0 ? '#d32f2f' : 'inherit'}">${I18N.get('cost')}: $${stats.cost.toFixed(4)}</span>
                    </div>
                </div>
            `;
        };

        const target = document.getElementById('ras-preact-stats-mount');
        if (target) {
            render(html`<${StatsBar} />`, target);
        }
    }
};

if (typeof window !== 'undefined') {
    window.PreactStats = PreactStats;
}


    // Global Toast Function
    window.showToast = function(message, type='info') {
        let container = document.getElementById('ras-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'ras-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `ras-toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };

    // Global Query Builder Helpers
    window.addQueryRow = function() {
        const container = document.getElementById('ras-query-rows');
        const div = document.createElement('div');
        div.style = "display:flex; gap:5px; margin-bottom:5px;";
        div.innerHTML = `
            <select class="ras-query-operator" style="width:60px;">
                <option value="AND">AND</option>
                <option value="OR">OR</option>
                <option value="NOT">NOT</option>
            </select>
            <select class="ras-query-type" style="width:80px;">
                <option value="content">Any</option>
                <option value="tag">Tag</option>
                <option value="title">Title</option>
                <option value="domain">Domain</option>
            </select>
            <input type="text" class="ras-query-value" placeholder="Value..." style="flex:1;">
            <button class="ras-btn" style="width:auto; padding:2px 6px; background:#dc3545;" onclick="this.parentElement.remove(); window.updateQueryPreview();">X</button>
        `;
        container.appendChild(div);

        // Add listeners
        div.querySelectorAll('select, input').forEach(el => {
            el.addEventListener('change', window.updateQueryPreview);
            el.addEventListener('input', window.updateQueryPreview);
        });

        window.updateQueryPreview();
    };

    window.updateQueryPreview = function() {
        const rows = document.querySelectorAll('#ras-query-rows > div');
        if (rows.length === 0) {
            document.getElementById('ras-query-preview').textContent = '';
            document.getElementById('ras-search-input').value = '';
            return;
        }

        // Gather data for the shared helper
        const rowData = [];
        rows.forEach((row, index) => {
            const operator = row.querySelector('.ras-query-operator').value;
            const type = row.querySelector('.ras-query-type').value;
            const val = row.querySelector('.ras-query-value').value.trim();

            if(val) {
                rowData.push({ type, value: val, operator });
            }
        });

        // Use the shared class if available, otherwise fallback (or fail)
        let queryStr = "";
        if (window.QueryBuilder && window.QueryBuilder.generateQueryString) {
            queryStr = window.QueryBuilder.generateQueryString(rowData);
        } else {
            console.error("QueryBuilder class not found!");
        }

        document.getElementById('ras-query-preview').textContent = queryStr;
        document.getElementById('ras-search-input').value = queryStr;
    };

    // UI Construction
    function createUI() {
        I18N.current = STATE.config.language || 'en';

        // Inject CSS
        if (typeof GM_addStyle !== 'undefined' && window.RAS_STYLES) {
            GM_addStyle(window.RAS_STYLES);
        } else if (window.RAS_STYLES) {
            const style = document.createElement('style');
            style.textContent = window.RAS_STYLES;
            document.head.appendChild(style);
        }

        // Tooltip Overlay
        let tooltipOverlay = document.getElementById('ras-tooltip-overlay');
        if (!tooltipOverlay) {
            tooltipOverlay = document.createElement('div');
            tooltipOverlay.id = 'ras-tooltip-overlay';
            document.body.appendChild(tooltipOverlay);
        }

        document.addEventListener('mouseover', (e) => {
            if (e.target.classList.contains('ras-tooltip-icon')) {
                const text = e.target.getAttribute('data-tooltip');
                tooltipOverlay.textContent = text;
                tooltipOverlay.style.display = 'block';
                const rect = e.target.getBoundingClientRect();
                let top = rect.top - tooltipOverlay.offsetHeight - 8;
                let left = rect.left;
                if (top < 0) top = rect.bottom + 8;
                if (left + tooltipOverlay.offsetWidth > window.innerWidth) left = window.innerWidth - tooltipOverlay.offsetWidth - 10;
                tooltipOverlay.style.top = `${top}px`;
                tooltipOverlay.style.left = `${left}px`;
            }
        });
        document.addEventListener('mouseout', (e) => {
             if (e.target.classList.contains('ras-tooltip-icon')) {
                 tooltipOverlay.style.display = 'none';
             }
        });

        // Toggle Button
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'ras-toggle-btn';
        toggleBtn.innerHTML = '🤖';
        toggleBtn.onclick = togglePanel;
        document.body.appendChild(toggleBtn);

        // Main Panel
        const panel = document.createElement('div');
        panel.id = 'ras-container';
        panel.style.display = 'none';

        panel.innerHTML = `
            <div id="ras-header">
                ${I18N.get('title')} <span style="font-weight: normal; font-size: 11px; margin-left: 5px;">v1.0.26</span>
                <span id="ras-close-btn" style="cursor: pointer;">✖</span>
            </div>
            <div id="ras-tabs" style="overflow-x: auto; white-space: nowrap;">
                <button class="ras-tab-btn active" data-tab="dashboard">${I18N.get('dashboard')}</button>
                <button class="ras-tab-btn" data-tab="rules">Rules</button>
                <button class="ras-tab-btn" data-tab="macros">Macros</button>
                <button class="ras-tab-btn" data-tab="templates">Templates</button>
                <button class="ras-tab-btn" data-tab="graph">Graph</button>
                <button class="ras-tab-btn" data-tab="settings">${I18N.get('settings')}</button>
                <button class="ras-tab-btn" data-tab="prompts">${I18N.get('prompts')}</button>
                <button class="ras-tab-btn" data-tab="macros">Macros</button>
                <button class="ras-tab-btn" data-tab="rules">Rules</button>
                <button class="ras-tab-btn" data-tab="graph">Graph</button>
                <button class="ras-tab-btn" data-tab="help">${I18N.get('help')}</button>
            </div>
            <div id="ras-body">
                <!-- DASHBOARD TAB -->
                <div id="ras-tab-dashboard" class="ras-tab-content active">
                    <div class="ras-field">
                        <label>${I18N.get('collection')} ${createTooltipIcon(I18N.get('tt_collection'))}</label>
                        <select id="ras-collection-select">
                            <option value="0">All Bookmarks</option>
                            <option value="-1">Unsorted</option>
                        </select>
                    </div>

                    <div class="ras-field">
                        <label>${I18N.get('mode')} ${createTooltipIcon(I18N.get('tt_mode'))}</label>
                         <select id="ras-action-mode">
                            <optgroup label="AI Sorting">
                                <option value="tag_only">${I18N.get('tag_only')}</option>
                                <option value="organize_only">${I18N.get('organize')}</option>
                                <option value="full">${I18N.get('full')}</option>
                                <option value="organize_existing">${I18N.get('org_existing')}</option>
                                <option value="organize_semantic">${I18N.get('org_semantic')}</option>
                                <option value="organize_frequency">${I18N.get('org_freq')}</option>
                                <option value="summarize">${I18N.get('summarize')}</option>
                            </optgroup>
                            <optgroup label="Maintenance">
                                <option value="apply_macros">${I18N.get('apply_macros')}</option>
                                <option value="cleanup_tags">${I18N.get('cleanup')}</option>
                                <option value="deduplicate">${I18N.get('deduplicate')}</option>
                                <option value="prune_tags">${I18N.get('prune')}</option>
                                <option value="flatten">${I18N.get('flatten')}</option>
                                <option value="delete_all_tags">${I18N.get('delete_all')}</option>
                            </optgroup>
                        </select>
                    </div>

                    <!-- Query Builder Section -->
                    <div style="margin-bottom:12px;">
                        <label style="display:block;margin-bottom:4px;font-size:12px;color:#666;">Advanced Filter</label>
                        <div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">
                            <input type="checkbox" id="ras-show-query-builder">
                            <span style="font-size:11px;">Use Visual Query Builder</span>
                        </div>

                        <div id="ras-query-builder-container" style="display:none; border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #f9f9f9;">
                            <div id="ras-query-rows"></div>
                            <button class="ras-btn" style="width:auto; padding: 4px 8px; font-size: 11px; margin-top:5px;" onclick="window.addQueryRow()">+ Add Condition</button>
                            <div style="margin-top:10px; border-top: 1px solid #eee; padding-top: 5px;">
                                <span style="font-size:11px; color:#666;">Preview:</span>
                                <code id="ras-query-preview" style="display:block; padding: 5px; background: #fff; border: 1px solid #eee; margin-top: 2px;"></code>
                            </div>
                        </div>
                    </div>

                    <div class="ras-field">
                        <label>${I18N.get('lbl_search_filter')} ${createTooltipIcon(I18N.get('tt_search_filter'))}</label>
                        <input type="text" id="ras-search-input" placeholder="Optional search query...">
                    </div>

                    <div id="ras-preact-stats-mount" style="margin-bottom: 10px;">
                        <!-- Fallback / Initial State before Preact boots -->
                        <div id="ras-progress-container" style="display:none; margin-bottom: 5px; background: var(--ras-border); height: 10px; border-radius: 5px; overflow: hidden;">
                            <div id="ras-progress-bar" style="width: 0%; height: 100%; background: #28a745; transition: width 0.3s;"></div>
                        </div>

                    <div id="ras-stats-bar">
                        <span id="ras-stats-tokens">${I18N.get('tokens')}: 0</span>
                        <span id="ras-stats-cost">${I18N.get('cost')}: $0.00</span>
                    </div>

                    <div style="display:flex; gap: 5px; margin-bottom: 10px;">
                        <button id="ras-start-btn" class="ras-btn">${I18N.get('start')}</button>
                        <button id="ras-stop-btn" class="ras-btn stop" style="display:none">${I18N.get('stop')}</button>
                        <button id="ras-export-btn" class="ras-btn" style="background:#6c757d; width:auto; padding: 0 12px; font-size: 12px;" title="Download Audit Log">💾</button>
                        <button id="ras-debug-log-btn" class="ras-btn" style="background:#6c757d; width:auto; padding: 0 12px; font-size: 12px;" title="View Raw AI Logs">🔍</button>
                    </div>

                    <div id="ras-log"></div>
                </div>


                <!-- RULES TAB -->
                <div id="ras-tab-rules" class="ras-tab-content">
                    <h3>Smart Rules Engine</h3>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Rules automatically apply your confirmed tag merges and folder moves.</p>
                    <div id="ras-rules-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--ras-border); padding: 5px; background: var(--ras-input-bg);">
                        <table style="width:100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--ras-border);">
                                    <th style="padding: 4px;">Type</th>
                                    <th style="padding: 4px;">Source</th>
                                    <th style="padding: 4px;">Target</th>
                                    <th style="padding: 4px; text-align:right;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="ras-rules-tbody">
                                <!-- Rules populated dynamically -->
                            </tbody>
                        </table>
                    </div>
                    <button id="ras-refresh-rules-btn" class="ras-btn" style="margin-top: 10px;">Refresh Rules</button>
                </div>

                <!-- MACROS TAB -->
                <div id="ras-tab-macros" class="ras-tab-content">
                    <h3>Batch Macros (Recipes)</h3>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Define IF/THEN automation rules to run without AI.</p>
                    <div id="ras-macro-builder" style="margin-bottom: 15px; padding: 10px; border: 1px solid var(--ras-border); background: var(--ras-hover-bg); border-radius: 4px;">
                        <strong style="display:block; margin-bottom:5px;">Create New Macro</strong>
                        <div style="display:flex; gap:5px; margin-bottom:5px;">
                            <span style="line-height:24px;">IF</span>
                            <select id="ras-macro-cond-type" style="flex:1;">
                                <option value="domain_equals">Domain Equals</option>
                                <option value="has_tag">Has Tag</option>
                                <option value="title_contains">Title Contains</option>
                            </select>
                            <input type="text" id="ras-macro-cond-val" placeholder="e.g. github.com" style="flex:1;">
                        </div>
                        <div style="display:flex; gap:5px; margin-bottom:5px;">
                            <span style="line-height:24px;">THEN</span>
                            <select id="ras-macro-act-type" style="flex:1;">
                                <option value="add_tag">Add Tag</option>
                                <option value="move_to_folder">Move to Folder (Name)</option>
                            </select>
                            <input type="text" id="ras-macro-act-val" placeholder="e.g. open-source" style="flex:1;">
                        </div>
                        <button id="ras-add-macro-btn" class="ras-btn">Add Macro</button>
                    </div>
                    <div id="ras-macros-list" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--ras-border); padding: 5px; background: var(--ras-input-bg);">
                        <table style="width:100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                            <thead>
                                <tr style="border-bottom: 1px solid var(--ras-border);">
                                    <th style="padding: 4px;">Condition</th>
                                    <th style="padding: 4px;">Action</th>
                                    <th style="padding: 4px; text-align:right;">Remove</th>
                                </tr>
                            </thead>
                            <tbody id="ras-macros-tbody">
                                <!-- Macros populated dynamically -->
                            </tbody>
                        </table>
                    </div>
                    <button id="ras-run-macros-btn" class="ras-btn" style="margin-top: 10px; background: #28a745;">Run Macros Now</button>
                </div>

                <!-- TEMPLATES TAB -->
                <div id="ras-tab-templates" class="ras-tab-content">
                    <h3>The Architect (Templates)</h3>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Apply pre-defined folder structures (PARA, Dewey Decimal, etc).</p>
                    <div class="ras-field">
                        <select id="ras-template-select">
                            <option value="para">P.A.R.A Method</option>
                            <option value="dewey">Dewey Decimal System</option>
                            <option value="academic">Academic Research</option>
                        </select>
                    </div>
                    <button id="ras-apply-template-btn" class="ras-btn">Apply Template</button>
                </div>

                <!-- GRAPH TAB -->
                <div id="ras-tab-graph" class="ras-tab-content">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3>Semantic Graph</h3>
                        <button id="ras-render-graph-btn" class="ras-btn" style="width:auto; padding:4px 12px;">Render Graph</button>
                    </div>
                    <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Visual map of tags. (Requires vis-network.js)</p>
                    <div id="ras-graph-container" style="width: 100%; height: 350px; background: #fafafa; border: 1px solid #ccc; text-align: center; line-height: 350px;">
                        <em>Graph Visualization Pending</em>
                    </div>
                </div>

                <!-- SETTINGS TAB -->
                <div id="ras-tab-settings" class="ras-tab-content">
                    <div class="ras-field">
                        <label>${I18N.get('lbl_language')} ${createTooltipIcon(I18N.get('tt_language'))}</label>
                        <select id="ras-language">
                            <option value="en" ${STATE.config.language === 'en' ? 'selected' : ''}>English</option>
                            <option value="es" ${STATE.config.language === 'es' ? 'selected' : ''}>Español</option>
                        </select>
                    </div>

                    <div class="ras-field">
                        <label>${I18N.get('lbl_raindrop_token')} ${createTooltipIcon(I18N.get('tt_raindrop_token'))}</label>
                        <input type="password" id="ras-raindrop-token" value="${STATE.config.raindropToken}">
                    </div>

                    <div class="ras-field">
                        <label>${I18N.get('lbl_provider')} ${createTooltipIcon(I18N.get('tt_provider'))}</label>
                        <select id="ras-provider">
                            <option value="openai" ${STATE.config.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                            <option value="anthropic" ${STATE.config.provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                            <option value="groq" ${STATE.config.provider === 'groq' ? 'selected' : ''}>Groq</option>
                            <option value="deepseek" ${STATE.config.provider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                            <option value="custom" ${STATE.config.provider === 'custom' ? 'selected' : ''}>Custom / Local</option>
                        </select>
                    </div>

                    <div class="ras-field" id="ras-openai-group">
                        <label>${I18N.get('lbl_openai_key')} ${createTooltipIcon(I18N.get('tt_openai_key'))}</label>
                        <input type="password" id="ras-openai-key" value="${STATE.config.openaiKey}">
                        <label style="margin-top:5px;">${I18N.get('lbl_openai_model')} ${createTooltipIcon(I18N.get('tt_openai_model'))}</label>
                        <input type="text" id="ras-openai-model" value="${STATE.config.openaiModel || 'gpt-4o-mini'}" placeholder="gpt-4o-mini">
                    </div>

                    <div class="ras-field" id="ras-anthropic-group" style="display:none">
                        <label>${I18N.get('lbl_anthropic_key')} ${createTooltipIcon(I18N.get('tt_anthropic_key'))}</label>
                        <input type="password" id="ras-anthropic-key" value="${STATE.config.anthropicKey}">
                        <label style="margin-top:5px;">${I18N.get('lbl_anthropic_model')} ${createTooltipIcon(I18N.get('tt_anthropic_model'))}</label>
                        <input type="text" id="ras-anthropic-model" value="${STATE.config.anthropicModel || 'claude-3-haiku-20240307'}" placeholder="claude-3-haiku-20240307">
                    </div>

                    <div class="ras-field" id="ras-groq-group" style="display:none">
                        <label>${I18N.get('lbl_groq_key')} ${createTooltipIcon(I18N.get('tt_groq_key'))}</label>
                        <input type="password" id="ras-groq-key" value="${STATE.config.groqKey || ''}">
                        <label style="margin-top:5px;">${I18N.get('lbl_groq_model')} ${createTooltipIcon(I18N.get('tt_groq_model'))}</label>
                        <input type="text" id="ras-groq-model" value="${STATE.config.groqModel || 'llama3-70b-8192'}" placeholder="llama3-70b-8192">
                    </div>

                    <div class="ras-field" id="ras-deepseek-group" style="display:none">
                        <label>${I18N.get('lbl_deepseek_key')} ${createTooltipIcon(I18N.get('tt_deepseek_key'))}</label>
                        <input type="password" id="ras-deepseek-key" value="${STATE.config.deepseekKey || ''}">
                        <label style="margin-top:5px;">${I18N.get('lbl_deepseek_model')} ${createTooltipIcon(I18N.get('tt_deepseek_model'))}</label>
                        <input type="text" id="ras-deepseek-model" value="${STATE.config.deepseekModel || 'deepseek-chat'}" placeholder="deepseek-chat">
                    </div>

                    <div id="ras-custom-group" style="display:none">
                         <div class="ras-field">
                            <label>${I18N.get('lbl_custom_url')} ${createTooltipIcon(I18N.get('tt_custom_url'))}</label>
                            <input type="text" id="ras-custom-url" placeholder="http://localhost:11434/v1" value="${STATE.config.customBaseUrl}">
                        </div>
                         <div class="ras-field">
                            <label>${I18N.get('lbl_custom_model')} ${createTooltipIcon(I18N.get('tt_custom_model'))}</label>
                            <input type="text" id="ras-custom-model" placeholder="llama3" value="${STATE.config.customModel}">
                        </div>
                    </div>

                    <div style="display:flex; gap: 10px;">
                        <div class="ras-field" style="flex:1">
                            <label>${I18N.get('lbl_concurrency')} ${createTooltipIcon(I18N.get('tt_concurrency'))}</label>
                            <input type="number" id="ras-concurrency" min="1" max="50" value="${STATE.config.concurrency}">
                        </div>
                        <div class="ras-field" style="flex:1">
                            <label>${I18N.get('lbl_max_tags')} ${createTooltipIcon(I18N.get('tt_max_tags'))}</label>
                            <input type="number" id="ras-max-tags" min="1" max="20" value="${STATE.config.maxTags}">
                        </div>
                    </div>

                    <div class="ras-field">
                        <label>${I18N.get('lbl_min_tag_count')} ${createTooltipIcon(I18N.get('tt_min_tag_count'))}</label>
                        <input type="number" id="ras-min-tag-count" min="1" max="1000" value="${STATE.config.minTagCount}">
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                            <input type="checkbox" id="ras-skip-tagged" ${STATE.config.skipTagged ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_skip_tagged')} ${createTooltipIcon(I18N.get('tt_skip_tagged'))}
                        </label>
                        <label style="display:inline-flex; align-items:center;">
                            <input type="checkbox" id="ras-dry-run" ${STATE.config.dryRun ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_dry_run')} ${createTooltipIcon(I18N.get('tt_dry_run'))}
                        </label>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                            <input type="checkbox" id="ras-tag-broken" ${STATE.config.tagBrokenLinks ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_tag_broken')} ${createTooltipIcon(I18N.get('tt_tag_broken'))}
                        </label>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                             <input type="checkbox" id="ras-delete-empty" ${STATE.config.deleteEmptyCols ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_delete_empty')} ${createTooltipIcon(I18N.get('tt_delete_empty'))}
                        </label>
                        <label style="display:inline-flex; align-items:center;">
                             <input type="checkbox" id="ras-nested-collections" ${STATE.config.nestedCollections ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_nested_col')} ${createTooltipIcon(I18N.get('tt_nested_col'))}
                        </label>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                            <input type="checkbox" id="ras-safe-mode" ${STATE.config.safeMode ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_safe_mode')} ${createTooltipIcon(I18N.get('tt_safe_mode'))}
                        </label>
                        <span id="ras-min-votes-container" style="${STATE.config.safeMode ? '' : 'display:none'}">
                            ${I18N.get('lbl_min_votes')}: <input type="number" id="ras-min-votes" min="1" max="10" value="${STATE.config.minVotes}" style="width: 40px;">
                        </span>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-flex; align-items:center;">
                            <input type="checkbox" id="ras-review-clusters" ${STATE.config.reviewClusters ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_review_clusters')} ${createTooltipIcon(I18N.get('tt_review_clusters'))}
                        </label>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-flex; align-items:center;">
                            <input type="checkbox" id="ras-debug-mode" ${STATE.config.debugMode ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_debug_mode')} ${createTooltipIcon(I18N.get('tt_debug_mode'))}
                        </label>
                    </div>

                    <div class="ras-field" style="border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px;">
                        <label>${I18N.get('lbl_config_mgmt')}</label>
                        <div style="display:flex; gap: 5px;">
                            <button id="ras-export-config-btn" class="ras-btn" style="background:#6c757d;">${I18N.get('btn_export_config')}</button>
                            <button id="ras-import-config-btn" class="ras-btn" style="background:#6c757d;">${I18N.get('btn_import_config')}</button>
                            <input type="file" id="ras-import-file" style="display:none" accept=".json">
                        </div>
                    </div>
                </div>

                <!-- PROMPTS TAB -->
                <div id="ras-tab-prompts" class="ras-tab-content">
                    <div class="ras-field" style="border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                        <label>${I18N.get('lbl_presets')} ${createTooltipIcon(I18N.get('tt_presets'))}</label>
                        <div style="display:flex; gap:5px;">
                            <select id="ras-prompt-preset-select" style="flex-grow:1;">
                                <option value="">Select a preset...</option>
                            </select>
                            <button id="ras-save-preset-btn" class="ras-btn" style="width:auto; padding: 2px 8px;">Save</button>
                            <button id="ras-delete-preset-btn" class="ras-btn" style="width:auto; padding: 2px 8px; background:#dc3545;">Del</button>
                        </div>
                    </div>

                    <div class="ras-field">
                        <label>${I18N.get('lbl_tag_prompt')} ${createTooltipIcon(I18N.get('tt_tag_prompt'))}</label>
                        <textarea id="ras-tag-prompt" rows="6">${STATE.config.taggingPrompt}</textarea>
                    </div>

                    <div class="ras-field">
                        <label>${I18N.get('lbl_cluster_prompt')} ${createTooltipIcon(I18N.get('tt_cluster_prompt'))}</label>
                        <textarea id="ras-cluster-prompt" rows="6">${STATE.config.clusteringPrompt}</textarea>
                    </div>

                     <div class="ras-field">
                        <label>${I18N.get('lbl_class_prompt')} ${createTooltipIcon(I18N.get('tt_class_prompt'))}</label>
                        <textarea id="ras-class-prompt" rows="6">${STATE.config.classificationPrompt}</textarea>
                    </div>

                    <div class="ras-field">
                        <label>${I18N.get('lbl_ignored_tags')} ${createTooltipIcon(I18N.get('tt_ignored_tags'))}</label>
                        <textarea id="ras-ignored-tags" rows="2">${STATE.config.ignoredTags}</textarea>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                            <input type="checkbox" id="ras-auto-describe" ${STATE.config.autoDescribe ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_auto_describe')} ${createTooltipIcon(I18N.get('tt_auto_describe'))}
                        </label>
                        <label style="display:inline-flex; align-items:center;">
                            <input type="checkbox" id="ras-use-vision" ${STATE.config.useVision ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_use_vision')} ${createTooltipIcon(I18N.get('tt_use_vision'))}
                        </label>
                    </div>
                    <div class="ras-field" id="ras-desc-prompt-group" style="display:none">
                        <label>${I18N.get('lbl_desc_prompt')} ${createTooltipIcon(I18N.get('tt_desc_prompt'))}</label>
                        <textarea id="ras-desc-prompt" rows="3">${STATE.config.descriptionPrompt}</textarea>
                    </div>
                </div>

                <!-- MACROS TAB -->
                ${typeof MacrosUI !== 'undefined' ? MacrosUI.render() : ''}

                <!-- RULES TAB -->
                <div id="ras-tab-rules" class="ras-tab-content">
                    <p style="font-size:12px; color:#666;">Saved rules for Tag Merges and Folder Moves.</p>
                    <div id="ras-rules-list" style="max-height:300px; overflow-y:auto; margin-bottom:10px;"></div>
                    <button id="ras-refresh-rules" class="ras-btn" style="background:#6c757d; width:auto;">Refresh Rules</button>
                </div>

                <!-- GRAPH TAB -->
                ${typeof SemanticGraphUI !== 'undefined' ? SemanticGraphUI.render() : ''}

                <!-- HELP TAB -->
                <div id="ras-tab-help" class="ras-tab-content">
                    <div style="font-size:12px; line-height:1.5; color:var(--ras-text);">
                        <p><strong>Modes:</strong></p>
                        <ul style="padding-left:15px; margin:5px 0;">
                            <li><b>${I18N.get('tag_only')}:</b> Adds tags to bookmarks using AI.</li>
                            <li><b>${I18N.get('organize')}:</b> Clusters tags and moves bookmarks into folders.</li>
                            <li><b>${I18N.get('cleanup')}:</b> Merges duplicate/synonym tags.</li>
                            <li><b>${I18N.get('flatten')}:</b> Moves all items to Unsorted and deletes empty folders.</li>
                        </ul>
                        <p><strong>Tips:</strong></p>
                        <ul style="padding-left:15px; margin:5px 0;">
                            <li>Use <b>Dry Run</b> first to see what will happen.</li>
                            <li><b>Safe Mode</b> ensures high confidence before moving.</li>
                            <li>Use <b>Search Filter</b> to target specific items (e.g. <code>#unread</code>).</li>
                        </ul>
                        <p><strong>Links:</strong></p>
                        <p><a href="https://developer.raindrop.io" target="_blank" style="color:#007aff;">Raindrop API Docs</a></p>
                    </div>
                </div>

                <div id="ras-review-panel" style="display:none">
                    <div id="ras-review-header">
                        <span>${I18N.get('lbl_review_clusters')}</span>
                        <span id="ras-review-count"></span>
                    </div>
                    <div id="ras-review-body"></div>
                    <div id="ras-review-footer">
                        <button id="ras-review-cancel" class="ras-btn" style="background:#ccc;color:#333;margin-right:10px">Cancel</button>
                        <button id="ras-review-confirm" class="ras-btn">Approve & Move</button>
                    </div>
                </div>

                <div id="ras-debug-modal" style="display:none; position:fixed; top:5%; left:5%; width:90%; height:90%; background:var(--ras-bg, white); z-index:20000; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.5); flex-direction:column; border:1px solid var(--ras-border);">
                    <div style="padding:10px; background:var(--ras-header-bg); border-bottom:1px solid var(--ras-border); display:flex; justify-content:space-between; align-items:center;">
                        <b>Raw AI Diagnostics Log</b>
                        <button id="ras-debug-close" class="ras-btn" style="width:auto; padding:4px 8px; background:#dc3545;">Close</button>
                    </div>
                    <div id="ras-debug-content" style="flex:1; overflow:auto; padding:10px; font-family:monospace; font-size:11px; white-space:pre-wrap; background:var(--ras-input-bg);"></div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Tab Switching Logic
        const tabBtns = document.querySelectorAll('.ras-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active
                document.querySelectorAll('.ras-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.ras-tab-content').forEach(c => c.classList.remove('active'));
                // Add active
                btn.classList.add('active');
                document.getElementById(`ras-tab-${btn.dataset.tab}`).classList.add('active');
            });
        });

        // Close Button
        document.getElementById('ras-close-btn').addEventListener('click', togglePanel);

        // Keyboard Shortcut (Alt+Shift+S)
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.shiftKey && e.code === 'KeyS') {
                togglePanel();
            }
        });

        // Initialize Settings
        if (typeof SettingsUI !== 'undefined') {
            SettingsUI.init();
        } else {
             console.warn("SettingsUI not loaded");
        }

        if (typeof MacrosUI !== 'undefined') {
            MacrosUI.init();
        }

        document.getElementById('ras-start-btn').addEventListener('click', startSorting);
        document.getElementById('ras-stop-btn').addEventListener('click', stopSorting);
        document.getElementById('ras-export-btn').addEventListener('click', exportAuditLog);

        document.getElementById('ras-debug-log-btn').addEventListener('click', () => {
            const modal = document.getElementById('ras-debug-modal');
            const content = document.getElementById('ras-debug-content');
            modal.style.display = 'flex';
            if (STATE.aiDiagnosticsLog && STATE.aiDiagnosticsLog.length > 0) {
                content.textContent = STATE.aiDiagnosticsLog.join('\n\n----------------------------------------\n\n');
            } else {
                content.textContent = "No AI requests logged in this session.\nMake sure 'Debug Logs' is enabled in Settings.";
            }
        });

        document.getElementById('ras-debug-close').addEventListener('click', () => {
            document.getElementById('ras-debug-modal').style.display = 'none';
        });

        // Rules Refresh
        document.getElementById('ras-refresh-rules').addEventListener('click', renderRules);

        function renderRules() {
            const container = document.getElementById('ras-rules-list');
            if(!container) return;
            container.innerHTML = '';

            // Assuming RuleEngine is globally available (will be in logic.js)
            if (typeof RuleEngine === 'undefined') {
                container.innerHTML = '<i>RuleEngine not loaded.</i>';
                return;
            }

            const rules = RuleEngine.getRules();
            if (rules.length === 0) {
                container.innerHTML = '<i>No saved rules.</i>';
                return;
            }

            rules.forEach(rule => {
                const div = document.createElement('div');
                div.style = "border-bottom:1px solid #eee; padding:5px 0; font-size:11px; display:flex; justify-content:space-between; align-items:center;";
                div.innerHTML = `
                    <span>
                        <b>${rule.type.toUpperCase()}</b>:
                        ${rule.source} &rarr; ${rule.target}
                    </span>
                    <button class="ras-btn-del-rule" data-id="${rule.id}" style="background:none; border:none; color:red; cursor:pointer;">✖</button>
                `;
                container.appendChild(div);
            });

            document.querySelectorAll('.ras-btn-del-rule').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    RuleEngine.deleteRule(e.target.dataset.id);
                    renderRules();
                });
            });
        }
        // Initial render of rules when tab is clicked?
        document.querySelector('.ras-tab-btn[data-tab="rules"]').addEventListener('click', renderRules);


        // Preset Logic
        function updatePresetDropdown() {
            const presets = GM_getValue('promptPresets', {});
            const sel = document.getElementById('ras-prompt-preset-select');
            const current = sel.value;
            sel.innerHTML = '<option value="">Select a preset...</option>';
            Object.keys(presets).forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.innerText = k;
                sel.appendChild(opt);
            });
            if (presets[current]) sel.value = current;
        }

        document.getElementById('ras-save-preset-btn').addEventListener('click', () => {
            const name = prompt(I18N.get('preset_name'));
            if(!name) return;
            const presets = GM_getValue('promptPresets', {});
            presets[name] = {
                tagging: document.getElementById('ras-tag-prompt').value,
                clustering: document.getElementById('ras-cluster-prompt').value,
                classification: document.getElementById('ras-class-prompt') ? document.getElementById('ras-class-prompt').value : ''
            };
            GM_setValue('promptPresets', presets);
            updatePresetDropdown();
            document.getElementById('ras-prompt-preset-select').value = name;
        });

        document.getElementById('ras-delete-preset-btn').addEventListener('click', () => {
            const sel = document.getElementById('ras-prompt-preset-select');
            const name = sel.value;
            if(!name) return;
            if(confirm(I18N.get('confirm_delete_preset').replace('{{name}}', name))) {
                const presets = GM_getValue('promptPresets', {});
                delete presets[name];
                GM_setValue('promptPresets', presets);
                updatePresetDropdown();
            }
        });

        document.getElementById('ras-prompt-preset-select').addEventListener('change', (e) => {
            const name = e.target.value;
            if(!name) return;
            const presets = GM_getValue('promptPresets', {});
            if(presets[name]) {
                document.getElementById('ras-tag-prompt').value = presets[name].tagging || '';
                document.getElementById('ras-cluster-prompt').value = presets[name].clustering || '';
                if(document.getElementById('ras-class-prompt')) {
                    document.getElementById('ras-class-prompt').value = presets[name].classification || '';
                }
                if (typeof window.saveConfig === 'function') {
                    window.saveConfig();
                } else if(SettingsUI && SettingsUI.save) {
                    SettingsUI.save();
                }
            }
        });
        updatePresetDropdown();

        // Input listeners to save config
        ['ras-language', 'ras-raindrop-token', 'ras-openai-key', 'ras-openai-model', 'ras-anthropic-key', 'ras-anthropic-model', 'ras-groq-key', 'ras-groq-model', 'ras-deepseek-key', 'ras-deepseek-model', 'ras-skip-tagged', 'ras-custom-url', 'ras-custom-model', 'ras-concurrency', 'ras-max-tags', 'ras-dry-run', 'ras-tag-prompt', 'ras-cluster-prompt', 'ras-class-prompt', 'ras-ignored-tags', 'ras-auto-describe', 'ras-use-vision', 'ras-desc-prompt', 'ras-nested-collections', 'ras-tag-broken', 'ras-debug-mode', 'ras-review-clusters', 'ras-min-tag-count', 'ras-delete-empty', 'ras-safe-mode', 'ras-min-votes'].forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.addEventListener('change', (e) => {
                    saveConfig();
                    if(e.target.id === 'ras-language') window.location.reload();
                });
            }
        });

        // Define global saveConfig shim if needed by other modules
        window.saveConfig = function() {
            if(SettingsUI && SettingsUI.save) SettingsUI.save();
        };

        // Initialize Templates UI
        if(window.initTemplatesUI) {
            window.initTemplatesUI();
        }

        if(typeof SemanticGraphUI !== 'undefined') {
            SemanticGraphUI.init();
        }

        if(typeof PreactStats !== 'undefined') {
            PreactStats.init();
        }
    }

    function togglePanel() {
        const panel = document.getElementById('ras-container');
        if (panel.style.display === 'none') {
            panel.style.display = 'flex';
        } else {
            panel.style.display = 'none';
        }
    }

    function updateProviderVisibility() {
        const val = document.getElementById('ras-provider').value;
        document.getElementById('ras-openai-group').style.display = val === 'openai' ? 'block' : 'none';
        document.getElementById('ras-anthropic-group').style.display = val === 'anthropic' ? 'block' : 'none';
        document.getElementById('ras-groq-group').style.display = val === 'groq' ? 'block' : 'none';
        document.getElementById('ras-deepseek-group').style.display = val === 'deepseek' ? 'block' : 'none';
        document.getElementById('ras-custom-group').style.display = val === 'custom' ? 'block' : 'none';
    }

    function saveConfig() {
        STATE.config.raindropToken = document.getElementById('ras-raindrop-token').value;
        STATE.config.openaiKey = document.getElementById('ras-openai-key').value;
        STATE.config.openaiModel = document.getElementById('ras-openai-model').value;
        STATE.config.anthropicKey = document.getElementById('ras-anthropic-key').value;
        STATE.config.anthropicModel = document.getElementById('ras-anthropic-model').value;
        STATE.config.groqKey = document.getElementById('ras-groq-key').value;
        STATE.config.groqModel = document.getElementById('ras-groq-model').value;
        STATE.config.deepseekKey = document.getElementById('ras-deepseek-key').value;
        STATE.config.deepseekModel = document.getElementById('ras-deepseek-model').value;
        STATE.config.provider = document.getElementById('ras-provider').value;
        STATE.config.skipTagged = document.getElementById('ras-skip-tagged').checked;
        STATE.config.customBaseUrl = document.getElementById('ras-custom-url').value;
        STATE.config.customModel = document.getElementById('ras-custom-model').value;
        STATE.config.concurrency = parseInt(document.getElementById('ras-concurrency').value) || 3;
        STATE.config.maxTags = parseInt(document.getElementById('ras-max-tags').value) || 5;
        STATE.config.dryRun = document.getElementById('ras-dry-run').checked;
        STATE.config.taggingPrompt = document.getElementById('ras-tag-prompt').value;
        STATE.config.clusteringPrompt = document.getElementById('ras-cluster-prompt').value;
        STATE.config.classificationPrompt = document.getElementById('ras-class-prompt').value;
        STATE.config.ignoredTags = document.getElementById('ras-ignored-tags').value;
        STATE.config.autoDescribe = document.getElementById('ras-auto-describe').checked;
        STATE.config.useVision = document.getElementById('ras-use-vision').checked;
        STATE.config.descriptionPrompt = document.getElementById('ras-desc-prompt').value;
        STATE.config.nestedCollections = document.getElementById('ras-nested-collections').checked;
        STATE.config.tagBrokenLinks = document.getElementById('ras-tag-broken').checked;
        STATE.config.debugMode = document.getElementById('ras-debug-mode').checked;
        STATE.config.reviewClusters = document.getElementById('ras-review-clusters').checked;
        STATE.config.minTagCount = parseInt(document.getElementById('ras-min-tag-count').value) || 2;
        STATE.config.deleteEmptyCols = document.getElementById('ras-delete-empty').checked;

        STATE.config.safeMode = document.getElementById('ras-safe-mode').checked;
        STATE.config.minVotes = parseInt(document.getElementById('ras-min-votes').value) || 2;
        STATE.config.language = document.getElementById('ras-language').value;

        GM_setValue('language', STATE.config.language);
        GM_setValue('raindropToken', STATE.config.raindropToken);
        GM_setValue('openaiKey', STATE.config.openaiKey);
        GM_setValue('openaiModel', STATE.config.openaiModel);
        GM_setValue('anthropicKey', STATE.config.anthropicKey);
        GM_setValue('anthropicModel', STATE.config.anthropicModel);
        GM_setValue('groqKey', STATE.config.groqKey);
        GM_setValue('groqModel', STATE.config.groqModel);
        GM_setValue('deepseekKey', STATE.config.deepseekKey);
        GM_setValue('deepseekModel', STATE.config.deepseekModel);
        GM_setValue('provider', STATE.config.provider);
        GM_setValue('customBaseUrl', STATE.config.customBaseUrl);
        GM_setValue('customModel', STATE.config.customModel);
        GM_setValue('concurrency', STATE.config.concurrency);
        GM_setValue('maxTags', STATE.config.maxTags);
        GM_setValue('taggingPrompt', STATE.config.taggingPrompt);
        GM_setValue('clusteringPrompt', STATE.config.clusteringPrompt);
        GM_setValue('classificationPrompt', STATE.config.classificationPrompt);
        GM_setValue('useVision', STATE.config.useVision);
        GM_setValue('ignoredTags', STATE.config.ignoredTags);
        GM_setValue('descriptionPrompt', STATE.config.descriptionPrompt);
        GM_setValue('tagBrokenLinks', STATE.config.tagBrokenLinks);
        GM_setValue('reviewClusters', STATE.config.reviewClusters);
        GM_setValue('minTagCount', STATE.config.minTagCount);
        GM_setValue('deleteEmptyCols', STATE.config.deleteEmptyCols);

        GM_setValue('safeMode', STATE.config.safeMode);
        GM_setValue('minVotes', STATE.config.minVotes);
    }

    // Review Logic
    function waitForUserReview(items) {
        return new Promise((resolve) => {
            const panel = document.getElementById('ras-review-panel');
            const body = document.getElementById('ras-review-body');
            const count = document.getElementById('ras-review-count');

            body.innerHTML = '';
            count.textContent = `(${items.length} items)`;

            // Add Save Rule Option (Global)
            const globalSaveContainer = document.createElement('div');
            globalSaveContainer.style = "padding:5px; border-bottom:1px solid #eee; background:#f9f9f9;";
            globalSaveContainer.innerHTML = `
                <label style="font-size:11px; display:flex; align-items:center;">
                    <input type="checkbox" id="ras-save-all-rules" style="margin-right:5px;">
                    Always apply these moves in future (Save as Rules)
                </label>
            `;
            body.appendChild(globalSaveContainer);


            items.forEach((item, idx) => {
                const div = document.createElement('div');
                div.className = 'ras-review-item';

                // Safe DOM creation
                const container = document.createElement('div');
                container.style = "flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.dataset.idx = idx;

                const span = document.createElement('span');
                span.textContent = item.bm.title;
                span.title = item.bm.title;

                container.appendChild(checkbox);
                container.appendChild(span);

                const arrow = document.createElement('div');
                arrow.style = "margin-left:10px; font-weight:bold;";
                arrow.textContent = `→ ${item.category}`;

                div.appendChild(container);
                div.appendChild(arrow);
                body.appendChild(div);
            });

            panel.style.display = 'flex';

            const handleConfirm = () => {
                const approved = [];
                const saveRules = document.getElementById('ras-save-all-rules').checked;

                body.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                    if(cb.id === 'ras-save-all-rules') return;
                    const item = items[cb.dataset.idx];
                    approved.push(item);

                    if (saveRules && typeof RuleEngine !== 'undefined') {
                        // Reserved for future folder move rules
                    }
                });

                cleanup();
                resolve(approved);
            };

            const handleCancel = () => {
                cleanup();
                resolve(null); // Cancelled
            };

            const cleanup = () => {
                panel.style.display = 'none';
                document.getElementById('ras-review-confirm').removeEventListener('click', handleConfirm);
                document.getElementById('ras-review-cancel').removeEventListener('click', handleCancel);
            };

            document.getElementById('ras-review-confirm').addEventListener('click', handleConfirm);
            document.getElementById('ras-review-cancel').addEventListener('click', handleCancel);
        });
    }

    function waitForTagCleanupReview(changes) {
        return new Promise((resolve) => {
            const panel = document.getElementById('ras-review-panel');
            const body = document.getElementById('ras-review-body');
            const count = document.getElementById('ras-review-count');

            body.innerHTML = '';
            count.textContent = `(${changes.length} merges)`;

             // Add Save Rule Option
            const globalSaveContainer = document.createElement('div');
            globalSaveContainer.style = "padding:5px; border-bottom:1px solid #eee; background:#f9f9f9;";
            globalSaveContainer.innerHTML = `
                <label style="font-size:11px; display:flex; align-items:center;">
                    <input type="checkbox" id="ras-save-merge-rules" style="margin-right:5px;">
                    Save checked merges as permanent rules
                </label>
            `;
            body.appendChild(globalSaveContainer);


            changes.forEach((change, idx) => {
                const [bad, good] = change;
                const div = document.createElement('div');
                div.className = 'ras-review-item';

                const container = document.createElement('div');
                container.style = "flex:1;";

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
                checkbox.dataset.idx = idx;

                const badSpan = document.createElement('span');
                badSpan.style.color = '#d32f2f';
                badSpan.textContent = bad;

                const arrow = document.createTextNode(' → ');

                const goodSpan = document.createElement('span');
                goodSpan.style.color = '#28a745';
                goodSpan.textContent = good;

                container.appendChild(checkbox);
                container.appendChild(badSpan);
                container.appendChild(arrow);
                container.appendChild(goodSpan);

                div.appendChild(container);
                body.appendChild(div);
            });

            panel.style.display = 'flex';

            const handleConfirm = () => {
                const approved = [];
                const saveRules = document.getElementById('ras-save-merge-rules').checked;

                body.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                    if(cb.id === 'ras-save-merge-rules') return;
                    const change = changes[cb.dataset.idx];
                    approved.push(change);

                    if (saveRules && typeof RuleEngine !== 'undefined') {
                        const [bad, good] = change;
                        RuleEngine.addRule('merge_tag', bad, good);
                    }
                });
                cleanup();
                resolve(approved);
            };

            const handleCancel = () => {
                cleanup();
                resolve(null);
            };

            const cleanup = () => {
                panel.style.display = 'none';
                document.getElementById('ras-review-confirm').removeEventListener('click', handleConfirm);
                document.getElementById('ras-review-cancel').removeEventListener('click', handleCancel);
            };

            document.getElementById('ras-review-confirm').addEventListener('click', handleConfirm);
            document.getElementById('ras-review-cancel').addEventListener('click', handleCancel);
        });
    }


    async function startSorting() {
        if (STATE.isRunning) return;
        saveConfig();

        if (!STATE.config.raindropToken) {
            log('Error: Raindrop Token is required', 'error');
            return;
        }

        STATE.isRunning = true;
        STATE.stopRequested = false;
        document.getElementById('ras-start-btn').style.display = 'none';
        document.getElementById('ras-stop-btn').style.display = 'block';
        updateProgress(0);

        if (STATE.config.dryRun) {
            log('--- DRY RUN MODE ENABLED ---', 'warn');
            log('No changes will be made to your bookmarks.', 'warn');
        }

        log('Starting process...');
        // Reset stats (keep history?)
        STATE.stats = { processed: 0, updated: 0, broken: 0, moved: 0, errors: 0, deleted: 0, tokens: {input:0, output:0} };
        STATE.actionLog = []; // Reset log on new run? Or append? Resetting for now.

        try {
            // Logic will go here
            await runMainProcess();
        } catch (e) {
            if (e.message === 'Aborted' || e.message.includes('Aborted')) {
                log('Process aborted.', 'warn');
            } else {
                log(`Error: ${e.message}`, 'error');
                console.error(e);
            }
        } finally {
            STATE.isRunning = false;
            document.getElementById('ras-start-btn').style.display = 'block';
            document.getElementById('ras-stop-btn').style.display = 'none';
            log('Process finished or stopped.');

            const summary = `Run Complete.\nProcessed: ${STATE.stats.processed}\nUpdated: ${STATE.stats.updated}\nBroken Links: ${STATE.stats.broken}\nMoved: ${STATE.stats.moved}\nDeleted Tags/Cols: ${STATE.stats.deleted}\nErrors: ${STATE.stats.errors}`;
            log(summary);
            alert(summary);

            updateProgress(100);
            setTimeout(() => {
                 document.getElementById('ras-progress-container').style.display = 'none';
            }, 3000);
        }
    }

    function stopSorting() {
        if (STATE.isRunning) {
            STATE.stopRequested = true;
            if (STATE.abortController) {
                STATE.abortController.abort();
                log('Aborting active requests...', 'warn');
            }
            log('Stopping... please wait for current tasks to finish.', 'warn');
        }
    }

    async function runMainProcess() {
        // Initialize Network & AbortController
        if (STATE.abortController) STATE.abortController.abort();
        STATE.abortController = new AbortController();
        const network = new NetworkClient();


        const macroEngine = new MacroEngine();
        const engine = new RuleEngine();

        const api = new RaindropAPI(STATE.config.raindropToken, network);
        const llm = new LLMClient(STATE.config, network);
        const collectionId = document.getElementById('ras-collection-select').value;
        const searchQuery = document.getElementById('ras-search-input').value.trim();
        const mode = document.getElementById('ras-action-mode').value;

        let allTags = new Set();
        let processedCount = 0;

        // ============================
        // MODE: Summarize / Newsletter
        // ============================
        if (mode === 'summarize') {
            log('Generating Newsletter / Summary...');
            let page = 0;
            let summaries = []; // Array of { title, link, summary, tags }

            while (!STATE.stopRequested) {
                try {
                    const res = await api.getBookmarks(collectionId, page, searchQuery);
                    if (!res.items || res.items.length === 0) break;

                    const items = res.items;
                    log(`Processing page ${page} (${items.length} items)...`);

                    // Process items sequentially or in small batches for summaries
                    for (const bm of items) {
                        if (STATE.stopRequested) break;

                        log(`Summarizing: ${bm.title}...`);
                        let content = bm.excerpt || "";

                        // Optional: Deep scrape for better summaries (costlier)
                        // For now, let's try to scrape if excerpt is short
                        if (content.length < 200) {
                             const scraped = await scrapeUrl(bm.link);
                             if (scraped && scraped.text) content = scraped.text;
                        }

                        if (!content || content.length < 50) {
                            log(`Skipping ${bm.title} (no content to summarize)`, 'warn');
                            continue;
                        }

                        try {
                            const summaryText = await llm.summarizeContent(bm.title, content);
                            summaries.push({
                                title: bm.title,
                                link: bm.link,
                                summary: summaryText,
                                tags: bm.tags || []
                            });
                            STATE.stats.processed++;
                        } catch(e) {
                            log(`Failed to summarize ${bm.title}: ${e.message}`, 'error');
                            STATE.stats.errors++;
                        }
                    }

                    page++;
                    // Hard limit for newsletter mode to prevent infinite costs?
                    // Let's rely on user stopping or just processing what's asked.
                    await new Promise(r => setTimeout(r, 500));

                } catch(e) {
                    log(`Error: ${e.message}`, 'error');
                    break;
                }
            }

            if (summaries.length > 0) {
                // Generate Markdown
                const today = new Date().toLocaleDateString();
                let markdown = `# 📰 Raindrop Digest - ${today}\n\n`;

                // Group by tags? Or just list?
                // Simple list for now
                summaries.forEach(item => {
                    markdown += `### [${item.title}](${item.link})\n`;
                    if (item.tags.length) markdown += `*Tags: ${item.tags.join(', ')}*\n`;
                    markdown += `${item.summary}\n\n`;
                });

                log('Newsletter generated! Opening preview...');

                // Show in a simple modal overlay
                const overlay = document.createElement('div');
                overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:20000;display:flex;justify-content:center;align-items:center;";

                const contentDiv = document.createElement('div');
                contentDiv.style = "background:white;padding:20px;border-radius:8px;width:80%;max-height:90%;overflow-y:auto;font-family:sans-serif;color:#333;";

                contentDiv.innerHTML = `
                    <h2>Generated Newsletter</h2>
                    <textarea style="width:100%;height:400px;font-family:monospace;margin-bottom:10px;">${markdown}</textarea>
                    <div style="text-align:right;">
                        <button id="ras-news-close" style="padding:8px 16px;cursor:pointer;">Close</button>
                    </div>
                `;

                overlay.appendChild(contentDiv);
                document.body.appendChild(overlay);

                document.getElementById('ras-news-close').onclick = () => document.body.removeChild(overlay);
            } else {
                log('No summaries generated.', 'warn');
            }
            return;
        }

        // ============================
        // MODE: Flatten Library
        // ============================
        if (mode === 'flatten') {
            log('Starting Library Flattening (Reset to Unsorted)...');
            if (confirm("WARNING: This will move bookmarks to 'Unsorted' and optionally DELETE empty folders. Continue?")) {
                // Automatically export config for safety before destructive operation
                try {
                    const exportData = JSON.stringify(STATE.config, null, 2);
                    const blob = new Blob([exportData], {type: "application/json"});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); // Fake 'a' to avoid matching
                    a.href = url;
                    a.download = "raindrop_ai_config_backup_" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
                    if(typeof a.click === 'function') a.click(); else console.log('Mock download click');
                    URL.revokeObjectURL(url);
                    log('Configuration automatically backed up.', 'success');
                } catch(e) {
                    log('Failed to auto-backup config: ' + e.message, 'warn');
                }

                await api.loadCollectionCache(true);
                const collections = api.collectionCache || [];

                // Exclude system collections (-1, 0, etc if present in list?)
                // API returns custom collections.
                log(`Found ${collections.length} collections.`);

                for (const col of collections) {
                    if (STATE.stopRequested) break;
                    if (col._id < 0) continue; // Skip Unsorted/Trash if they appear

                    log(`Processing collection: ${col.title}...`);

                    // Move items to -1
                    let page = 0;
                    while (!STATE.stopRequested) {
                        try {
                            const res = await api.getBookmarks(col._id, page);
                            if (!res.items || res.items.length === 0) break;

                            const items = res.items;
                            log(`Moving ${items.length} items to Unsorted...`);

                            await Promise.all(items.map(bm => api.moveBookmark(bm._id, -1)));
                            STATE.stats.moved += items.length;

                            // If we move items out, pagination might shift if we stay on same page?
                            // Raindrop removes moved items from source collection immediately.
                            // So page 0 should be used repeatedly.

                        } catch(e) {
                            log(`Error moving items from ${col.title}: ${e.message}`, 'error');
                            break;
                        }
                        // Safety break for empty loops
                        await new Promise(r => setTimeout(r, 500));
                    }

                    // Delete collection if requested
                    if (STATE.config.deleteEmptyCols) {
                        try {
                            await api.deleteCollection(col._id);
                            log(`Deleted collection: ${col.title}`, 'success');
                            STATE.stats.deleted++;
                        } catch(e) {
                            log(`Failed to delete collection ${col.title}: ${e.message}`, 'error');
                        }
                    }
                }
            }
            return;
        }

        // ============================
        // MODE: Organize (Semantic)
        // ============================
        if (mode === 'organize_semantic') {
            log('Organizing Semantic (Content -> Folder Path)...');
            await api.loadCollectionCache(true);

            // 1. Determine Structure Source (Existing vs Template)
            let structuralPaths = [];
            const templateId = document.getElementById('ras-template-select') ? document.getElementById('ras-template-select').value : '';

            if (templateId && window.TemplateManager) {
                const builtIn = window.TemplateManager.getTemplates();
                const custom = window.TemplateManager.getCustomTemplates();
                const t = builtIn[templateId] || custom[templateId];
                if(t) {
                    log(`Using Structural Template: ${templateId}`);
                    structuralPaths = t.structure;
                } else {
                    log('Template not found, falling back to existing structure.', 'warn');
                }
            }

            // Fallback to Existing Structure if no template
            if (structuralPaths.length === 0) {
                 const idToPath = {};
                 const buildPath = (col) => {
                     if (idToPath[col._id]) return idToPath[col._id];
                     let p = col.title;
                     if (col.parent && col.parent.$id) {
                         const parent = api.collectionCache.find(c => c._id === col.parent.$id);
                         if (parent) {
                             p = buildPath(parent) + ' > ' + p;
                         }
                     }
                     idToPath[col._id] = p;
                     return p;
                 };

                 if (api.collectionCache) {
                     api.collectionCache.forEach(c => buildPath(c));
                 }
                 structuralPaths = Object.values(idToPath).sort();
            }

            if(structuralPaths.length === 0) {
                log('No folder structure found or defined. Cannot organize.', 'error');
                return;
            }

            let page = 0;
            let hasMore = true;

            while(hasMore && !STATE.stopRequested) {
                const res = await api.getBookmarks(collectionId, page, searchQuery);
                const items = res.items;
                if (!items || items.length === 0) break;

                log(`Processing page ${page} (${items.length} items)...`);

                for (const bm of items) {
                    if (STATE.stopRequested) break;
                    try {
                        const result = await llm.classifyBookmarkSemantic(bm, structuralPaths);
                        if (result && result.path) {
                            // Verify path is valid (one of the structural paths or a sub-path if allowed?)
                            // For Templates, we should strictly adhere or allow new sub-folders?
                            // LLM prompt says "Choose the best existing path or suggest a new one."
                            // But for Templates, we probably want to stick to the template unless "suggest new" is part of the ethos.
                            // Let's allow it for now, but maybe warn if it deviates significantly?

                            // Ensure path exists (especially for Templates which might not exist yet)
                            const targetId = await api.ensureCollectionPath(result.path);
                            if (targetId) {
                                if (bm.collection && bm.collection.$id === targetId) {
                                    log(`Skipping ${bm.title} (already in path)`);
                                } else {
                                    await api.moveBookmark(bm._id, targetId);
                                    STATE.stats.moved++;
                                    log(`Moved "${bm.title}" -> ${result.path}`, 'success');
                                }
                            }
                        }
                    } catch(e) {
                        log(`Error processing ${bm.title}: ${e.message}`, 'error');
                    }
                }
                page++;
                await new Promise(r => setTimeout(r, 500));
            }
            return;
        }

        // ============================
        // MODE: Deduplicate Links
        // ============================
        if (mode === 'deduplicate') {
            log('Starting Deduplication analysis...');
            const useSemantic = STATE.config.semanticDedupe;
            if (useSemantic) log('Semantic Deduplication Enabled: Comparing domains and titles via LLM...', 'info');

            const urlMap = new Map();
            const domainMap = new Map(); // domain -> array of bookmarks
            let page = 0;
            let duplicatesFound = [];

            while (!STATE.stopRequested) {
                try {
                    const res = await api.getBookmarks(collectionId, page, searchQuery);
                    if (!res.items || res.items.length === 0) break;

                    log(`Scanning page ${page} (${res.items.length} items)...`);
                    res.items.forEach(bm => {
                        // 1. Exact URL match (always fast)
                        // Safely handle missing links
                        if (!bm.link) return;

                        let cleanUrl = bm.link.split('#')[0].replace(/\/$/, "");

                        if (urlMap.has(cleanUrl)) {
                            duplicatesFound.push({ keep: urlMap.get(cleanUrl), remove: bm, reason: 'Exact URL' });
                        } else {
                            urlMap.set(cleanUrl, bm);

                            // 2. Group by domain for semantic checks
                            if (useSemantic) {
                                try {
                                    const urlObj = new URL(bm.link);
                                    const domain = urlObj.hostname.replace(/^www\./, '');
                                    if (!domainMap.has(domain)) domainMap.set(domain, []);
                                    domainMap.get(domain).push(bm);
                                } catch(e) {} // ignore invalid URLs
                            }
                        }
                    });
                    page++;
                    await new Promise(r => setTimeout(r, 300));
                } catch(e) {
                    log(`Error fetching bookmarks: ${e.message}`, 'error');
                    break;
                }
            }

            // Semantic Analysis Phase
            if (useSemantic && !STATE.stopRequested) {
                log(`Starting Semantic Analysis on ${domainMap.size} domains...`);
                let domainsProcessed = 0;

                for (const [domain, bms] of domainMap.entries()) {
                    if (STATE.stopRequested) break;
                    if (bms.length < 2) continue; // Need at least 2 to compare

                    // Check if titles are identical (fast path semantic)
                    for (let i = 0; i < bms.length; i++) {
                        for (let j = i + 1; j < bms.length; j++) {
                            const bm1 = bms[i];
                            const bm2 = bms[j];
                            // Skip if already marked for deletion
                            if (duplicatesFound.some(d => d.remove._id === bm1._id || d.remove._id === bm2._id)) continue;

                            // If titles are exactly identical but URLs differ slightly (e.g. tracking params)
                            if (bm1.title && bm2.title && bm1.title.toLowerCase() === bm2.title.toLowerCase()) {
                                duplicatesFound.push({ keep: bm1, remove: bm2, reason: 'Identical Title' });
                                continue;
                            }

                            // LLM deep comparison if titles are somewhat similar (basic heuristic to save tokens)
                            // e.g. both contain 3+ of the same words
                            const title1 = bm1.title || '';
                            const title2 = bm2.title || '';
                            const w1 = new Set(title1.toLowerCase().split(/\s+/));
                            const w2 = new Set(title2.toLowerCase().split(/\s+/));
                            const intersection = new Set([...w1].filter(x => w2.has(x) && x.length > 3));

                            if (intersection.size >= 2) {
                                try {
                                    if (STATE.config.localEmbeddings && typeof LocalEmbeddings !== 'undefined') {
                                        // Deduplication v3: Local Vector DB
                                        log(`Local Vector comparing: "${title1}" vs "${title2}"...`);
                                        const text1 = `${title1} ${bm1.excerpt || ''}`;
                                        const text2 = `${title2} ${bm2.excerpt || ''}`;

                                        const emb1 = await LocalEmbeddings.getEmbedding(text1);
                                        const emb2 = await LocalEmbeddings.getEmbedding(text2);

                                        if (emb1 && emb2) {
                                            const sim = LocalEmbeddings.similarity(emb1, emb2);
                                            console.log(`[Dedupe] Local Similarity Score: ${sim.toFixed(3)}`);
                                            // Threshold for being considered exactly the same content
                                            if (sim > 0.92) {
                                                duplicatesFound.push({ keep: bm1, remove: bm2, reason: `Local Vector Match (${(sim*100).toFixed(1)}%)` });
                                            }
                                        }
                                    } else {
                                        // Legacy LLM Comparison
                                        log(`LLM comparing: "${title1}" vs "${title2}"...`);
                                        const prompt = `Are these two articles/bookmarks exactly the same content, despite having different URLs/titles?\n\nItem 1:\nTitle: ${title1}\nURL: ${bm1.link}\nExcerpt: ${bm1.excerpt || ''}\n\nItem 2:\nTitle: ${title2}\nURL: ${bm2.link}\nExcerpt: ${bm2.excerpt || ''}\n\nRespond ONLY with valid JSON: {"is_duplicate": true/false}`;
                                        const result = await llm.callLLM(prompt, true);
                                        if (result && result.is_duplicate) {
                                            duplicatesFound.push({ keep: bm1, remove: bm2, reason: 'Semantic Match (LLM)' });
                                        }
                                    }
                                } catch (e) {
                                    log(`Comparison failed: ${e.message}`, 'error');
                                }
                            }
                        }
                    }
                    domainsProcessed++;
                    if (domainsProcessed % 5 === 0 && typeof updateProgress === 'function') {
                        updateProgress((domainsProcessed / domainMap.size) * 100);
                    }
                }
            }

            if (duplicatesFound.length === 0) {
                log('No duplicates found.', 'success');
                return;
            }

            log(`Found ${duplicatesFound.length} duplicates to remove.`);

            // In a real app, we might merge tags here before deleting.
            // For now, we will just delete the newer one (which we fetched later or mapped later).
            // Actually Raindrop UI already has a "Duplicates" filter, but this automates cleanup.

            if (STATE.config.reviewClusters) {
                const reviewItems = duplicatesFound.map((dup, idx) => {
                    return [ `[Remove] ${dup.remove.title} (${dup.reason})`, `[Keep] ${dup.keep.title} (${dup.keep.link})` ];
                });
                log(`Pausing for review of duplicates...`);
                // Re-using tag review modal for generic pairs
                const approved = await waitForTagCleanupReview(reviewItems);
                if (!approved) {
                    log('User cancelled deduplication.', 'warn');
                    return;
                }

                // Map approved back to actual objects
                duplicatesFound = approved.map(item => {
                    const originalIdx = reviewItems.findIndex(ri => ri[0] === item[0]);
                    return duplicatesFound[originalIdx];
                }).filter(x => x);
            }

            if (STATE.config.dryRun) {
                log('DRY RUN: No bookmarks deleted.');
                return;
            }

            let deletedCount = 0;
            for (const dup of duplicatesFound) {
                if (STATE.stopRequested) break;
                try {
                    // Raindrop uses standard DELETE /raindrop/{id}
                    logAction('DELETE_BOOKMARK', { id: dup.remove._id, reason: 'Duplicate' });
                    await api.request(`/raindrop/${dup.remove._id}`, 'DELETE');
                    deletedCount++;
                    log(`Deleted duplicate: ${dup.remove.title}`, 'success');
                    await new Promise(r => setTimeout(r, 200));
                } catch(e) {
                    log(`Failed to delete ${dup.remove._id}: ${e.message}`, 'error');
                }
            }

            log(`Deduplication complete. Deleted ${deletedCount} items.`);
            STATE.stats.deleted += deletedCount;
            return;
        }

        // ============================
        // MODE: Apply Macros
        // ============================
        if (mode === 'apply_macros') {
            log('Applying Macros...');
            const macros = GM_getValue('macros', []);
            if (macros.length === 0) {
                log('No macros defined. Please create some in the Macros tab.', 'warn');
                return;
            }

            // Pre-load collection cache if any macro moves to a folder
            const needsCollections = macros.some(m => m.action === 'move_to');
            if (needsCollections) {
                await api.loadCollectionCache(true);
            }

            let page = 0;
            let hasMore = true;

            while (hasMore && !STATE.stopRequested) {
                try {
                    const res = await api.getBookmarks(collectionId, page, searchQuery);
                    if (!res.items || res.items.length === 0) break;

                    log(`Processing page ${page} (${res.items.length} items)...`);

                    for (const bm of res.items) {
                        if (STATE.stopRequested) break;

                        let updatePayload = {};
                        let newCollectionId = null;
                        let tagsModified = false;
                        let currentTags = new Set(bm.tags || []);

                        for (const macro of macros) {
                            let match = false;

                            // Check Condition
                            if (macro.condition === 'has_tag') {
                                match = currentTags.has(macro.conditionValue.toLowerCase().replace(/^#/, ''));
                            } else if (macro.condition === 'no_tags') {
                                match = currentTags.size === 0;
                            } else if (macro.condition === 'domain_is') {
                                match = bm.link.toLowerCase().includes(macro.conditionValue.toLowerCase());
                            } else if (macro.condition === 'title_contains') {
                                match = bm.title.toLowerCase().includes(macro.conditionValue.toLowerCase());
                            }

                            // Apply Action
                            if (match) {
                                if (macro.action === 'add_tag') {
                                    const tagToAdd = macro.actionValue.replace(/^#/, '').toLowerCase();
                                    if (!currentTags.has(tagToAdd)) {
                                        currentTags.add(tagToAdd);
                                        tagsModified = true;
                                        log(`[Macro] Added tag "${tagToAdd}" to "${bm.title}"`);
                                    }
                                } else if (macro.action === 'remove_tag') {
                                    const tagToRemove = macro.actionValue.replace(/^#/, '').toLowerCase();
                                    if (currentTags.has(tagToRemove)) {
                                        currentTags.delete(tagToRemove);
                                        tagsModified = true;
                                        log(`[Macro] Removed tag "${tagToRemove}" from "${bm.title}"`);
                                    }
                                } else if (macro.action === 'move_to') {
                                    const targetName = macro.actionValue.toLowerCase();
                                    const targetCol = api.collectionCache.find(c => c.title.toLowerCase() === targetName);
                                    if (targetCol && (!bm.collection || bm.collection.$id !== targetCol._id)) {
                                        newCollectionId = targetCol._id;
                                        log(`[Macro] Marked "${bm.title}" for move to "${targetCol.title}"`);
                                    } else if (!targetCol) {
                                        log(`[Macro Error] Target folder "${macro.actionValue}" not found for "${bm.title}"`, 'warn');
                                    }
                                }
                            }
                        }

                        // Execute API calls for this bookmark
                        if (tagsModified) {
                            updatePayload.tags = Array.from(currentTags);
                        }

                        if (Object.keys(updatePayload).length > 0 || newCollectionId) {
                            if (STATE.config.dryRun) {
                                log(`[DryRun] Would update "${bm.title}": Tags: ${tagsModified}, MoveTo: ${newCollectionId}`);
                            } else {
                                if (Object.keys(updatePayload).length > 0) {
                                    await api.updateBookmark(bm._id, updatePayload);
                                    STATE.stats.updated++;
                                }
                                if (newCollectionId) {
                                    await api.moveBookmark(bm._id, newCollectionId);
                                    STATE.stats.moved++;
                                }
                            }
                        }
                    }

                    page++;
                    await new Promise(r => setTimeout(r, 500));
                } catch(e) {
                    log(`Error applying macros: ${e.message}`, 'error');
                    break;
                }
            }
            log('Macro application complete.', 'success');
            return;
        }

        // ============================
        // MODE: Delete All Tags
        // ============================
        if (mode === 'delete_all_tags') {
            log('Deleting ALL Tags...');
            if (confirm("WARNING: This will remove EVERY tag from your library. This cannot be undone. Continue?")) {
                try {
                    const allTags = await api.getAllTags();
                    if (allTags.length === 0) {
                        log('No tags found.');
                        return;
                    }

                    const tagNames = allTags.map(t => t._id);
                    log(`Found ${tagNames.length} tags to delete.`);

                    // Batch delete
                    const BATCH_SIZE = 50;
                    for (let i = 0; i < tagNames.length; i += BATCH_SIZE) {
                        if (STATE.stopRequested) break;
                        const batch = tagNames.slice(i, i + BATCH_SIZE);
                        log(`Deleting batch ${Math.floor(i/BATCH_SIZE)+1}...`);
                        await api.removeTagsBatch(batch);
                        STATE.stats.deleted += batch.length;
                        updateProgress((i / tagNames.length) * 100);
                        await new Promise(r => setTimeout(r, 500));
                    }
                } catch(e) {
                    log(`Error deleting tags: ${e.message}`, 'error');
                }
            }
            return;
        }

        // ============================
        // MODE: Prune Infrequent Tags
        // ============================
        if (mode === 'prune_tags') {
            const minCount = STATE.config.minTagCount;
            log(`Pruning tags with fewer than ${minCount} occurrences...`);

            try {
                const allTags = await api.getAllTags();
                const tagsToDelete = allTags.filter(t => t.count < minCount).map(t => t._id);

                if (tagsToDelete.length === 0) {
                    log('No tags found matching criteria.');
                    return;
                }

                log(`Found ${tagsToDelete.length} tags to prune.`);

                if (STATE.config.reviewClusters) {
                     // Reuse review panel?
                     // It expects "moves", let's mock it or just use confirm for now simpler
                     if (!confirm(`Found ${tagsToDelete.length} tags to delete (e.g. ${tagsToDelete.slice(0,5).join(', ')}). Proceed?`)) {
                         return;
                     }
                }

                const BATCH_SIZE = 50;
                for (let i = 0; i < tagsToDelete.length; i += BATCH_SIZE) {
                    if (STATE.stopRequested) break;
                    const batch = tagsToDelete.slice(i, i + BATCH_SIZE);
                    await api.removeTagsBatch(batch);
                    STATE.stats.deleted += batch.length;
                    log(`Deleted ${batch.length} tags.`);
                    updateProgress((i / tagsToDelete.length) * 100);
                    await new Promise(r => setTimeout(r, 500));
                }
            } catch(e) {
                log(`Error pruning tags: ${e.message}`, 'error');
            }
            return;
        }

        // ============================
        // MODE: Organize (Existing Folders)
        // ============================
        if (mode === 'organize_existing') {
            log('Organizing into EXISTING folders only...');
            await api.loadCollectionCache(true);
            const collections = api.collectionCache;
            if (!collections || collections.length === 0) {
                log('No existing collections found.', 'error');
                return;
            }

            const colNames = collections.map(c => c.title);

            // Process bookmarks
            // Only process Unsorted? Or Selected Collection?
            // Use standard loop logic
            let page = 0;
            let hasMore = true;

            while(hasMore && !STATE.stopRequested) {
                const res = await api.getBookmarks(collectionId, page, searchQuery);
                const items = res.items;
                if (!items || items.length === 0) break;

                log(`Processing page ${page} (${items.length} items)...`);

                for (const bm of items) {
                    if (STATE.stopRequested) break;

                    try {
                        const classification = await llm.classifyBookmarkIntoExisting(bm, colNames);
                        if (classification && classification.category) {
                            const target = collections.find(c => c.title.toLowerCase() === classification.category.toLowerCase());
                            if (target) {
                                // Check if already there
                                if (bm.collection && bm.collection.$id === target._id) {
                                    log(`Skipping ${bm.title} (already in ${target.title})`);
                                } else {
                                    await api.moveBookmark(bm._id, target._id);
                                    STATE.stats.moved++;
                                    log(`Moved "${bm.title}" -> ${target.title}`, 'success');
                                }
                            } else {
                                log(`LLM suggested non-existent category "${classification.category}" for "${bm.title}"`, 'warn');
                            }
                        }
                    } catch(e) {
                         log(`Error processing ${bm.title}: ${e.message}`, 'error');
                    }
                }

                page++;
                await new Promise(r => setTimeout(r, 500));
            }
            return;
        }

        // ============================
        // MODE: Apply Macros
        // ============================
        if (mode === 'apply_macros') {
            log('Starting Batch Macros Execution...');
            const macros = macroEngine.getMacros();
            if (macros.length === 0) {
                log('No macros defined. Add some in the Macros tab.', 'warn');
                return;
            }

            await api.loadCollectionCache(true);
            const collections = api.collectionCache || [];

            // Reusing the flatten logic iterator style
            for (const col of collections) {
                if (STATE.stopRequested) break;
                if (col._id < 0 && col._id !== -1) continue; // Skip trash, include unsorted

                let page = 0;
                while (!STATE.stopRequested) {
                    const chunk = await api.getBookmarks(col._id, page);
                    if (!chunk || chunk.length === 0) break;

                    for (const bm of chunk) {
                        if (STATE.stopRequested) break;

                        const actions = macroEngine.evaluate(bm);
                        if (actions.length > 0) {
                            let tagsToAdd = [];
                            let targetFolder = null;

                            for (const action of actions) {
                                if (action.type === 'add_tag') tagsToAdd.push(action.value);
                                if (action.type === 'move_to_folder') targetFolder = action.value;
                            }

                            let updates = {};
                            if (tagsToAdd.length > 0) {
                                const newTags = [...new Set([...bm.tags, ...tagsToAdd])];
                                if (newTags.length !== bm.tags.length) {
                                    updates.tags = newTags;
                                }
                            }

                            if (targetFolder) {
                                const targetCol = api.collectionCache.find(c => c.title.toLowerCase() === targetFolder.toLowerCase());
                                if (targetCol && targetCol._id !== bm.collectionId) {
                                    updates.collectionId = targetCol._id;
                                } else if (!targetCol) {
                                    log(`Macro target folder "${targetFolder}" not found for ${bm.title}`, 'warn');
                                }
                            }

                            if (Object.keys(updates).length > 0) {
                                try {
                                    log(`Macro applied to: ${bm.title}`, 'success');
                                    if (!STATE.config.dryRun) {
                                        await api.updateBookmark(bm._id, updates);
                                    }
                                    STATE.stats.updated++;
                                } catch (e) {
                                    log(`Failed to apply macro to ${bm._id}: ${e.message}`, 'error');
                                }
                            }
                        }
                    }

                    page++;
                    await new Promise(r => setTimeout(r, 200));
                }
            }
            log('Macros execution complete.');
            return;
        }

        // ============================
        // MODE: Deduplicate Links
        // ============================
        if (mode === 'deduplicate') {
            log('Starting Deduplication process...');
            await api.loadCollectionCache(true);
            const collections = api.collectionCache || [];

            let allBookmarks = [];

            // Gather all bookmarks across all collections
            log('Gathering all bookmarks for deduplication...');
            for (const col of collections) {
                if (STATE.stopRequested) break;
                if (col._id < 0 && col._id !== -1) continue; // Skip trash, include unsorted

                let page = 0;
                while (!STATE.stopRequested) {
                    const chunk = await api.getBookmarks(col._id, page);
                    if (!chunk || chunk.length === 0) break;
                    allBookmarks = allBookmarks.concat(chunk);
                    page++;
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            log(`Found ${allBookmarks.length} total bookmarks to analyze.`);

            // Exact URL duplication
            const urlMap = {};
            const duplicates = [];

            for (const bm of allBookmarks) {
                // Normalize URL to prevent http/https or trailing slash mismatches
                let normalizedUrl = bm.link.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

                if (urlMap[normalizedUrl]) {
                    duplicates.push({ original: urlMap[normalizedUrl], duplicate: bm });
                } else {
                    urlMap[normalizedUrl] = bm;
                }
            }

            if (duplicates.length > 0) {
                log(`Found ${duplicates.length} exact URL duplicates.`, 'warn');

                if (confirm(`Found ${duplicates.length} exact URL duplicates. Do you want to delete them? (This will keep the oldest version)`)) {
                    for (const dup of duplicates) {
                        if (STATE.stopRequested) break;
                        try {
                            log(`Deleting duplicate: ${dup.duplicate.title} (${dup.duplicate.link})`);
                            if (!STATE.config.dryRun) {
                                await api.deleteBookmark(dup.duplicate._id);
                            }
                            STATE.stats.deleted++;
                        } catch (e) {
                            log(`Failed to delete ${dup.duplicate._id}: ${e.message}`, 'error');
                        }
                        await new Promise(r => setTimeout(r, 300));
                    }
                }
            } else {
                log('No exact URL duplicates found.', 'success');
            }

            // Future: Semantic Deduplication using local embeddings
            log('Semantic deduplication (content-based) is planned for a future update.', 'info');
            return;
        }

        // ============================
        // MODE: Newsletter / Summary
        // ============================
        if (mode === 'summarize') {
            log('Generating Newsletter / Summary for selected collection...');

            let page = 0;
            let combinedContent = "";
            let itemsProcessed = 0;

            while (!STATE.stopRequested) {
                const chunk = await api.getBookmarks(collectionId, page);
                if (!chunk || chunk.length === 0) break;

                for (const bm of chunk) {
                    if (STATE.stopRequested) break;

                    log(`Scraping for summary: ${bm.title.substring(0, 30)}...`);
                    try {
                        const scraped = await scrapeUrl(bm.link);

                        if (scraped && !scraped.error) {
                            // Extract title, domain, and a snippet of content
                            const domain = new URL(bm.link).hostname;
                            const snippet = scraped.text.substring(0, 500).replace(/\n+/g, ' ') + '...';

                            combinedContent += `Title: ${bm.title}\nURL: ${bm.link}\nDomain: ${domain}\nTags: ${bm.tags.join(', ')}\nContent: ${snippet}\n\n`;
                            itemsProcessed++;
                        }
                    } catch (e) {
                        log(`Failed to scrape ${bm.link}: ${e.message}`, 'warn');
                    }
                    await new Promise(r => setTimeout(r, 500));
                }
                page++;
            }

            if (itemsProcessed === 0) {
                log('No content could be extracted for summarization.', 'warn');
                return;
            }

            log(`Extracted content from ${itemsProcessed} bookmarks. Generating summary...`);

            const prompt = "You are an expert curator and editor. Create a markdown-formatted newsletter/summary of the following bookmarked items. Group them by themes if applicable. Provide a brief overarching summary, followed by a bulleted list of the most interesting links with a 1-sentence description of why they are valuable.\n\nBookmarks data:\n" + combinedContent;

            try {
                // We'll use the generic request method if clusterTags isn't suitable
                const messages = [
                    { role: 'system', content: 'You are an expert editor creating a newsletter digest.' },
                    { role: 'user', content: prompt }
                ];

                // Hack: use existing llm client method to send generic prompt.
                // We'll use classifyBookmark since it accepts text, but we need to override the system prompt.
                // For now, let's inject a new method or use a generic one if it exists.

                // Let's modify the generic LLMClient.request locally
                const requestPayload = {
                    model: STATE.config[`${STATE.config.provider}Model`] || (STATE.config.provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-haiku-20240307'),
                    messages: messages
                };

                let responseText = "";

                if (STATE.config.provider === 'openai') {
                    const res = await network.fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${STATE.config.openaiKey}`
                        },
                        body: JSON.stringify(requestPayload)
                    });
                    const data = await res.json();
                    responseText = data.choices[0].message.content;
                } else if (STATE.config.provider === 'anthropic') {
                    const res = await network.fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': STATE.config.anthropicKey,
                            'anthropic-version': '2023-06-01',
                            'anthropic-dangerous-direct-browser-access': 'true'
                        },
                        body: JSON.stringify({
                            model: requestPayload.model,
                            max_tokens: 4096,
                            messages: [{ role: 'user', content: prompt }]
                        })
                    });
                    const data = await res.json();
                    responseText = data.content[0].text;
                } else {
                     log(`Newsletter generation requires OpenAI or Anthropic provider currently.`, 'error');
                     return;
                }

                // Display summary in a basic modal
                showModal("Newsletter Summary", responseText);
                log('Newsletter generated successfully.', 'success');

            } catch (e) {
                log(`Error generating summary: ${e.message}`, 'error');
            }

            return;
        }

        // Helper function for Modal
        function showModal(title, content) {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';

            const modal = document.createElement('div');
            modal.style.cssText = 'background:var(--ras-bg);color:var(--ras-text);width:80%;max-width:800px;max-height:80vh;border-radius:8px;display:flex;flex-direction:column;box-shadow:0 10px 25px rgba(0,0,0,0.5);';

            const header = document.createElement('div');
            header.style.cssText = 'padding:15px;border-bottom:1px solid var(--ras-border);display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:18px;';
            header.innerText = title;

            const closeBtn = document.createElement('button');
            closeBtn.innerText = '×';
            closeBtn.style.cssText = 'background:none;border:none;font-size:24px;cursor:pointer;color:var(--ras-text);';
            closeBtn.onclick = () => document.body.removeChild(overlay);
            header.appendChild(closeBtn);

            const body = document.createElement('div');
            body.style.cssText = 'padding:20px;overflow-y:auto;white-space:pre-wrap;font-family:monospace;font-size:14px;line-height:1.5;';
            body.innerText = content;

            modal.appendChild(header);
            modal.appendChild(body);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
        }

        // ============================
        // MODE: Organize (Tag Frequency)
        // ============================
        if (mode === 'organize_frequency') {
            log('Creating folder structure from Tag Frequency...');

            // 1. Get Top Tags
            const allTags = await api.getAllTags();
            // Filter by min count
            const frequentTags = allTags.filter(t => t.count >= STATE.config.minTagCount).sort((a,b) => b.count - a.count);

            if (frequentTags.length === 0) {
                log('No tags meet frequency criteria.');
                return;
            }

            log(`Found ${frequentTags.length} frequent tags. Generating hierarchy...`);

            // 2. LLM Hierarchy
            const topTags = frequentTags.slice(0, 100).map(t => t._id); // Limit context
            const hierarchy = await llm.clusterTags(topTags); // Reuse clustering logic
            // Expected: { "Category": ["tag1", "tag2"] }

            if (STATE.config.reviewClusters) {
                 if(!confirm(`Proposed Structure:\n${JSON.stringify(hierarchy, null, 2)}\n\nProceed to create and move?`)) return;
            }

            // 3. Create & Move
            for (const [category, tags] of Object.entries(hierarchy)) {
                if (STATE.stopRequested) break;

                // Create Collection
                let targetId = null;
                 try {
                     // Check existing
                     if (!api.collectionCache) await api.loadCollectionCache();
                     const existing = api.collectionCache.find(c => c.title.toLowerCase() === category.toLowerCase());
                     if (existing) targetId = existing._id;
                     else {
                         const newCol = await api.createCollection(category);
                         targetId = newCol.item._id;
                     }
                 } catch(e) {
                     log(`Failed to create collection ${category}`, 'error');
                     continue;
                 }

                 // Move bookmarks for each tag
                 for (const tag of tags) {
                     if (STATE.stopRequested) break;
                     // Find bookmarks with this tag
                     // Search logic
                     let page = 0;
                     let searching = true;
                     while(searching && !STATE.stopRequested) {
                        const searchStr = encodeURIComponent(JSON.stringify([{key: 'tag', val: tag}]));
                        const res = await api.request(`/raindrops/0?search=${searchStr}&page=${page}`);

                        if (!res.items || res.items.length === 0) break;

                        await Promise.all(res.items.map(bm => {
                            // Verify tag is still present
                            if (bm.tags.includes(tag)) {
                                return api.moveBookmark(bm._id, targetId)
                                    .then(() => {
                                        STATE.stats.moved++;
                                        log(`Moved "${bm.title}" (Tag: ${tag}) -> ${category}`);
                                    });
                            }
                        }));

                        if (res.items.length < 50) searching = false;
                        // page 0 again? Raindrop removes moved items from search view usually if they moved collection?
                        // No, search is global usually unless filtered by collection.
                        // If we search global /raindrops/0, items still match search after move.
                        // So we must increment page.
                        page++;
                     }
                 }
            }
            return;
        }

        // --- Phase 1: Tagging (Standard) ---
        if (mode === 'tag_only' || mode === 'full') {
            log('Phase 1: Fetching bookmarks...');
            let page = 0;
            let hasMore = true;
            let totalItemsApprox = 0;

            // Check for saved session
            const savedState = GM_getValue('sessionState', null);
            if (savedState && savedState.mode === mode && savedState.collectionId === collectionId && savedState.searchQuery === searchQuery) {
                if (confirm(`Resume previous session from page ${savedState.page}?`)) {
                    page = savedState.page;
                    log(`Resuming from page ${page}...`);
                }
            }

            // Try to get total count first for progress bar
            try {
                 const res = await api.getBookmarks(collectionId, 0, searchQuery);
                 if(res.count) totalItemsApprox = res.count;
            } catch(e) {}

            while (hasMore && !STATE.stopRequested) {
                // Save state
                GM_setValue('sessionState', {
                    mode,
                    collectionId,
                    searchQuery,
                    page,
                    timestamp: Date.now()
                });
                try {
                    const res = await api.getBookmarks(collectionId, page, searchQuery);
                    const bookmarks = res.items;
                    if (bookmarks.length === 0) {
                        hasMore = false;
                        break;
                    }

                    log(`Processing page ${page} (${bookmarks.length} items)...`);

                    // Filter out already tagged items if config says so
                    const itemsToProcess = STATE.config.skipTagged
                        ? bookmarks.filter(bm => !bm.tags || bm.tags.length === 0)
                        : bookmarks;

                    if (itemsToProcess.length === 0) {
                        log('All items on this page skipped (already tagged).');
                        page++;
                        continue;
                    }

                    // Process batch with concurrency
                    const chunks = [];
                    for (let i = 0; i < itemsToProcess.length; i += STATE.config.concurrency) {
                        chunks.push(itemsToProcess.slice(i, i + STATE.config.concurrency));
                    }

                    for (const chunk of chunks) {
                        if (STATE.stopRequested) break;

                        await Promise.all(chunk.map(async (bm) => {
                            try {
                                log(`Scraping: ${bm.title.substring(0, 30)}...`);
                                const scraped = await scrapeUrl(bm.link, STATE.abortController.signal);

                                let result = { tags: [], description: null };

                                if (scraped && scraped.error) {
                                    // Handle Errors
                                    if (scraped.error === 404 || scraped.error === 'network_error' || scraped.error === 'timeout') {
                                        if (STATE.config.tagBrokenLinks) {
                                            log(`Broken link detected (${scraped.error}): ${bm.title}`, 'warn');

                                            // THE ARCHIVIST: Check Wayback Machine
                                            const archiveUrl = await checkWaybackMachine(bm.link);
                                            const tagsToAdd = ['broken-link'];
                                            let descriptionUpdate = null;

                                            if (archiveUrl) {
                                                log(`[Archivist] Snapshot found: ${archiveUrl}`, 'success');
                                                tagsToAdd.push('has-archive');
                                                // Append to description if not present
                                                if (!bm.excerpt.includes('Wayback Machine')) {
                                                    descriptionUpdate = (bm.excerpt ? bm.excerpt + "\n\n" : "") + `Wayback Machine: ${archiveUrl}`;
                                                }
                                            } else {
                                                log(`[Archivist] No snapshot found for ${bm.link}`);
                                            }

                                            // Apply updates
                                            const currentTags = bm.tags || [];
                                            const newTags = [...new Set([...currentTags, ...tagsToAdd])];
                                            const payload = { tags: newTags };
                                            if (descriptionUpdate) payload.excerpt = descriptionUpdate;

                                            if (newTags.length > currentTags.length || descriptionUpdate) {
                                                await api.updateBookmark(bm._id, payload);
                                                STATE.stats.broken++;
                                                if (archiveUrl) STATE.stats.updated++;
                                            }
                                            return; // Skip AI tagging
                                        }
                                    }
                                }

                                if (scraped && scraped.text) {
                                    log(`Generating tags for: ${bm.title.substring(0, 20)}...`);
                                    const imageUrl = (STATE.config.useVision && bm.cover) ? bm.cover : null;
                                    result = await llm.generateTags(scraped.text, bm.tags, imageUrl);
                                } else {
                                    log(`Skipping content gen for ${bm.title} (scrape failed), using metadata`);
                                    const imageUrl = (STATE.config.useVision && bm.cover) ? bm.cover : null;
                                    result = await llm.generateTags(bm.title + "\n" + bm.excerpt, bm.tags, imageUrl);
                                }

                                const updateData = {};

                                if (result.tags && result.tags.length > 0) {
                                    const combinedTags = [...new Set([...(bm.tags || []), ...result.tags])];
                                    updateData.tags = combinedTags;
                                    combinedTags.forEach(t => allTags.add(t));
                                } else {
                                    log(`No tags generated for "${bm.title}"`, 'warn');
                                }

                                if (STATE.config.autoDescribe && result.description) {
                                    updateData.excerpt = result.description;
                                }

                                if (Object.keys(updateData).length > 0) {
                                    await api.updateBookmark(bm._id, updateData);
                                    STATE.stats.updated++;
                                    log(`Updated ${bm.title} (${updateData.tags ? updateData.tags.length + ' tags' : ''}${updateData.excerpt ? ', desc' : ''})`, 'success');
                                }
                            } catch (err) {
                                STATE.stats.errors++;
                                log(`Failed to process ${bm.title}: ${err.message}`, 'error');
                            }
                        }));
                    }

                    // Small pause between batches to be nice
                    await new Promise(r => setTimeout(r, 500));

                    page++;
                    processedCount += bookmarks.length;
                    STATE.stats.processed += bookmarks.length;

                    if (totalItemsApprox > 0) {
                        updateProgress((processedCount / totalItemsApprox) * 100);
                    }

                } catch (e) {
                    log(`Error fetching bookmarks: ${e.message}`, 'error');
                    break;
                }
            }
            // Clear session if finished naturally
            if (!STATE.stopRequested) {
                GM_setValue('sessionState', null);
            }
        }

        if (STATE.stopRequested) return;

        // --- Phase 3: Cleanup (Tag Consolidation) ---
        if (mode === 'cleanup_tags') {
            log('Phase 3: Tag Cleanup...');

            // 1. Fetch all tags
            log('Fetching all tags...');
            let allUserTags = [];
            try {
                allUserTags = await api.getAllTags();
            } catch(e) {
                log('Failed to fetch tags: ' + e.message, 'error');
                return;
            }

            if (allUserTags.length === 0) {
                log('No tags found to cleanup.', 'warn');
                return;
            }

            // 2. Analyze with LLM (Chunked)
            log(`Analyzing ${allUserTags.length} tags for duplicates/synonyms...`);
            // Sort case-insensitively
            const tagNames = allUserTags.map(t => t._id).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            debug(tagNames, 'All Tags (Sorted)');

            const mergePlan = {};

            // Check RuleEngine for auto-merges
            const autoMerges = [];
            const remainingTags = [];

            tagNames.forEach(tag => {
                const rule = RuleEngine.findRule('merge_tag', tag);
                if(rule) {
                    mergePlan[tag] = rule.target;
                    autoMerges.push([tag, rule.target]);
                } else {
                    remainingTags.push(tag);
                }
            });

            if (autoMerges.length > 0) {
                log(`Found ${autoMerges.length} auto-merge rules from memory.`);
            }

            const CHUNK_SIZE = 100; // Reduced from 500 to prevent errors

            for (let i = 0; i < remainingTags.length; i += CHUNK_SIZE) {
                if (STATE.stopRequested) break;
                const chunk = remainingTags.slice(i, i + CHUNK_SIZE);
                log(`Analyzing batch ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(remainingTags.length/CHUNK_SIZE)} (${chunk.length} tags)...`);

                try {
                    const chunkResult = await llm.analyzeTagConsolidation(chunk);
                    // Filter identity mappings
                    Object.entries(chunkResult).forEach(([k, v]) => {
                        if (k.toLowerCase() !== v.toLowerCase()) {
                            mergePlan[k] = v;
                        }
                    });
                } catch(e) {
                    log(`Failed to analyze batch: ${e.message}`, 'error');
                }

                // Pause slightly
                await new Promise(r => setTimeout(r, 500));
            }

            debug(mergePlan, 'Merge Plan (Combined)');

            let changes = Object.entries(mergePlan);
            if (changes.length === 0) {
                log('No tag consolidations suggested.');
                return;
            }

            log(`Proposed merges: ${changes.length}`);

            // Review Step for Cleanup
            // Filter out changes that are already rules (auto-approved)?
            // Or just show them as checked?
            // For now, let's show all, but maybe auto-check or highlight?
            // Actually, if we trust the rules, we shouldn't ask again.
            // But strict review mode might want confirmation.
            // Let's filter out auto-merged ones from review if possible, OR just pre-approve them.

            // We will pass ALL changes to review, but maybe user wants to see what's happening.

            if (STATE.config.reviewClusters) {
                log(`Pausing for review of ${changes.length} merges...`);
                const approved = await waitForTagCleanupReview(changes);
                if (approved) {
                    for (const [bad, good] of approved) {
                        engine.addRule('merge_tag', bad, good);
                    }
                }
                if (!approved) {
                    log('User cancelled merges. Stopping process.');
                    return;
                }
                changes = approved;
                log(`Approved ${changes.length} merges.`);
            }

            if (STATE.config.dryRun) {
                log('DRY RUN: No tags modified.');
                return;
            }

            // 3. Execute Merges
            let processed = 0;
            updateProgress(0);

            for (const [badTag, goodTag] of changes) {
                if (STATE.stopRequested) break;
                if (!goodTag || typeof goodTag !== 'string' || goodTag.trim() === '') {
                    log(`Skipping invalid merge pair: "${badTag}" -> "${goodTag}"`, 'warn');
                    continue;
                }

                log(`Merging "${badTag}" into "${goodTag}"...`);
                try {
                    await api.mergeTags([badTag], goodTag);
                    log(`Merged "${badTag}" -> "${goodTag}"`, 'success');
                } catch(e) {
                    log(`Failed to merge "${badTag}": ${e.message}`, 'error');
                }

                processed++;
                updateProgress((processed / changes.length) * 100);
            }
        }

        // --- Phase 2: Recursive Clustering & Organization ---
        if (mode === 'organize_only' || mode === 'full') {
            log('Phase 2: Recursive Organizing...');

            // Parse Ignored Tags
            const ignoredTagsList = STATE.config.ignoredTags
                ? STATE.config.ignoredTags.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
                : [];
            const ignoredTagsSet = new Set(ignoredTagsList);

            // Pre-fetch collections into cache to optimize hierarchical lookups
            log('Loading collection structure...');
            await api.loadCollectionCache(true);

            // Build ID->Name map for logging
            const collectionIdToName = { '-1': 'Unsorted', '0': 'All' };
            if (api.collectionCache) {
                api.collectionCache.forEach(c => {
                    collectionIdToName[c._id] = c.title;
                });
            }

            // Initialize category cache from loaded collections
            const categoryCache = {}; // name -> id
            try {
                const existingCols = await api.getCollections();
                existingCols.forEach(c => {
                    categoryCache[c.title.toLowerCase()] = c._id;
                    categoryCache[c.title] = c._id;
                });
            } catch(e) { console.warn("Could not pre-fetch collections"); }

            let iteration = 0;
            const MAX_ITERATIONS = 20; // Increased to allow full processing

            while(iteration < MAX_ITERATIONS && !STATE.stopRequested) {
                iteration++;
                log(`Starting Clustering Iteration ${iteration}...`);

                // Step A: Collect tags and counts
                let tagCounts = new Map(); // tag -> count
                let bookmarksToOrganizeMap = new Map(); // id -> bookmark (for dedup)

                // Fetch first few pages to analyze tags
                log('Scanning items for tags...');
                for(let p=0; p<4; p++) {
                    try {
                        const res = await api.getBookmarks(collectionId, p, searchQuery);
                        if (!res.items || res.items.length === 0) break;

                        res.items.forEach(bm => {
                            bookmarksToOrganizeMap.set(bm._id, bm);
                            bm.tags.forEach(t => {
                                if (!ignoredTagsSet.has(t.toLowerCase())) {
                                    tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
                                }
                            });
                        });
                    } catch(e) { break; }
                }

                const bookmarksToOrganize = Array.from(bookmarksToOrganizeMap.values());

                if (tagCounts.size === 0) {
                    log('No tags found (after filtering) in remaining items. Stopping.');
                    break;
                }

                // Sort tags by frequency
                const sortedTags = Array.from(tagCounts.entries())
                    .sort((a, b) => b[1] - a[1]) // Descending count
                    .map(entry => entry[0]);

                // Step B: Cluster top tags
                log(`Clustering top tags (out of ${sortedTags.length} unique) (Iteration ${iteration})...`);
                // Pass sorted tags so LLM sees the most important ones first
                const clusters = await llm.clusterTags(sortedTags);

                if (Object.keys(clusters).length === 0) {
                    log('No clusters suggested by LLM. Stopping.');
                    break;
                }

                log(`Clusters found: ${Object.keys(clusters).join(', ')}`);

                // Invert map (normalize keys to lowercase for matching)
                const tagToCategory = {};
                for (const [category, tags] of Object.entries(clusters)) {
                    tags.forEach(t => tagToCategory[t.toLowerCase()] = category);
                }
                debug(tagToCategory, 'Tag Mapping');

                // Step C: Prepare moves
                let itemsMovedInThisPass = 0;
                let pendingMoves = []; // { bm, category }

                for (const bm of bookmarksToOrganize) {
                     if (STATE.stopRequested) break;

                     const votes = {};
                     let maxVote = 0;
                     let bestCategory = null;

                     bm.tags.forEach(t => {
                         const cat = tagToCategory[t.toLowerCase()];
                         if (cat) {
                             votes[cat] = (votes[cat] || 0) + 1;
                             if (votes[cat] > maxVote) {
                                 maxVote = votes[cat];
                                 bestCategory = cat;
                             }
                         }
                     });

                     // Safe Mode Validation
                     if (bestCategory && STATE.config.safeMode) {
                         if (maxVote < STATE.config.minVotes) {
                             if (STATE.config.debugMode) {
                                 console.log(`[SafeMode] Skipping "${bm.title}" - Max Vote ${maxVote} < Min ${STATE.config.minVotes}`);
                             }
                             bestCategory = null;
                         }
                     }

                     if (STATE.config.debugMode) {
                         console.log(`[Clustering] Item "${bm.title}" votes:`, JSON.stringify(votes), `Winner: ${bestCategory}`);
                     }

                     if (bestCategory) {
                         pendingMoves.push({ bm, category: bestCategory });
                     }
                }

                if (pendingMoves.length === 0) {
                    log('No moves identified in this iteration.');
                    break;
                }

                // Review Step
                if (STATE.config.reviewClusters) {
                    log(`Pausing for review of ${pendingMoves.length} moves...`);
                    const approved = await waitForUserReview(pendingMoves);
                    if (approved) {
                        for (const move of approved) {
                            // Extract domain as the source for future rules
                            try {
                                const domain = new URL(move.bm.link).hostname;
                                engine.addRule('move_bookmark', domain, move.category);
                            } catch(e) {}
                        }
                    }
                    if (!approved) {
                        log('User cancelled moves. Stopping process.');
                        break;
                    }
                    pendingMoves = approved;
                    log(`Approved ${pendingMoves.length} moves.`);
                }

                // Execution Step
                for (const move of pendingMoves) {
                     if (STATE.stopRequested) break;
                     const { bm, category: bestCategory } = move;

                     // Check/Create Collection
                     let targetColId = categoryCache[bestCategory] || categoryCache[bestCategory.toLowerCase()];

                     if (!targetColId) {
                         try {
                             if (STATE.config.nestedCollections && (bestCategory.includes('>') || bestCategory.includes('/') || bestCategory.includes('\\'))) {
                                 log(`Ensuring path: ${bestCategory}`);
                                 targetColId = await api.ensureCollectionPath(bestCategory);
                             } else {
                                 // Flat creation logic
                                 const existingCols = await api.getCollections();
                                 const found = existingCols.find(c => c.title.toLowerCase() === bestCategory.toLowerCase());
                                 if (found) {
                                     targetColId = found._id;
                                 } else {
                                     log(`Creating collection: ${bestCategory}`);
                                     const newCol = await api.createCollection(bestCategory);
                                     targetColId = newCol.item._id;
                                 }
                             }

                             if(targetColId) {
                                 categoryCache[bestCategory] = targetColId;
                                 categoryCache[bestCategory.toLowerCase()] = targetColId;
                             }
                         } catch (e) {
                             log(`Error creating collection ${bestCategory}`, 'error');
                             continue;
                         }
                     }

                     // Move
                     if (targetColId) {
                         try {
                            await api.moveBookmark(bm._id, targetColId);
                            itemsMovedInThisPass++;
                            STATE.stats.moved++;
                            const sourceName = collectionIdToName[bm.collection?.$id] || 'Unknown';
                            log(`Moved "${bm.title}" (from ${sourceName}) -> ${bestCategory}`, 'success');
                         } catch(e) {
                             log(`Failed to move ${bm.title}`, 'error');
                         }
                     }
                }

                log(`Iteration ${iteration} complete. Moved ${itemsMovedInThisPass} items.`);

                if (itemsMovedInThisPass === 0) {
                    log("No items moved in this iteration. Stopping recursion to avoid infinite loop.");
                    break;
                }
            }
        }
    }



// Expose engines globally for UI bindings
if (typeof window !== 'undefined') {
    // Note: In the concatenated userscript, these classes are defined globally above this point
    // We just need to make sure they don't error out if called
}
    // Initialize
    function init() {
        if (document.getElementById('ras-container')) return; // Already initialized

        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand("Open AI Sorter", togglePanel);
        }

        STATE.init();

        if (STATE.config.darkMode) {
            document.body.classList.add('ras-dark-mode');
        }

        createUI();

        // Start Smart Triggers if enabled
        if (typeof SmartTriggers !== 'undefined') {
            SmartTriggers.start();
        }

        // Try to populate collections if token is already there
        if(STATE.config.raindropToken) {
            const api = new RaindropAPI(STATE.config.raindropToken);
            api.getCollections().then(items => {
                 const sel = document.getElementById('ras-collection-select');
                 if (sel) {
                     items.forEach(c => {
                         const opt = document.createElement('option');
                         opt.value = c._id;
                         opt.innerText = c.title;
                         sel.appendChild(opt);
                     });
                 }
            }).catch(e => console.log("Could not auto-load collections", e));
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        window.addEventListener('load', init);
    }

})();


