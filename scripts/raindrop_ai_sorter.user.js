// ==UserScript==
// @name         Raindrop.io AI Sorter
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  Scrapes Raindrop.io bookmarks, tags them using AI, and organizes them into collections.
// @author       You
// @match        https://app.raindrop.io/*
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
            tokens: { input: 0, output: 0 }
        },
        actionLog: [],
        config: {
            openaiKey: GM_getValue('openaiKey', ''),
            anthropicKey: GM_getValue('anthropicKey', ''),
            raindropToken: GM_getValue('raindropToken', ''),
            provider: GM_getValue('provider', 'openai'), // 'openai', 'anthropic', or 'custom'
            customBaseUrl: GM_getValue('customBaseUrl', 'http://localhost:11434/v1'),
            customModel: GM_getValue('customModel', 'llama3'),
            model: GM_getValue('model', 'gpt-3.5-turbo'),
            concurrency: GM_getValue('concurrency', 20),
            maxTags: GM_getValue('maxTags', 5),
            targetCollectionId: 0, // 0 is 'All bookmarks'
            skipTagged: false,
            dryRun: false,
            taggingPrompt: GM_getValue('taggingPrompt', ''),
            clusteringPrompt: GM_getValue('clusteringPrompt', ''),
            ignoredTags: GM_getValue('ignoredTags', ''),
            autoDescribe: false,
            descriptionPrompt: GM_getValue('descriptionPrompt', ''),
            nestedCollections: false,
            debugMode: false,
            reviewClusters: GM_getValue('reviewClusters', false)
        }
    };

    console.log('Raindrop.io AI Sorter loaded');

    // UI Styles
    GM_addStyle(`
        #ras-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 350px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: none;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
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
            background: #f5f5f5;
            border-bottom: 1px solid #ddd;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            font-weight: 600;
        }
        #ras-body {
            padding: 15px;
            overflow-y: auto;
        }
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
        .ras-field input, .ras-field select {
            width: 100%;
            padding: 6px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
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
            margin-top: 15px;
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

    function createTooltipIcon(text) {
        return `<span class="ras-tooltip-icon" title="${text.replace(/"/g, '&quot;')}" data-tooltip="${text.replace(/"/g, '&quot;')}">?</span>`;
    }

    // UI Construction
    function createUI() {
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
                Raindrop AI Sorter
                <span style="font-size: 12px; font-weight: normal;">v0.1</span>
            </div>
            <div id="ras-body">
                <div class="ras-field">
                    <label>Raindrop Test Token</label>
                    <input type="password" id="ras-raindrop-token" placeholder="Enter Test Token from Settings" value="${STATE.config.raindropToken}">
                </div>

                <div class="ras-field">
                    <label>AI Provider</label>
                    <select id="ras-provider">
                        <option value="openai" ${STATE.config.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                        <option value="anthropic" ${STATE.config.provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                        <option value="custom" ${STATE.config.provider === 'custom' ? 'selected' : ''}>Custom / Local (Ollama)</option>
                    </select>
                </div>

                <div class="ras-field" id="ras-openai-group">
                    <label>OpenAI API Key</label>
                    <input type="password" id="ras-openai-key" placeholder="sk-..." value="${STATE.config.openaiKey}">
                </div>

                <div class="ras-field" id="ras-anthropic-group" style="display:none">
                    <label>Anthropic API Key</label>
                    <input type="password" id="ras-anthropic-key" placeholder="sk-ant-..." value="${STATE.config.anthropicKey}">
                </div>

                <div class="ras-field">
                    <label>Collection to Sort ${createTooltipIcon("The specific collection to process. 'All Bookmarks' includes everything.")}</label>
                    <select id="ras-collection-select">
                        <option value="0">All Bookmarks</option>
                        <option value="-1">Unsorted</option>
                        <!-- Will be populated dynamically -->
                    </select>
                </div>

                <div class="ras-field">
                    <label>Search Filter (Optional) ${createTooltipIcon("Process only bookmarks matching this query. e.g. '#unread' or 'created:2024'. Leave empty to process all.")}</label>
                    <input type="text" id="ras-search-input" placeholder="Raindrop search query...">
                </div>

                 <div class="ras-field">
                    <label>Action</label>
                     <select id="ras-action-mode">
                        <option value="tag_only">Tag Bookmarks Only</option>
                        <option value="organize_only">Organize (Cluster Tags)</option>
                        <option value="full">Full (Tag + Organize)</option>
                        <option value="cleanup_tags">Cleanup Tags (Deduplicate)</option>
                    </select>
                </div>

                <div>
                    <a href="#" id="ras-advanced-toggle" style="font-size: 12px; text-decoration: none; color: #007aff;">▶ Show Advanced Settings</a>
                </div>

                <div id="ras-advanced-group" style="display:none; margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                    <div id="ras-custom-group" style="display:none">
                         <div class="ras-field">
                            <label>Base URL ${createTooltipIcon("API Base URL. For Ollama: http://localhost:11434/v1")}</label>
                            <input type="text" id="ras-custom-url" placeholder="http://localhost:11434/v1" value="${STATE.config.customBaseUrl}">
                        </div>
                         <div class="ras-field">
                            <label>Model Name ${createTooltipIcon("Model identifier, e.g., 'llama3', 'mistral', 'gpt-4'.")}</label>
                            <input type="text" id="ras-custom-model" placeholder="llama3" value="${STATE.config.customModel}">
                        </div>
                    </div>

                    <div class="ras-field">
                        <label>Max Tags per Item ${createTooltipIcon("Limit the number of tags generated per bookmark.")}</label>
                        <input type="number" id="ras-max-tags" min="1" max="20" value="${STATE.config.maxTags}">
                    </div>

                    <div class="ras-field">
                        <label>Concurrency ${createTooltipIcon("Parallel requests (1-50). Higher is faster but risks rate limits.")}</label>
                        <input type="number" id="ras-concurrency" min="1" max="50" value="${STATE.config.concurrency}">
                        <div style="font-size: 10px; color: #666; margin-top: 2px;">Number of bookmarks to process simultaneously. Higher = faster but higher API usage.</div>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-block; margin-right: 10px;">
                            <input type="checkbox" id="ras-skip-tagged" ${STATE.config.skipTagged ? 'checked' : ''} style="width:auto">
                            Skip tagged ${createTooltipIcon("Ignore bookmarks that already have tags.")}
                        </label>
                        <label style="display:inline-block">
                            <input type="checkbox" id="ras-dry-run" ${STATE.config.dryRun ? 'checked' : ''} style="width:auto">
                            Dry Run ${createTooltipIcon("Simulate actions without modifying data.")}
                        </label>
                        <div style="font-size: 10px; color: #666; margin-top: 2px;">"Skip tagged" ignores items that already have tags. "Dry Run" simulates actions without changing data.</div>
                    </div>

                    <div class="ras-field" style="border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                        <label>Prompt Presets ${createTooltipIcon("Save and load prompt configurations.")}</label>
                        <div style="display:flex; gap:5px;">
                            <select id="ras-prompt-preset-select" style="flex-grow:1;">
                                <option value="">Select a preset...</option>
                            </select>
                            <button id="ras-save-preset-btn" class="ras-btn" style="width:auto; padding: 0 10px;">Save</button>
                            <button id="ras-delete-preset-btn" class="ras-btn" style="width:auto; padding: 0 10px; background:#dc3545;">Del</button>
                        </div>
                    </div>

                    <div class="ras-field">
                        <label>Tagging Prompt Template ${createTooltipIcon("Instructions for the AI. Use {{CONTENT}} for page text.")}</label>
                        <textarea id="ras-tag-prompt" rows="3" placeholder="Default: Analyze content and suggest 3-5 tags..." style="width:100%; font-size: 11px;">${STATE.config.taggingPrompt}</textarea>
                    </div>

                    <div class="ras-field">
                        <label>Clustering Prompt Template ${createTooltipIcon("Instructions for grouping tags. Use {{TAGS}}.")}</label>
                        <textarea id="ras-cluster-prompt" rows="3" placeholder="Default: Group tags into 5-10 categories..." style="width:100%; font-size: 11px;">${STATE.config.clusteringPrompt}</textarea>
                    </div>

                    <div class="ras-field">
                        <label>Ignored Tags ${createTooltipIcon("Tags to exclude from AI generation or organization.")}</label>
                        <textarea id="ras-ignored-tags" rows="2" placeholder="e.g. to read, article, 2024" style="width:100%; font-size: 11px;">${STATE.config.ignoredTags}</textarea>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-block; margin-right: 10px;">
                            <input type="checkbox" id="ras-auto-describe" ${STATE.config.autoDescribe ? 'checked' : ''} style="width:auto">
                            Auto-describe ${createTooltipIcon("Use AI to generate a summary/description for the bookmark.")}
                        </label>
                        <label style="display:inline-block">
                            <input type="checkbox" id="ras-nested-collections" ${STATE.config.nestedCollections ? 'checked' : ''} style="width:auto">
                            Allow Nested Collections ${createTooltipIcon("Allow AI to create folders like 'Dev > Web'.")}
                        </label>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-block; margin-right: 10px;">
                            <input type="checkbox" id="ras-tag-broken" ${STATE.config.tagBrokenLinks ? 'checked' : ''} style="width:auto">
                            Tag Broken Links ${createTooltipIcon("Tag items as #broken-link if scraping fails.")}
                        </label>
                        <label style="display:inline-block">
                            <input type="checkbox" id="ras-debug-mode" ${STATE.config.debugMode ? 'checked' : ''} style="width:auto">
                            Enable Debug Logging ${createTooltipIcon("Show detailed logs in browser console (F12).")}
                        </label>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-block;">
                            <input type="checkbox" id="ras-review-clusters" ${STATE.config.reviewClusters ? 'checked' : ''} style="width:auto">
                            Review Clusters ${createTooltipIcon("Pause and review proposed moves before executing them.")}
                        </label>
                        <div style="font-size: 10px; color: #666; margin-top: 2px;">Add #broken-link tag if scraping fails. Debug mode dumps API data to Console.</div>
                    </div>

                    <div class="ras-field" id="ras-desc-prompt-group" style="display:none">
                        <label>Description Prompt Template ${createTooltipIcon("Instructions for the summary. Default: 2 sentences.")}</label>
                        <textarea id="ras-desc-prompt" rows="3" placeholder="Default: Summarize the content in 2 sentences..." style="width:100%; font-size: 11px;">${STATE.config.descriptionPrompt}</textarea>
                    </div>
                </div>

                <div id="ras-progress-container" style="display:none; margin-bottom: 10px; background: #eee; height: 10px; border-radius: 5px; overflow: hidden;">
                    <div id="ras-progress-bar" style="width: 0%; height: 100%; background: #28a745; transition: width 0.3s;"></div>
                </div>

                <div id="ras-stats-bar">
                    <span id="ras-stats-tokens">Tokens: 0</span>
                    <span id="ras-stats-cost">Est: $0.00</span>
                </div>

                <div style="display:flex; gap: 5px; margin-bottom: 10px;">
                    <button id="ras-start-btn" class="ras-btn">Start Sorting</button>
                    <button id="ras-stop-btn" class="ras-btn stop" style="display:none">Stop</button>
                    <button id="ras-export-btn" class="ras-btn" style="background:#6c757d; width:auto; padding: 0 12px; font-size: 12px;" title="Download Audit Log">💾</button>
                </div>

                <div id="ras-log"></div>

                <div id="ras-review-panel" style="display:none">
                    <div id="ras-review-header">
                        <span>Review Proposed Moves</span>
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

        // Event Listeners
        document.getElementById('ras-provider').addEventListener('change', (e) => {
            updateProviderVisibility();
            saveConfig();
        });

        document.getElementById('ras-advanced-toggle').addEventListener('click', (e) => {
            e.preventDefault();
            const grp = document.getElementById('ras-advanced-group');
            if (grp.style.display === 'none') {
                grp.style.display = 'block';
                e.target.innerText = '▼ Hide Advanced Settings';
            } else {
                grp.style.display = 'none';
                e.target.innerText = '▶ Show Advanced Settings';
            }
        });

        document.getElementById('ras-start-btn').addEventListener('click', startSorting);
        document.getElementById('ras-stop-btn').addEventListener('click', stopSorting);
        document.getElementById('ras-export-btn').addEventListener('click', exportAuditLog);

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
            const name = prompt("Enter preset name:");
            if(!name) return;
            const presets = GM_getValue('promptPresets', {});
            presets[name] = {
                tagging: document.getElementById('ras-tag-prompt').value,
                clustering: document.getElementById('ras-cluster-prompt').value
            };
            GM_setValue('promptPresets', presets);
            updatePresetDropdown();
            document.getElementById('ras-prompt-preset-select').value = name;
        });

        document.getElementById('ras-delete-preset-btn').addEventListener('click', () => {
            const sel = document.getElementById('ras-prompt-preset-select');
            const name = sel.value;
            if(!name) return;
            if(confirm(`Delete preset "${name}"?`)) {
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
                saveConfig();
            }
        });
        updatePresetDropdown();

        // Input listeners to save config
        ['ras-raindrop-token', 'ras-openai-key', 'ras-anthropic-key', 'ras-skip-tagged', 'ras-custom-url', 'ras-custom-model', 'ras-concurrency', 'ras-max-tags', 'ras-dry-run', 'ras-tag-prompt', 'ras-cluster-prompt', 'ras-ignored-tags', 'ras-auto-describe', 'ras-desc-prompt', 'ras-nested-collections', 'ras-tag-broken', 'ras-debug-mode', 'ras-review-clusters'].forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener('change', saveConfig);
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
        document.getElementById('ras-custom-group').style.display = val === 'custom' ? 'block' : 'none';
    }

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

    function waitForUserReview(moves) {
        return new Promise(resolve => {
            const panel = document.getElementById('ras-review-panel');
            const body = document.getElementById('ras-review-body');
            const count = document.getElementById('ras-review-count');

            // Group moves by category
            const groups = {};
            moves.forEach(m => {
                const cat = m.category;
                if (!groups[cat]) groups[cat] = 0;
                groups[cat]++;
            });

            body.innerHTML = '';
            Object.entries(groups).sort((a,b) => b[1]-a[1]).forEach(([cat, num]) => {
                const div = document.createElement('div');
                div.className = 'ras-review-item';
                div.innerHTML = `<span>${cat}</span><span>${num} items</span>`;
                body.appendChild(div);
            });

            count.textContent = `(${moves.length} items to move)`;
            panel.style.display = 'flex';

            // One-time listeners (clearing old ones would be better but this is simple)
            const confirmBtn = document.getElementById('ras-review-confirm');
            const cancelBtn = document.getElementById('ras-review-cancel');

            // Clone nodes to remove old listeners
            const newConfirm = confirmBtn.cloneNode(true);
            const newCancel = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

            newConfirm.onclick = () => {
                panel.style.display = 'none';
                resolve(true);
            };

            newCancel.onclick = () => {
                panel.style.display = 'none';
                resolve(false);
            };
        });
    }

    // Placeholders for main logic
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
        STATE.stats = { processed: 0, updated: 0, broken: 0, moved: 0, errors: 0, tokens: {input:0, output:0} };
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

            const summary = `Run Complete.\nProcessed: ${STATE.stats.processed}\nUpdated: ${STATE.stats.updated}\nBroken Links: ${STATE.stats.broken}\nMoved: ${STATE.stats.moved}\nErrors: ${STATE.stats.errors}`;
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

                         // Clean up junk
                         const toRemove = doc.querySelectorAll('script, style, nav, footer, iframe, noscript, svg, [role="alert"], .ads, .comment, .menu');
                         toRemove.forEach(s => s.remove());

                         // Improved Extraction (Readability-lite)
                         // 1. Find all paragraphs
                         const paragraphs = Array.from(doc.querySelectorAll('p'));

                         // 2. Score parents
                         const parentScores = new Map();
                         let maxScore = 0;
                         let bestCandidate = doc.body;

                         paragraphs.forEach(p => {
                             const text = p.innerText || "";
                             if (text.length < 50) return; // Skip short blurbs

                             const parent = p.parentElement;
                             const score = text.length; // Simple score by length

                             const current = parentScores.get(parent) || 0;
                             const newScore = current + score;
                             parentScores.set(parent, newScore);

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

                         // 4. Metadata Fallback (if text is too short)
                         if (cleanText.length < 500) {
                             const ogDesc = doc.querySelector('meta[property="og:description"]')?.content || "";
                             const metaDesc = doc.querySelector('meta[name="description"]')?.content || "";
                             const ogTitle = doc.querySelector('meta[property="og:title"]')?.content || "";

                             const metadata = [ogTitle, ogDesc, metaDesc].filter(s => s).join("\n");
                             if (metadata.length > cleanText.length) {
                                 cleanText = metadata + "\n" + cleanText;
                             }
                         }

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

    // LLM Client
    class LLMClient {
        constructor(config, network) {
            this.config = config;
            this.network = network || new NetworkClient();
        }

        async generateTags(content, existingTags = []) {
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

            let result = null;
            if (this.config.provider === 'openai') {
                result = await this.callOpenAI(prompt, true);
            } else if (this.config.provider === 'anthropic') {
                result = await this.callAnthropic(prompt, true);
            } else if (this.config.provider === 'custom') {
                result = await this.callOpenAI(prompt, true, true);
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

             if (this.config.provider === 'openai') {
                const res = await this.callOpenAI(prompt, true);
                return res;
            } else if (this.config.provider === 'anthropic') {
                 const res = await this.callAnthropic(prompt, true);
                 return res;
            } else if (this.config.provider === 'custom') {
                return await this.callOpenAI(prompt, true, true);
            }
            return {};
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
            // Note: Truncating tags list to avoid context limits if user has thousands

            if (this.config.provider === 'openai') {
                return await this.callOpenAI(prompt, true);
            } else if (this.config.provider === 'anthropic') {
                 return await this.callAnthropic(prompt, true);
            } else if (this.config.provider === 'custom') {
                return await this.callOpenAI(prompt, true, true);
            }
            return {};
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

            const lastComma = cleaned.lastIndexOf(',');
            if (lastComma > 0) {
                let truncated = cleaned.substring(0, lastComma);
                let stack = [];
                let inString = false;
                let escape = false;

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

        async callOpenAI(prompt, isObject = false, isCustom = false) {
             const baseUrl = isCustom ? this.config.customBaseUrl : 'https://api.openai.com/v1';
             const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
             const model = isCustom ? this.config.customModel : 'gpt-3.5-turbo';
             const headers = { 'Content-Type': 'application/json' };

             if (!isCustom) {
                 headers['Authorization'] = `Bearer ${this.config.openaiKey}`;
             }

             updateTokenStats(prompt.length, 0); // Track input

             return this.fetchWithRetry(url, {
                method: 'POST',
                headers: headers,
                data: JSON.stringify({
                    model: model,
                    messages: [{role: 'user', content: prompt}],
                    temperature: 0.3,
                    stream: false,
                    max_tokens: 4096
                }),
                signal: STATE.abortController ? STATE.abortController.signal : null
             }).then(data => {
                 if (data.error) throw new Error(data.error.message);
                 const text = data.choices[0].message.content.trim();
                 updateTokenStats(0, text.length); // Track output

                 if (STATE.config.debugMode) {
                     console.log('[LLM Raw Response]', text);
                 }

                 // Robust JSON extraction
                 let cleanText = text.replace(/```json/g, '').replace(/```/g, '');
                 const firstBrace = cleanText.indexOf('{');
                 // For object, we might find lastBrace, but repairJSON handles that
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
                 return isObject ? {} : [];
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
                        model: 'claude-3-haiku-20240307',
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
                             resolve(isObject ? {} : []);
                        }
                    }).catch(reject);
            });
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

        // --- Phase 1: Tagging ---
        if (mode === 'tag_only' || mode === 'full') {
            log('Phase 1: Fetching bookmarks...');
            let page = 0;
            let hasMore = true;
            let totalItemsApprox = 0; // Raindrop doesn't always give easy total without extra calls

            // Try to get total count first for progress bar
            try {
                 // Fetch count only? or just assume from first page
                 const res = await api.getBookmarks(collectionId, 0, searchQuery);
                 if(res.count) totalItemsApprox = res.count;
            } catch(e) {}

            while (hasMore && !STATE.stopRequested) {
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

                                if (scraped && scraped.error && STATE.config.tagBrokenLinks) {
                                    log(`Broken link detected (${scraped.error}): ${bm.title}`, 'warn');
                                    // Tag as broken
                                    const brokenTag = 'broken-link';
                                    if (!bm.tags.includes(brokenTag)) {
                                        await api.updateBookmark(bm._id, { tags: [...bm.tags, brokenTag] });
                                        STATE.stats.broken++;
                                    }
                                    return; // Skip AI tagging for broken links
                                }

                                if (scraped && scraped.text) {
                                    log(`Generating tags for: ${bm.title.substring(0, 20)}...`);
                                    result = await llm.generateTags(scraped.text, bm.tags);
                                } else {
                                    log(`Skipping content gen for ${bm.title} (scrape failed), using metadata`);
                                    result = await llm.generateTags(bm.title + "\n" + bm.excerpt, bm.tags);
                                }

                                const updateData = {};

                                if (result.tags && result.tags.length > 0) {
                                    const combinedTags = [...new Set([...(bm.tags || []), ...result.tags])];
                                    updateData.tags = combinedTags;
                                    combinedTags.forEach(t => allTags.add(t));
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

            const changes = Object.entries(mergePlan);
            if (changes.length === 0) {
                log('No tag consolidations suggested.');
                return;
            }

            log(`Proposed merges: ${changes.length}`);

            // Review Step for Cleanup
            if (STATE.config.reviewClusters) {
                log(`Pausing for review of ${changes.length} merges...`);
                // Adapt waitForUserReview for merges
                const approved = await waitForTagCleanupReview(changes);
                if (!approved) {
                    log('User cancelled merges. Stopping process.');
                    return;
                }
            }

            if (STATE.config.dryRun) {
                log('DRY RUN: No tags modified.');
                return;
            }

            // 3. Execute Merges
            // Iterate map: "Bad" -> "Good"
            let processed = 0;
            updateProgress(0);

            for (const [badTag, goodTag] of changes) {
                if (STATE.stopRequested) break;

                if (!goodTag || typeof goodTag !== 'string' || goodTag.trim() === '') {
                    log(`Skipping invalid merge pair: "${badTag}" -> "${goodTag}"`, 'warn');
                    continue;
                }

                log(`Merging "${badTag}" into "${goodTag}"...`);

                // Fetch bookmarks with badTag
                // Note: Raindrop search for tag is #tagname
                // Use API to get IDs? Or simple search?
                // The /raindrops/0?search=[{"key":"tag","val":"badTag"}] endpoint logic needed?
                // Or search string: "#badTag"

                let page = 0;
                let hasMore = true;

                while(hasMore && !STATE.stopRequested) {
                    // Search for the bad tag using structured JSON if possible, or strict string
                    // Raindrop supports JSON search in query param
                    let searchJson = JSON.stringify([{key: 'tag', val: badTag}]);
                    let searchStr = encodeURIComponent(searchJson);

                    debug(`Searching for items with tag "${badTag}"...`);
                    if (STATE.config.debugMode) {
                        log(`[Cleanup] Search URL: /raindrops/0?search=${searchStr}`);
                    }

                    let res = await api.request(`/raindrops/0?search=${searchStr}&page=${page}&perpage=50`);

                    // Fallback to simple string search if structured search fails (Raindrop API quirks)
                    if (!res.items || res.items.length === 0) {
                        log(`[Cleanup] JSON search yielded 0 results. Trying fallback string search: #${badTag}`);
                        const simpleSearch = encodeURIComponent(`#${badTag}`);
                        res = await api.request(`/raindrops/0?search=${simpleSearch}&page=${page}&perpage=50`);
                    }

                    debug(res, 'SearchResult');

                    if (!res.items || res.items.length === 0) {
                        log(`[Cleanup] No items found for tag "${badTag}"`);
                        hasMore = false;
                        break;
                    }

                    const itemsToUpdate = res.items;
                    log(`[Cleanup] Found ${itemsToUpdate.length} items to update...`);

                    // Update each item: Add goodTag, Remove badTag
                    // Actually, if we just add GoodTag, we can delete BadTag globally later?
                    // Raindrop API: Update tags list.

                    await Promise.all(itemsToUpdate.map(async (bm) => {
                        let newTags = bm.tags.filter(t => t !== badTag);
                        // Ensure goodTag is added only if not present
                        if (!newTags.includes(goodTag)) newTags.push(goodTag);

                        // Sanitize
                        newTags = newTags.map(t => String(t).trim()).filter(t => t.length > 0);

                        try {
                            await api.updateBookmark(bm._id, { tags: newTags });
                        } catch(e) {
                             log(`Failed to update bookmark ${bm._id}: ${e.message}`, 'error');
                        }
                    }));

                    // If we modified items, they might disappear from search view if we paginate?
                    // Raindrop search pagination is stable if criteria still matches?
                    // If we remove the tag, it NO LONGER matches search `#"badTag"`.
                    // So next fetch of page 0 will return new items.
                    // So we should keep page = 0.
                    // But we need to ensure we actually removed the tag.

                    if (itemsToUpdate.length < 50) hasMore = false;
                }

                // Finally delete the bad tag explicitly to be clean
                await api.removeTag(badTag);
                log(`Removed tag "${badTag}"`);

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

                     if (STATE.config.debugMode) {
                         console.log(`[Clustering] Item "${bm.title}" votes:`, JSON.stringify(votes));
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

                // If sorting "Unsorted", moved items are gone.
                // If sorting "All", moved items are still there but now have a collection.
                // If we want to move them *out* of "Unsorted", we are good.
                // If we want to organize "All" into subfolders, we might be moving them from "Unsorted" or "Root" to "Folder".

                // If we are in "Unsorted" and items moved, we have new items on Page 0 next time.
                // So the loop continues naturally.
            }
        }
    }

    // Initialize
    window.addEventListener('load', () => {
        createUI();
        // Try to populate collections if token is already there
        if(STATE.config.raindropToken) {
            const api = new RaindropAPI(STATE.config.raindropToken);
            api.getCollections().then(items => {
                 const sel = document.getElementById('ras-collection-select');
                 items.forEach(c => {
                     const opt = document.createElement('option');
                     opt.value = c._id;
                     opt.innerText = c.title;
                     sel.appendChild(opt);
                 });
            }).catch(e => console.log("Could not auto-load collections", e));
        }
    });

})();
