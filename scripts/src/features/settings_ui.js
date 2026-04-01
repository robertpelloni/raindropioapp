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
