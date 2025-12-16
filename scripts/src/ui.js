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
        ['ras-raindrop-token', 'ras-openai-key', 'ras-anthropic-key', 'ras-skip-tagged', 'ras-custom-url', 'ras-custom-model', 'ras-concurrency', 'ras-max-tags', 'ras-dry-run', 'ras-tag-prompt', 'ras-cluster-prompt', 'ras-ignored-tags', 'ras-auto-describe', 'ras-desc-prompt', 'ras-nested-collections', 'ras-tag-broken', 'ras-debug-mode', 'ras-review-clusters', 'ras-min-tag-count', 'ras-delete-empty'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.addEventListener('change', saveConfig);
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
