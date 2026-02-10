// ==UserScript==
// @name         Raindrop.io AI Sorter
// @namespace    http://tampermonkey.net/
// @version      1.0.4
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
    };

    console.log('Raindrop.io AI Sorter loaded');


    function createTooltipIcon(text) {
        return `<span class="ras-tooltip-icon" title="${text.replace(/"/g, '&quot;')}" data-tooltip="${text.replace(/"/g, '&quot;')}">?</span>`;
    }

    function log(message, type='info') {
        const logContainer = document.getElementById('ras-log');
        const entry = document.createElement('div');
        entry.className = `ras-log-entry ras-log-${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContainer.prepend(entry); // Newest first

        if (type === 'error') {
            console.error(`[RAS] ${message}`);
        } else {
            console.log(`[RAS] ${message}`);
        }
    }

    function logAction(actionType, details) {
        const entry = {
            timestamp: new Date().toISOString(),
            type: actionType,
            ...details
        };
        STATE.actionLog.push(entry);
    }

    function exportAuditLog() {
        if (STATE.actionLog.length === 0) {
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
        if (STATE.config.debugMode) {
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

        STATE.stats.tokens.input += inputTokens;
        STATE.stats.tokens.output += outputTokens;

        const total = STATE.stats.tokens.input + STATE.stats.tokens.output;

        // Very rough cost est (blended gpt-3.5/4o-mini rate ~ $0.50/1M tokens input, $1.50/1M output)
        // Let's assume generic ~$1.00 per 1M tokens for simplicity, or 0.000001 per token
        const cost = (STATE.stats.tokens.input * 0.0000005) + (STATE.stats.tokens.output * 0.0000015);

        const tokenEl = document.getElementById('ras-stats-tokens');
        const costEl = document.getElementById('ras-stats-cost');

        if(tokenEl) tokenEl.textContent = `Tokens: ${(total/1000).toFixed(1)}k`;
        if(costEl) costEl.textContent = `Est: $${cost.toFixed(4)}`;
    }

    function exportConfig() {
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
    }

    function importConfig(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const config = JSON.parse(evt.target.result);
                // Apply known keys
                Object.keys(config).forEach(k => {
                    // Basic validation to avoid polluting GM storage
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
    async function scrapeUrl(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
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


    // LLM Client
    class LLMClient {
        constructor(config, network) {
            this.config = config;
            this.network = network || new NetworkClient();
        }

        async generateTags(content, existingTags = [], imageUrl = null) {
            let prompt = this.config.taggingPrompt;
            const ignoredTags = this.config.ignoredTags || "";
            const autoDescribe = this.config.autoDescribe;
            const descriptionPrompt = this.config.descriptionPrompt || "Summarize the content in 1-2 concise sentences.";
            const maxTags = this.config.maxTags || 5;

            if (!prompt || prompt.trim() === '') {
                 prompt = `
                    Analyze the following web page content.

                    Task 1: Suggest ${maxTags} broad, high-level tags.
                    ${autoDescribe ? 'Task 2: ' + descriptionPrompt : ''}

                    Rules:
                    - Tags should be broad categories (e.g. "Technology", "Health", "Finance") rather than ultra-specific keywords.
                    - Limit to exactly ${maxTags} tags.
                    - Avoid using these tags: {{IGNORED_TAGS}}

                    Output ONLY a JSON object with the following structure:
                    {
                        "tags": ["tag1", "tag2"],
                        ${autoDescribe ? '"description": "The summary string"' : ''}
                    }

                    No markdown, no explanation.

                    Content:
                    {{CONTENT}}
                `;
            }

            // Replace placeholder
            prompt = prompt.replace('{{CONTENT}}', content.substring(0, 4000));
            prompt = prompt.replace('{{IGNORED_TAGS}}', ignoredTags);

            // Fallback if user didn't include {{CONTENT}}
            if (!prompt.includes(content.substring(0, 100))) {
                 prompt += `\n\nContent:\n${content.substring(0, 4000)}`;
            }

            let finalPrompt = prompt;
            if (imageUrl) {
                finalPrompt = [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: imageUrl } }
                ];
            }

            let result = null;
            try {
                if (this.config.provider === 'openai') {
                    result = await this.callOpenAI(finalPrompt, true);
                } else if (this.config.provider === 'anthropic') {
                    result = await this.callAnthropic(prompt, true);
                } else if (this.config.provider === 'groq') {
                    result = await this.callGroq(imageUrl ? finalPrompt : prompt, true);
                } else if (this.config.provider === 'deepseek') {
                    result = await this.callDeepSeek(prompt, true);
                } else if (this.config.provider === 'custom') {
                    result = await this.callOpenAI(finalPrompt, true, true);
                }
            } catch (e) {
                console.error("LLM Generation Error:", e);
                return { tags: [], description: null };
            }

            // Normalize result
            if (Array.isArray(result)) {
                return { tags: result.slice(0, maxTags), description: null };
            } else if (result && result.tags) {
                result.tags = result.tags.slice(0, maxTags);
                return result;
            } else {
                return { tags: [], description: null };
            }
        }

        async clusterTags(allTags) {
             let prompt = this.config.clusteringPrompt;
             const allowNested = this.config.nestedCollections;

             // Safeguard: Limit tags to prevent context overflow if list is huge
             const MAX_TAGS_FOR_CLUSTERING = 200; // Reduced from 500 to prevent LLM output truncation
             let tagsToProcess = allTags;
             if (allTags.length > MAX_TAGS_FOR_CLUSTERING) {
                 console.warn(`[RAS] Too many tags (${allTags.length}). Truncating to ${MAX_TAGS_FOR_CLUSTERING} for clustering.`);
                 tagsToProcess = allTags.slice(0, MAX_TAGS_FOR_CLUSTERING);
             }

             if (!prompt || prompt.trim() === '') {
                 prompt = `
                    Analyze this list of tags and group them into 5-10 broad categories.
                    ${allowNested ? 'You may use nested categories separated by ">" (e.g. "Development > Web").' : ''}
                    Output ONLY a JSON object where keys are category names and values are arrays of tags.
                    Do not add any markdown formatting or explanation. Just the JSON.
                    e.g. { "Programming": ["python", "js"], "News": ["politics"] }

                    Tags:
                    {{TAGS}}
                `;
             }

             prompt = prompt.replace('{{TAGS}}', JSON.stringify(tagsToProcess));

             // Fallback
             if (!prompt.includes(tagsToProcess[0])) {
                  prompt += `\n\nTags:\n${JSON.stringify(tagsToProcess)}`;
             }

             if (this.config.provider === 'openai') return await this.callOpenAI(prompt, true);
             if (this.config.provider === 'anthropic') return await this.callAnthropic(prompt, true);
             if (this.config.provider === 'groq') return await this.callGroq(prompt, true);
             if (this.config.provider === 'deepseek') return await this.callDeepSeek(prompt, true);
             if (this.config.provider === 'custom') return await this.callOpenAI(prompt, true, true);
             return {};
        }

        async classifyBookmarkIntoExisting(bookmark, collectionNames) {
            let prompt = this.config.classificationPrompt;
            if (!prompt || prompt.trim() === '') {
                prompt = `
                    Classify the following bookmark into exactly ONE of the provided categories.

                    Bookmark:
                    {{BOOKMARK}}

                    Categories:
                    {{CATEGORIES}}

                    Output ONLY a JSON object: { "category": "Exact Category Name" }
                    If no category fits well, return null for category.
                `;
            }

            const bookmarkDetails = `Title: ${bookmark.title}\nExcerpt: ${bookmark.excerpt}\nURL: ${bookmark.link}`;
            prompt = prompt.replace('{{BOOKMARK}}', bookmarkDetails);
            prompt = prompt.replace('{{CATEGORIES}}', JSON.stringify(collectionNames));

            if (!prompt.includes(bookmark.title)) {
                 prompt += `\n\nBookmark:\n${bookmarkDetails}\n\nCategories:\n${JSON.stringify(collectionNames)}`;
            }

            if (this.config.provider === 'anthropic') return await this.callAnthropic(prompt, true);
            if (this.config.provider === 'groq') return await this.callGroq(prompt, true);
            if (this.config.provider === 'deepseek') return await this.callDeepSeek(prompt, true);
            return await this.callOpenAI(prompt, true, this.config.provider === 'custom');
        }

        async classifyBookmarkSemantic(bookmark, collectionPaths) {
            const prompt = `
                Analyze the bookmark and the existing folder structure.
                Determine the most appropriate folder path for this bookmark.
                You can choose an existing path or suggest a new one if it doesn't fit.

                Format: "Parent > Child > Grandchild"

                Bookmark:
                Title: ${bookmark.title}
                Excerpt: ${bookmark.excerpt}
                URL: ${bookmark.link}

                Existing Paths:
                ${JSON.stringify(collectionPaths)}

                Output ONLY a JSON object: { "path": "Folder > Subfolder" }
            `;

            if (this.config.provider === 'anthropic') return await this.callAnthropic(prompt, true);
            if (this.config.provider === 'groq') return await this.callGroq(prompt, true);
            if (this.config.provider === 'deepseek') return await this.callDeepSeek(prompt, true);
            return await this.callOpenAI(prompt, true, this.config.provider === 'custom');
        }

        async analyzeTagConsolidation(allTags) {
            const prompt = `
                Analyze this list of tags and identify synonyms, typos, or duplicates.
                Create a mapping where the key is the "Bad/Deprecated" tag and the value is the "Canonical/Good" tag.

                Rules:
                1. Only include pairs where a merge is necessary (synonyms, typos, plurals).
                2. Do NOT map a tag to itself (e.g. "AI": "AI" is forbidden).
                3. Do NOT merge distinct concepts (e.g. "Java" and "JavaScript" are different).
                4. Be conservative. If unsure, do not include it.

                Example: { "js": "javascript", "reactjs": "react", "machine-learning": "ai" }

                Tags:
                ${JSON.stringify(allTags.slice(0, 1000))}
            `;

            if (this.config.provider === 'anthropic') return await this.callAnthropic(prompt, true);
            if (this.config.provider === 'groq') return await this.callGroq(prompt, true);
            if (this.config.provider === 'deepseek') return await this.callDeepSeek(prompt, true);
            return await this.callOpenAI(prompt, true, this.config.provider === 'custom');
        }

        repairJSON(jsonStr) {
            let cleaned = jsonStr.trim();
            if (!cleaned) return "{}";

            const firstBrace = cleaned.indexOf('{');
            const firstBracket = cleaned.indexOf('[');

            if (firstBrace === -1 && firstBracket === -1) return "{}";

            let isObject = false;
            if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
                isObject = true;
                cleaned = cleaned.substring(firstBrace);
            } else {
                cleaned = cleaned.substring(firstBracket);
            }

            try {
                JSON.parse(cleaned);
                return cleaned;
            } catch(e) {}

            // Smart Repair
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

            let repaired = cleaned;
            if (inString) repaired += '"';
            while (stack.length > 0) {
                repaired += stack.pop();
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


    // UI Styles
    GM_addStyle(`
        :root {
            --ras-bg: #fff;
            --ras-text: #333;
            --ras-border: #ddd;
            --ras-input-bg: #fff;
            --ras-header-bg: #f5f5f5;
            --ras-hover-bg: #f0f0f0;
        }
        /* Dark Mode Support (Raindrop uses .theme-dark on html/body) */
        html.theme-dark #ras-container, body.theme-dark #ras-container {
            --ras-bg: #1c1c1c;
            --ras-text: #e0e0e0;
            --ras-border: #333;
            --ras-input-bg: #2a2a2a;
            --ras-header-bg: #252525;
            --ras-hover-bg: #333;
        }

        #ras-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 380px;
            background: var(--ras-bg);
            color: var(--ras-text);
            border: 1px solid var(--ras-border);
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: none;
            flex-direction: column;
            max-height: 85vh;
        }
        #ras-container.minimized {
            width: auto;
            height: auto;
            background: transparent;
            border: none;
            box-shadow: none;
        }
        #ras-header {
            padding: 12px;
            background: var(--ras-header-bg);
            border-bottom: 1px solid var(--ras-border);
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            font-weight: 600;
        }
        #ras-tabs {
            display: flex;
            border-bottom: 1px solid var(--ras-border);
            background: var(--ras-header-bg);
        }
        .ras-tab-btn {
            flex: 1;
            padding: 8px 0;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            color: var(--ras-text);
            opacity: 0.7;
            border-bottom: 2px solid transparent;
        }
        .ras-tab-btn:hover { background: var(--ras-hover-bg); }
        .ras-tab-btn.active {
            color: #007aff;
            opacity: 1;
            border-bottom: 2px solid #007aff;
            background: var(--ras-bg);
        }
        #ras-body {
            padding: 15px;
            overflow-y: auto;
            flex-grow: 1;
        }
        .ras-tab-content { display: none; }
        .ras-tab-content.active { display: block; }

        #ras-toggle-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 25px;
            background: #007aff;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            font-size: 24px;
        }
        .ras-field { margin-bottom: 12px; }
        .ras-field label { display: block; margin-bottom: 4px; font-size: 12px; color: #666; }
        .ras-field input, .ras-field select, .ras-field textarea {
            width: 100%;
            padding: 6px;
            border: 1px solid var(--ras-border);
            background: var(--ras-input-bg);
            color: var(--ras-text);
            border-radius: 4px;
            box-sizing: border-box;
            font-family: inherit;
        }
        .ras-field textarea { font-family: monospace; font-size: 11px; }
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
        .ras-btn:disabled { background: #ccc; cursor: not-allowed; }
        .ras-btn.stop { background: #ff3b30; margin-top: 10px; }
        #ras-log {
            margin-top: 10px;
            height: 150px;
            overflow-y: auto;
            background: #f9f9f9;
            border: 1px solid #eee;
            padding: 8px;
            font-size: 11px;
            font-family: monospace;
            white-space: pre-wrap;
        }
        #ras-stats-bar {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #666;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
            margin-bottom: 10px;
        }
        .ras-log-entry { margin-bottom: 2px; border-bottom: 1px solid #eee; padding-bottom: 2px; }
        .ras-log-info { color: #333; }
        .ras-log-success { color: #28a745; }
        .ras-log-error { color: #dc3545; }
        .ras-log-warn { color: #ffc107; }

        /* Tooltips */
        .ras-tooltip-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            background: #eee;
            color: #666;
            border-radius: 50%;
            font-size: 10px;
            margin-left: 6px;
            cursor: help;
            border: 1px solid #ccc;
            pointer-events: auto;
        }
        .ras-tooltip-icon:hover {
            background: #007aff;
            color: white;
            border-color: #007aff;
        }
        #ras-tooltip-overlay {
            position: fixed;
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10001;
            max-width: 250px;
            pointer-events: none;
            display: none;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            line-height: 1.4;
        }
        #ras-review-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 1px solid #ccc;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            width: 400px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            z-index: 10002;
            border-radius: 8px;
            display: none;
        }
        #ras-review-header {
            padding: 10px;
            border-bottom: 1px solid #eee;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
        }
        #ras-review-body {
            padding: 10px;
            overflow-y: auto;
            flex-grow: 1;
        }
        #ras-review-footer {
            padding: 10px;
            border-top: 1px solid #eee;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .ras-review-item {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px solid #f9f9f9;
        }
    `);

    // UI Construction
    function createUI() {
        I18N.current = STATE.config.language || 'en';

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
                ${I18N.get('title')} <span style="font-weight: normal; font-size: 11px; margin-left: 5px;">v1.0.4</span>
                <span id="ras-close-btn" style="cursor: pointer;">✖</span>
            </div>
            <div id="ras-tabs">
                <button class="ras-tab-btn active" data-tab="dashboard">${I18N.get('dashboard')}</button>
                <button class="ras-tab-btn" data-tab="settings">${I18N.get('settings')}</button>
                <button class="ras-tab-btn" data-tab="prompts">${I18N.get('prompts')}</button>
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
                            </optgroup>
                            <optgroup label="Maintenance">
                                <option value="cleanup_tags">${I18N.get('cleanup')}</option>
                                <option value="prune_tags">${I18N.get('prune')}</option>
                                <option value="flatten">${I18N.get('flatten')}</option>
                                <option value="delete_all_tags">${I18N.get('delete_all')}</option>
                            </optgroup>
                        </select>
                    </div>

                    <div class="ras-field">
                        <label>${I18N.get('lbl_search_filter')} ${createTooltipIcon(I18N.get('tt_search_filter'))}</label>
                        <input type="text" id="ras-search-input" placeholder="Optional search query...">
                    </div>

                    <div id="ras-progress-container" style="display:none; margin-bottom: 10px; background: #eee; height: 10px; border-radius: 5px; overflow: hidden;">
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
                    </div>

                    <div id="ras-log"></div>
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

                <!-- HELP TAB -->
                <div id="ras-tab-help" class="ras-tab-content">
                    <div style="font-size:12px; line-height:1.5; color:var(--ras-text);">
                        <p><strong>Modes:</strong></p>
                        <ul style="padding-left:15px; margin:5px 0;">
                            <li><b>Tag Only:</b> Adds tags to bookmarks using AI.</li>
                            <li><b>Organize:</b> Clusters tags and moves bookmarks into folders.</li>
                            <li><b>Cleanup:</b> Merges duplicate/synonym tags.</li>
                            <li><b>Flatten:</b> Moves all items to Unsorted and deletes empty folders.</li>
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

        // Event Listeners
        document.getElementById('ras-provider').addEventListener('change', (e) => {
            updateProviderVisibility();
            saveConfig();
        });

        document.getElementById('ras-start-btn').addEventListener('click', startSorting);
        document.getElementById('ras-stop-btn').addEventListener('click', stopSorting);
        document.getElementById('ras-export-btn').addEventListener('click', exportAuditLog);

        document.getElementById('ras-export-config-btn').addEventListener('click', exportConfig);
        document.getElementById('ras-import-config-btn').addEventListener('click', () => {
            document.getElementById('ras-import-file').click();
        });
        document.getElementById('ras-import-file').addEventListener('change', importConfig);

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
                classification: document.getElementById('ras-class-prompt').value
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
                document.getElementById('ras-class-prompt').value = presets[name].classification || '';
                saveConfig();
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

        document.getElementById('ras-safe-mode').addEventListener('change', (e) => {
             document.getElementById('ras-min-votes-container').style.display = e.target.checked ? 'inline' : 'none';
        });

        document.getElementById('ras-auto-describe').addEventListener('change', (e) => {
             document.getElementById('ras-desc-prompt-group').style.display = e.target.checked ? 'block' : 'none';
        });

        updateProviderVisibility();
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

            items.forEach((item, idx) => {
                const div = document.createElement('div');
                div.className = 'ras-review-item';
                div.innerHTML = `
                    <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <input type="checkbox" checked data-idx="${idx}">
                        <span title="${item.bm.title.replace(/"/g, '&quot;')}">${item.bm.title}</span>
                    </div>
                    <div style="margin-left:10px; font-weight:bold;">→ ${item.category}</div>
                `;
                body.appendChild(div);
            });

            panel.style.display = 'flex';

            const handleConfirm = () => {
                const approved = [];
                body.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                    approved.push(items[cb.dataset.idx]);
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
                // Clone to remove listeners or use named functions?
                // Named functions defined inside closure are fine if removed.
                // But addEventListener adds new ones.
                // Using .onclick is safer to avoid stacking?
                // No, standard removeEventListener works if reference matches.
                // But I defined them inside. So I need to store reference?
                // The cleanup function removes them.
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

            changes.forEach((change, idx) => {
                const [bad, good] = change;
                const div = document.createElement('div');
                div.className = 'ras-review-item';
                div.innerHTML = `
                    <div style="flex:1;">
                        <input type="checkbox" checked data-idx="${idx}">
                        <span style="color:#d32f2f;">${bad}</span> → <span style="color:#28a745;">${good}</span>
                    </div>
                `;
                body.appendChild(div);
            });

            panel.style.display = 'flex';

            const handleConfirm = () => {
                const approved = [];
                body.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                    approved.push(changes[cb.dataset.idx]);
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

        const api = new RaindropAPI(STATE.config.raindropToken, network);
        const llm = new LLMClient(STATE.config, network);
        const collectionId = document.getElementById('ras-collection-select').value;
        const searchQuery = document.getElementById('ras-search-input').value.trim();
        const mode = document.getElementById('ras-action-mode').value;

        let allTags = new Set();
        let processedCount = 0;

        // ============================
        // MODE: Flatten Library
        // ============================
        if (mode === 'flatten') {
            log('Starting Library Flattening (Reset to Unsorted)...');
            if (confirm("WARNING: This will move bookmarks to 'Unsorted' and optionally DELETE empty folders. Continue?")) {
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
            const existingPaths = Object.values(idToPath).sort();

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
                        const result = await llm.classifyBookmarkSemantic(bm, existingPaths);
                        if (result && result.path) {
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
                                const scraped = await scrapeUrl(bm.link);

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
            const CHUNK_SIZE = 100; // Reduced from 500 to prevent errors

            for (let i = 0; i < tagNames.length; i += CHUNK_SIZE) {
                if (STATE.stopRequested) break;
                const chunk = tagNames.slice(i, i + CHUNK_SIZE);
                log(`Analyzing batch ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(tagNames.length/CHUNK_SIZE)} (${chunk.length} tags)...`);

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
            if (STATE.config.reviewClusters) {
                log(`Pausing for review of ${changes.length} merges...`);
                const approved = await waitForTagCleanupReview(changes);
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


    // Initialize
    function init() {
        if (document.getElementById('ras-container')) return; // Already initialized

        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand("Open AI Sorter", togglePanel);
        }

        createUI();
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


