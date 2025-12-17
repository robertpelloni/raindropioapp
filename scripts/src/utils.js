    function createTooltipIcon(text) {
        return `<span class="ras-tooltip-icon" title="${text.replace(/"/g, '&quot;')}" data-tooltip="${text.replace(/"/g, '&quot;')}">?</span>`;
    }

<<<<<<< HEAD
=======
    function saveConfig() {
        STATE.config.raindropToken = document.getElementById('ras-raindrop-token').value;
        STATE.config.openaiKey = document.getElementById('ras-openai-key').value;
        STATE.config.anthropicKey = document.getElementById('ras-anthropic-key').value;
        STATE.config.provider = document.getElementById('ras-provider').value;
        STATE.config.skipTagged = document.getElementById('ras-skip-tagged').checked;
        STATE.config.customBaseUrl = document.getElementById('ras-custom-url').value;
        STATE.config.customModel = document.getElementById('ras-custom-model').value;
        STATE.config.concurrency = parseInt(document.getElementById('ras-concurrency').value) || 3;
        STATE.config.maxTags = parseInt(document.getElementById('ras-max-tags').value) || 5;
        STATE.config.dryRun = document.getElementById('ras-dry-run').checked;
        STATE.config.taggingPrompt = document.getElementById('ras-tag-prompt').value;
        STATE.config.clusteringPrompt = document.getElementById('ras-cluster-prompt').value;
        STATE.config.ignoredTags = document.getElementById('ras-ignored-tags').value;
        STATE.config.autoDescribe = document.getElementById('ras-auto-describe').checked;
        STATE.config.descriptionPrompt = document.getElementById('ras-desc-prompt').value;
        STATE.config.nestedCollections = document.getElementById('ras-nested-collections').checked;
        STATE.config.tagBrokenLinks = document.getElementById('ras-tag-broken').checked;
        STATE.config.debugMode = document.getElementById('ras-debug-mode').checked;
        STATE.config.reviewClusters = document.getElementById('ras-review-clusters').checked;
        STATE.config.minTagCount = parseInt(document.getElementById('ras-min-tag-count').value) || 2;
        STATE.config.deleteEmptyCols = document.getElementById('ras-delete-empty').checked;

        GM_setValue('raindropToken', STATE.config.raindropToken);
        GM_setValue('openaiKey', STATE.config.openaiKey);
        GM_setValue('anthropicKey', STATE.config.anthropicKey);
        GM_setValue('provider', STATE.config.provider);
        GM_setValue('customBaseUrl', STATE.config.customBaseUrl);
        GM_setValue('customModel', STATE.config.customModel);
        GM_setValue('concurrency', STATE.config.concurrency);
        GM_setValue('maxTags', STATE.config.maxTags);
        GM_setValue('taggingPrompt', STATE.config.taggingPrompt);
        GM_setValue('clusteringPrompt', STATE.config.clusteringPrompt);
        GM_setValue('ignoredTags', STATE.config.ignoredTags);
        GM_setValue('descriptionPrompt', STATE.config.descriptionPrompt);
        GM_setValue('tagBrokenLinks', STATE.config.tagBrokenLinks);
        GM_setValue('reviewClusters', STATE.config.reviewClusters);
        GM_setValue('minTagCount', STATE.config.minTagCount);
        GM_setValue('deleteEmptyCols', STATE.config.deleteEmptyCols);
    }

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
    function log(message, type='info') {
        const logContainer = document.getElementById('ras-log');
        const entry = document.createElement('div');
        entry.className = `ras-log-entry ras-log-${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContainer.prepend(entry); // Newest first
<<<<<<< HEAD

=======

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
        if (type === 'error') {
            console.error(`[RAS] ${message}`);
        } else {
            console.log(`[RAS] ${message}`);
        }
    }
<<<<<<< HEAD

=======

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
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
<<<<<<< HEAD

=======

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
    function debug(obj, label='DEBUG') {
        if (STATE.config.debugMode) {
            console.group(`[RAS] ${label}`);
            console.log(obj);
            console.groupEnd();
        }
    }
<<<<<<< HEAD

=======

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
    function updateProgress(percent) {
        const bar = document.getElementById('ras-progress-bar');
        const container = document.getElementById('ras-progress-container');
        if (bar && container) {
            container.style.display = 'block';
            bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
    }
<<<<<<< HEAD

=======

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
    function updateTokenStats(inputLen, outputLen) {
        // Approx 4 chars per token
        const inputTokens = Math.ceil(inputLen / 4);
        const outputTokens = Math.ceil(outputLen / 4);
<<<<<<< HEAD

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

=======

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

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
    // Scraper
    async function scrapeUrl(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 10000,
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                         const parser = new DOMParser();
                         const doc = parser.parseFromString(response.responseText, "text/html");
<<<<<<< HEAD

                         // Clean up junk
                         const toRemove = doc.querySelectorAll('script, style, nav, footer, iframe, noscript, svg, [role="alert"], .ads, .comment, .menu');
                         toRemove.forEach(s => s.remove());

                         // Improved Extraction (Readability-lite)
                         // 1. Find all paragraphs
                         const paragraphs = Array.from(doc.querySelectorAll('p'));

=======

                         // Clean up junk
                         const toRemove = doc.querySelectorAll('script, style, nav, footer, iframe, noscript, svg, [role="alert"], .ads, .comment, .menu');
                         toRemove.forEach(s => s.remove());

                         // Improved Extraction (Readability-lite)
                         // 1. Find all paragraphs
                         const paragraphs = Array.from(doc.querySelectorAll('p'));

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
                         // 2. Score parents
                         const parentScores = new Map();
                         let maxScore = 0;
                         let bestCandidate = doc.body;

                         paragraphs.forEach(p => {
                             const text = p.innerText || "";
                             if (text.length < 50) return; // Skip short blurbs
<<<<<<< HEAD

                             const parent = p.parentElement;
                             const score = text.length; // Simple score by length

                             const current = parentScores.get(parent) || 0;
                             const newScore = current + score;
                             parentScores.set(parent, newScore);

=======

                             const parent = p.parentElement;
                             const score = text.length; // Simple score by length

                             const current = parentScores.get(parent) || 0;
                             const newScore = current + score;
                             parentScores.set(parent, newScore);

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
                             if (newScore > maxScore) {
                                 maxScore = newScore;
                                 bestCandidate = parent;
                             }
                         });

                         // 3. Extract text from best candidate (or body fallback)
                         // 3. Extract text from best candidate (or body fallback)
                         const contentEl = bestCandidate || doc.body;
                         const bodyText = contentEl.innerText || contentEl.textContent;
                         let cleanText = bodyText.replace(/\s+/g, ' ').trim();
<<<<<<< HEAD

=======

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
                         // 4. Metadata Fallback (if text is too short)
                         if (cleanText.length < 500) {
                             const ogDesc = doc.querySelector('meta[property="og:description"]')?.content || "";
                             const metaDesc = doc.querySelector('meta[name="description"]')?.content || "";
                             const ogTitle = doc.querySelector('meta[property="og:title"]')?.content || "";
<<<<<<< HEAD

=======

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
                             const metadata = [ogTitle, ogDesc, metaDesc].filter(s => s).join("\n");
                             if (metadata.length > cleanText.length) {
                                 cleanText = metadata + "\n" + cleanText;
                             }
                         }
<<<<<<< HEAD

=======

>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
                         resolve({
                             title: doc.title,
                             text: cleanText.substring(0, 15000)
                         });
                    } else {
                        console.warn(`Failed to scrape ${url}: ${response.status}`);
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
