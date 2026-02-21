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
