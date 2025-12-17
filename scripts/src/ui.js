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
                <span style="font-size: 12px; font-weight: normal;">v0.7.0</span>
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
                        <optgroup label="AI Sorting">
                            <option value="tag_only">Tag Bookmarks Only</option>
                            <option value="organize_only">Organize (Recursive Clusters)</option>
                            <option value="full">Full (Tag + Organize)</option>
                            <option value="organize_existing">Organize (Existing Folders Only)</option>
                            <option value="organize_frequency">Organize (Tag Frequency)</option>
                        </optgroup>
                        <optgroup label="Maintenance">
                            <option value="cleanup_tags">Cleanup Tags (Deduplicate)</option>
                            <option value="prune_tags">Prune Infrequent Tags</option>
                            <option value="flatten">Flatten Library (Reset to Unsorted)</option>
                            <option value="delete_all_tags">Delete ALL Tags</option>
                        </optgroup>
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
                        <label>Min Tag Count (Pruning) ${createTooltipIcon("For 'Prune Infrequent Tags': tags with fewer occurrences than this will be deleted.")}</label>
                        <input type="number" id="ras-min-tag-count" min="1" max="1000" value="${STATE.config.minTagCount}">
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
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-block; margin-right: 10px;">
                             <input type="checkbox" id="ras-delete-empty" ${STATE.config.deleteEmptyCols ? 'checked' : ''} style="width:auto">
                             Delete Empty Folders ${createTooltipIcon("Used in 'Flatten Library': Deletes collections after emptying them.")}
                        </label>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-block; margin-right: 10px;">
                            <input type="checkbox" id="ras-safe-mode" ${STATE.config.safeMode ? 'checked' : ''} style="width:auto">
                            Safe Mode ${createTooltipIcon("Require a minimum number of matching tags to move a bookmark.")}
                        </label>
                        <span id="ras-min-votes-container" style="${STATE.config.safeMode ? '' : 'display:none'}">
                            <label style="display:inline;">Min Votes: </label>
                            <input type="number" id="ras-min-votes" min="1" max="10" value="${STATE.config.minVotes}" style="width: 50px;">
                        </span>
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
        ['ras-raindrop-token', 'ras-openai-key', 'ras-anthropic-key', 'ras-skip-tagged', 'ras-custom-url', 'ras-custom-model', 'ras-concurrency', 'ras-max-tags', 'ras-dry-run', 'ras-tag-prompt', 'ras-cluster-prompt', 'ras-ignored-tags', 'ras-auto-describe', 'ras-desc-prompt', 'ras-nested-collections', 'ras-tag-broken', 'ras-debug-mode', 'ras-review-clusters', 'ras-min-tag-count', 'ras-delete-empty', 'ras-safe-mode', 'ras-min-votes'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('change', saveConfig);
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
        STATE.config.minTagCount = parseInt(document.getElementById('ras-min-tag-count').value) || 2;
        STATE.config.deleteEmptyCols = document.getElementById('ras-delete-empty').checked;

        STATE.config.safeMode = document.getElementById('ras-safe-mode').checked;
        STATE.config.minVotes = parseInt(document.getElementById('ras-min-votes').value) || 2;

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

        GM_setValue('safeMode', STATE.config.safeMode);
        GM_setValue('minVotes', STATE.config.minVotes);
    }
