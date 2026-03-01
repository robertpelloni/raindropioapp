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
                ${I18N.get('title')} <span style="font-weight: normal; font-size: 11px; margin-left: 5px;">v{{VERSION}}</span>
                <span id="ras-close-btn" style="cursor: pointer;">✖</span>
            </div>
            <div id="ras-tabs">
                <button class="ras-tab-btn active" data-tab="dashboard">${I18N.get('dashboard')}</button>
                <button class="ras-tab-btn" data-tab="settings">${I18N.get('settings')}</button>
                <button class="ras-tab-btn" data-tab="prompts">${I18N.get('prompts')}</button>
                <button class="ras-tab-btn" data-tab="macros">Macros</button>
                <button class="ras-tab-btn" data-tab="rules">Rules</button>
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
                        <label>${I18N.get('search')} ${createTooltipIcon(I18N.get('tt_search_filter'))}</label>
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
                        <button id="ras-debug-log-btn" class="ras-btn" style="background:#6c757d; width:auto; padding: 0 12px; font-size: 12px;" title="View Raw AI Logs">🔍</button>
                    </div>

                    <div id="ras-log"></div>
                </div>

                <!-- SETTINGS TAB -->
                ${SettingsUI.render()}

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
                        <label>${I18N.get('lbl_ignored_tags')} ${createTooltipIcon(I18N.get('tt_ignored_tags'))}</label>
                        <textarea id="ras-ignored-tags" rows="2">${STATE.config.ignoredTags}</textarea>
                    </div>

                    <div class="ras-field">
                        <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                            <input type="checkbox" id="ras-auto-describe" ${STATE.config.autoDescribe ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_auto_describe')}
                        </label>
                        <label style="display:inline-flex; align-items:center;">
                            <input type="checkbox" id="ras-use-vision" ${STATE.config.useVision ? 'checked' : ''} style="margin-right:5px;"> ${I18N.get('lbl_use_vision')}
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

        // Query Builder Toggle
        const qbToggle = document.getElementById('ras-show-query-builder');
        if(qbToggle) {
            qbToggle.addEventListener('change', (e) => {
                document.getElementById('ras-query-builder-container').style.display = e.target.checked ? 'block' : 'none';
                document.getElementById('ras-search-input').disabled = e.target.checked;
            });
        }

        // Define global saveConfig shim if needed by other modules
        window.saveConfig = function() {
            if(SettingsUI && SettingsUI.save) SettingsUI.save();
        };

        // Initialize Templates UI
        if(window.initTemplatesUI) {
            window.initTemplatesUI();
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
