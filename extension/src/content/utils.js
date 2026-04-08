import { STATE } from './state.js';
import { NetworkClient } from './network.js';

// Global network client instance for utilities
const networkClient = new NetworkClient();

// --- Vision Helper ---
export async function fetchImageAsBase64(url) {
    // In Manifest V3, we must use the background service worker or a standard fetch if CORS allows.
    // Assuming Raindrop user cover URLs have loose CORS or we proxy through the background worker.
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = function() {
                resolve(reader.result); // Returns data:image/jpeg;base64,...
            }
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        throw new Error(`Failed to fetch image: ${e.message}`);
    }
}

export function createTooltipIcon(text) {
    return `<span class="ras-tooltip-icon" title="${text.replace(/"/g, '&quot;')}" data-tooltip="${text.replace(/"/g, '&quot;')}">?</span>`;
}

export function log(message, type='info') {
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

export function logAction(actionType, details) {
    if (!STATE.actionLog) STATE.actionLog = [];
    const entry = {
        timestamp: new Date().toISOString(),
        type: actionType,
        ...details
    };
    STATE.actionLog.push(entry);
}

export function exportAuditLog() {
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

export function debug(obj, label='DEBUG') {
    if (STATE.config && STATE.config.debugMode) {
        console.group(`[RAS] ${label}`);
        console.log(obj);
        console.groupEnd();
    }
}

export function updateProgress(percent) {
    const bar = document.getElementById('ras-progress-bar');
    const container = document.getElementById('ras-progress-container');
    if (bar && container) {
        container.style.display = 'block';
        bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
}

export function updateTokenStats(inputLen, outputLen) {
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

export function importConfig(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const config = JSON.parse(evt.target.result);
            Object.keys(config).forEach(k => {
                if (typeof STATE.config[k] !== 'undefined') {
                    STATE.setConfig(k, config[k]);
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

// Ensure global attachment for UI event listeners
if (typeof window !== 'undefined') {
    window.importConfig = importConfig;
}

// Archivist: Wayback Machine Check
export async function checkWaybackMachine(url) {
    try {
        const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
        const response = await networkClient.fetch({
            method: 'GET',
            url: apiUrl
        });
        const data = JSON.parse(response.responseText);
        if (data && data.archived_snapshots && data.archived_snapshots.closest) {
            return data.archived_snapshots.closest.url;
        }
        return null;
    } catch(e) {
        console.warn(`[RAS] Wayback check failed for ${url}`, e);
        return null;
    }
}

// Scraper
export async function scrapeUrl(url, signal = null) {
    if (signal && signal.aborted) return { error: 'aborted' };

    try {
        const response = await networkClient.fetch({
            method: 'GET',
            url: url
        }, signal);

        if (response.status >= 200 && response.status < 300) {
            const contentType = (response.responseHeaders.match(/content-type:\s*(.*)/i) || [])[1] || '';
            if (contentType && !contentType.includes('text') && !contentType.includes('html') && !contentType.includes('json') && !contentType.includes('xml')) {
                console.warn(`Skipping non-text content: ${contentType}`);
                return { error: 'skipped_binary' };
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(response.responseText, "text/html");

                         // Clean up junk
                         const toRemove = doc.querySelectorAll('script, style, nav, footer, header, aside, iframe, noscript, svg, [role="alert"], .ads, .comment, .menu, .cookie-banner, .modal, .popup, .newsletter');
                         toRemove.forEach(s => s.remove());

                         // Improved Extraction (Readability-lite v3)
                         // 1. Find all text containers
                         const blockElements = doc.querySelectorAll('p, div, article, section, li, h1, h2, h3, h4, h5, h6');
                         let candidates = [];

                         blockElements.forEach(el => {
                             let text = (el.innerText || el.textContent || "").replace(/\s+/g, ' ').trim();
                             if (text.length < 30) return; // Skip fragments

                             // Explicitly ignore common junk patterns
                             const lower = text.toLowerCase();
                             if (lower.includes('cookie') && (lower.includes('accept') || lower.includes('consent'))) return;
                             if (lower.includes('newsletter') && lower.includes('subscribe')) return;
                             if (lower.includes('all rights reserved')) return;

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
                         candidates.sort((a, b) => b.score - a.score);

                         // Pick top 3-5 candidates
                         const topCandidates = candidates.slice(0, 5);
                         let combinedText = topCandidates.map(c => c.text).join('\n\n');

                         // Fallback to body if nothing found
                         if (combinedText.length < 100) {
                             const bodyText = doc.body ? (doc.body.innerText || doc.body.textContent || "") : "";
                             combinedText = bodyText.replace(/\s+/g, ' ').trim();
                         }

                         // Metadata Fallback
                         let fallbackUsed = false;
                         if (combinedText.length < 500) {
                             const ogDesc = doc.querySelector('meta[property="og:description"]')?.content || "";
                             const metaDesc = doc.querySelector('meta[name="description"]')?.content || "";
                             const ogTitle = doc.querySelector('meta[property="og:title"]')?.content || "";

                             const metadata = [ogTitle, ogDesc, metaDesc].filter(s => s).join("\n");
                             if (metadata.length > combinedText.length) {
                                 combinedText = metadata + "\n" + combinedText;
                                 fallbackUsed = true;
                             }
                         }

            // SPA / JS-heavy fallback (Jina Reader API)
            if (combinedText.length < 500 && !fallbackUsed) {
                console.log(`[RAS] Insufficient text extracted from ${url}. Attempting SPA fallback via r.jina.ai...`);
                try {
                    const jinaRes = await networkClient.fetch({
                        method: 'GET',
                        url: `https://r.jina.ai/${encodeURIComponent(url)}`
                    }, signal);

                    if (jinaRes.status >= 200 && jinaRes.status < 300) {
                        console.log(`[RAS] SPA fallback successful for ${url}`);
                        return {
                            title: doc.title,
                            text: jinaRes.responseText.substring(0, 15000)
                        };
                    }
                } catch(e) {
                    console.warn(`[RAS] SPA fallback failed`, e);
                }
            }

            return {
                title: doc.title,
                text: combinedText.substring(0, 15000)
            };
        } else {
            console.warn(`Failed to scrape ${url}: ${response.status}`);
            return { error: response.status };
        }
    } catch(err) {
        console.warn(`Error scraping ${url}:`, err);
        return { error: err.message === 'Aborted' ? 'aborted' : 'network_error' };
    }
}
