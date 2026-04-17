import { h, render, Component } from 'preact';
import htm from 'htm';
import { STATE } from '../content/state.js';
import { I18N } from '../content/i18n.js';
import { createTooltipIcon } from '../content/utils.js';
import { RuleEngine } from '../content/features/rules.js';
import { MacroEngine } from '../content/features/macros_ui.js';

const html = htm.bind(h);

window.rasRuleEngine = new RuleEngine();
window.rasMacroEngine = new MacroEngine();

function renderRulesList() {
    const tbody = document.getElementById('ras-rules-tbody');
    if (!tbody || !window.rasRuleEngine) return;
    const rules = window.rasRuleEngine.getRules();
    tbody.innerHTML = '';
    if (rules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:10px; color:#666;">No rules saved. Merge tags or move folders in review mode to create rules.</td></tr>';
        return;
    }
    rules.forEach(rule => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 4px; border-bottom: 1px solid #ccc;">${rule.type === 'merge_tag' ? 'Tag Merge' : 'Folder Move'}</td>
            <td style="padding: 4px; border-bottom: 1px solid #ccc;">${rule.source}</td>
            <td style="padding: 4px; border-bottom: 1px solid #ccc;">${rule.target}</td>
            <td style="padding: 4px; border-bottom: 1px solid #ccc; text-align:right;">
                <button class="ras-del-rule-btn" data-type="${rule.type}" data-source="${rule.source}" style="background: #dc3545; color: white; border: none; padding: 2px 6px; font-size: 10px; cursor: pointer;">X</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    document.querySelectorAll('.ras-del-rule-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.getAttribute('data-type');
            const source = e.target.getAttribute('data-source');
            if (confirm(`Delete rule for "${source}"?`)) {
                window.rasRuleEngine.deleteRule(type, source);
                renderRulesList();
            }
        });
    });
}

function renderMacrosList() {
    const tbody = document.getElementById('ras-macros-tbody');
    if (!tbody || !window.rasMacroEngine) return;
    const macros = window.rasMacroEngine.getMacros();
    tbody.innerHTML = '';
    if (macros.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:10px; color:#666;">No macros defined.</td></tr>';
        return;
    }
    macros.forEach(macro => {
        const tr = document.createElement('tr');
        let condText = '';
        if (macro.condition.type === 'domain_equals') condText = `Domain == ${macro.condition.value}`;
        if (macro.condition.type === 'has_tag') condText = `Tag == ${macro.condition.value}`;
        if (macro.condition.type === 'title_contains') condText = `Title ~ ${macro.condition.value}`;
        let actText = '';
        if (macro.action.type === 'add_tag') actText = `+Tag: ${macro.action.value}`;
        if (macro.action.type === 'move_to_folder') actText = `Move: ${macro.action.value}`;
        tr.innerHTML = `
            <td style="padding: 4px; border-bottom: 1px solid #ccc;">${condText}</td>
            <td style="padding: 4px; border-bottom: 1px solid #ccc;">${actText}</td>
            <td style="padding: 4px; border-bottom: 1px solid #ccc; text-align:right;">
                <button class="ras-del-macro-btn" data-id="${macro.id}" style="background: #dc3545; color: white; border: none; padding: 2px 6px; font-size: 10px; cursor: pointer;">X</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    document.querySelectorAll('.ras-del-macro-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(e.target.getAttribute('data-id'), 10);
            if (confirm('Delete this macro?')) {
                window.rasMacroEngine.deleteMacro(id);
                renderMacrosList();
            }
        });
    });
}
window.renderRulesList = renderRulesList;
window.renderMacrosList = renderMacrosList;

class RulesTab extends Component {
    componentDidMount() {
        if (window.rasRuleEngine) renderRulesList();
    }
    render() {
        return html`
            <div id="ras-tab-rules" class="ras-tab-content ${this.props.active ? 'active' : ''}" style="${this.props.active ? '' : 'display:none;'}">
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
                        </tbody>
                    </table>
                </div>
                <button id="ras-refresh-rules-btn" class="ras-btn" style="margin-top: 10px;" onClick=${() => {window.rasRuleEngine.loadRules(); renderRulesList();}}>Refresh Rules</button>
            </div>
        `;
    }
}

class MacrosTab extends Component {
    componentDidMount() {
        if (window.rasMacroEngine) renderMacrosList();
    }
    render() {
        return html`
            <div id="ras-tab-macros" class="ras-tab-content ${this.props.active ? 'active' : ''}" style="${this.props.active ? '' : 'display:none;'}">
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
                        <input type="text" id="ras-macro-cond-val" placeholder="e.g. github.com" style="flex:1;" />
                    </div>
                    <div style="display:flex; gap:5px; margin-bottom:5px;">
                        <span style="line-height:24px;">THEN</span>
                        <select id="ras-macro-act-type" style="flex:1;">
                            <option value="add_tag">Add Tag</option>
                            <option value="move_to_folder">Move to Folder (Name)</option>
                        </select>
                        <input type="text" id="ras-macro-act-val" placeholder="e.g. open-source" style="flex:1;" />
                    </div>
                    <button id="ras-add-macro-btn" class="ras-btn" onClick=${() => {
                        const cType = document.getElementById('ras-macro-cond-type').value;
                        const cVal = document.getElementById('ras-macro-cond-val').value.trim();
                        const aType = document.getElementById('ras-macro-act-type').value;
                        const aVal = document.getElementById('ras-macro-act-val').value.trim();
                        if(cVal && aVal) {
                            window.rasMacroEngine.addMacro({ type: cType, value: cVal }, { type: aType, value: aVal });
                            document.getElementById('ras-macro-cond-val').value = '';
                            document.getElementById('ras-macro-act-val').value = '';
                            renderMacrosList();
                        }
                    }}>Add Macro</button>
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
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
}

class TemplatesTab extends Component {
    render() {
        return html`
            <div id="ras-tab-templates" class="ras-tab-content ${this.props.active ? 'active' : ''}" style="${this.props.active ? '' : 'display:none;'}">
                <h3>The Architect (Templates)</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Apply pre-defined folder structures (PARA, Dewey Decimal, etc). <strong>Warning: Template application is currently designed to run from the Content Script injector, not the standalone Options page. Return to the Raindrop.io tab to run templates.</strong></p>
                <div class="ras-field">
                    <select id="ras-template-select">
                        <option value="para">P.A.R.A Method</option>
                        <option value="dewey">Dewey Decimal System</option>
                        <option value="academic">Academic Research</option>
                    </select>
                </div>
                <button id="ras-apply-template-btn" class="ras-btn" disabled>Apply Template</button>
            </div>
        `;
    }
}

class GraphTab extends Component {
    render() {
        return html`
            <div id="ras-tab-graph" class="ras-tab-content ${this.props.active ? 'active' : ''}" style="${this.props.active ? '' : 'display:none;'}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>Semantic Graph</h3>
                    <button id="ras-render-graph-btn" class="ras-btn" style="width:auto; padding:4px 12px;" disabled>Render Graph</button>
                </div>
                <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Visual map of tags. <strong>Warning: Semantic Graph must be run from the Raindrop.io tab overlay.</strong></p>
                <div id="ras-graph-container" style="width: 100%; height: 350px; background: #fafafa; border: 1px solid #ccc; text-align: center; line-height: 350px;">
                    <em>Graph Visualization Disabled in Options</em>
                </div>
            </div>
        `;
    }
}

// Wrapper for saving state directly
function updateGlobalState(key, value, callback) {
    STATE.config[key] = value;
    STATE.saveConfig();
    if (callback) callback();
}

class SettingsTab extends Component {
    render() {
        const c = STATE.config;
        return html`
            <div id="ras-tab-settings" class="ras-tab-content ${this.props.active ? 'active' : ''}" style="${this.props.active ? '' : 'display:none;'}">
                <div class="ras-field">
                    <label>${I18N.get('lbl_language')} ${createTooltipIcon(I18N.get('tt_language'))}</label>
                    <select id="ras-language" onChange=${e => updateGlobalState('language', e.target.value, () => this.forceUpdate())}>
                        <option value="en" selected=${c.language === 'en'}>English</option>
                        <option value="es" selected=${c.language === 'es'}>Español</option>
                    </select>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_raindrop_token')} ${createTooltipIcon(I18N.get('tt_raindrop_token'))}</label>
                    <input type="password" id="ras-raindrop-token" value="${c.raindropToken}" onChange=${e => updateGlobalState('raindropToken', e.target.value, () => this.forceUpdate())} />
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_provider')} ${createTooltipIcon(I18N.get('tt_provider'))}</label>
                    <select id="ras-provider" onChange=${e => updateGlobalState('provider', e.target.value, () => this.forceUpdate())}>
                        <option value="openai" selected=${c.provider === 'openai'}>OpenAI</option>
                        <option value="anthropic" selected=${c.provider === 'anthropic'}>Anthropic</option>
                        <option value="groq" selected=${c.provider === 'groq'}>Groq</option>
                        <option value="deepseek" selected=${c.provider === 'deepseek'}>DeepSeek</option>
                        <option value="custom" selected=${c.provider === 'custom'}>Custom / Local</option>
                    </select>
                </div>

                <div class="ras-field" id="ras-openai-group" style="display:${c.provider === 'openai' ? 'block' : 'none'}">
                    <label>${I18N.get('lbl_openai_key')} ${createTooltipIcon(I18N.get('tt_openai_key'))}</label>
                    <input type="password" id="ras-openai-key" value="${c.openaiKey}" onChange=${e => updateGlobalState('openaiKey', e.target.value)} />
                    <label style="margin-top:5px;">${I18N.get('lbl_openai_model')} ${createTooltipIcon(I18N.get('tt_openai_model'))}</label>
                    <input type="text" id="ras-openai-model" value="${c.openaiModel || 'gpt-4o-mini'}" onChange=${e => updateGlobalState('openaiModel', e.target.value)} />
                </div>

                <div class="ras-field" id="ras-anthropic-group" style="display:${c.provider === 'anthropic' ? 'block' : 'none'}">
                    <label>${I18N.get('lbl_anthropic_key')} ${createTooltipIcon(I18N.get('tt_anthropic_key'))}</label>
                    <input type="password" id="ras-anthropic-key" value="${c.anthropicKey}" onChange=${e => updateGlobalState('anthropicKey', e.target.value)} />
                    <label style="margin-top:5px;">${I18N.get('lbl_anthropic_model')} ${createTooltipIcon(I18N.get('tt_anthropic_model'))}</label>
                    <input type="text" id="ras-anthropic-model" value="${c.anthropicModel || 'claude-3-haiku-20240307'}" onChange=${e => updateGlobalState('anthropicModel', e.target.value)} />
                </div>

                <div class="ras-field" id="ras-groq-group" style="display:${c.provider === 'groq' ? 'block' : 'none'}">
                    <label>${I18N.get('lbl_groq_key')} ${createTooltipIcon(I18N.get('tt_groq_key'))}</label>
                    <input type="password" id="ras-groq-key" value="${c.groqKey}" onChange=${e => updateGlobalState('groqKey', e.target.value)} />
                    <label style="margin-top:5px;">${I18N.get('lbl_groq_model')} ${createTooltipIcon(I18N.get('tt_groq_model'))}</label>
                    <input type="text" id="ras-groq-model" value="${c.groqModel || 'llama3-8b-8192'}" onChange=${e => updateGlobalState('groqModel', e.target.value)} />
                </div>

                <div class="ras-field" id="ras-deepseek-group" style="display:${c.provider === 'deepseek' ? 'block' : 'none'}">
                    <label>${I18N.get('lbl_deepseek_key')} ${createTooltipIcon(I18N.get('tt_deepseek_key'))}</label>
                    <input type="password" id="ras-deepseek-key" value="${c.deepseekKey || ''}" onChange=${e => updateGlobalState('deepseekKey', e.target.value)} />
                    <label style="margin-top:5px;">${I18N.get('lbl_deepseek_model')} ${createTooltipIcon(I18N.get('tt_deepseek_model'))}</label>
                    <input type="text" id="ras-deepseek-model" value="${c.deepseekModel || 'deepseek-chat'}" onChange=${e => updateGlobalState('deepseekModel', e.target.value)} />
                </div>

                <div id="ras-custom-group" style="display:${c.provider === 'custom' ? 'block' : 'none'}">
                     <div class="ras-field">
                        <label>${I18N.get('lbl_custom_url')} ${createTooltipIcon(I18N.get('tt_custom_url'))}</label>
                        <input type="text" id="ras-custom-url" placeholder="http://localhost:11434/v1" value="${c.customBaseUrl}" onChange=${e => updateGlobalState('customBaseUrl', e.target.value)} />
                    </div>
                     <div class="ras-field">
                        <label>${I18N.get('lbl_custom_model')} ${createTooltipIcon(I18N.get('tt_custom_model'))}</label>
                        <input type="text" id="ras-custom-model" placeholder="llama3" value="${c.customModel}" onChange=${e => updateGlobalState('customModel', e.target.value)} />
                    </div>
                </div>

                <div style="display:flex; gap: 10px;">
                    <div class="ras-field" style="flex:1">
                        <label>${I18N.get('lbl_concurrency')} ${createTooltipIcon(I18N.get('tt_concurrency'))}</label>
                        <input type="number" id="ras-concurrency" min="1" max="50" value="${c.concurrency}" onChange=${e => updateGlobalState('concurrency', parseInt(e.target.value, 10))} />
                    </div>
                    <div class="ras-field" style="flex:1">
                        <label>${I18N.get('lbl_max_tags')} ${createTooltipIcon(I18N.get('tt_max_tags'))}</label>
                        <input type="number" id="ras-max-tags" min="1" max="20" value="${c.maxTags}" onChange=${e => updateGlobalState('maxTags', parseInt(e.target.value, 10))} />
                    </div>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_min_tag_count')} ${createTooltipIcon(I18N.get('tt_min_tag_count'))}</label>
                    <input type="number" id="ras-min-tag-count" min="1" max="1000" value="${c.minTagCount}" onChange=${e => updateGlobalState('minTagCount', parseInt(e.target.value, 10))} />
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-skip-tagged" checked=${c.skipTagged} onChange=${e => updateGlobalState('skipTagged', e.target.checked)} style="margin-right:5px;" /> ${I18N.get('lbl_skip_tagged')} ${createTooltipIcon(I18N.get('tt_skip_tagged'))}
                    </label>
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-dry-run" checked=${c.dryRun} onChange=${e => updateGlobalState('dryRun', e.target.checked)} style="margin-right:5px;" /> ${I18N.get('lbl_dry_run')} ${createTooltipIcon(I18N.get('tt_dry_run'))}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                         <input type="checkbox" id="ras-delete-empty" checked=${c.deleteEmptyCols} onChange=${e => updateGlobalState('deleteEmptyCols', e.target.checked)} style="margin-right:5px;" /> ${I18N.get('lbl_delete_empty')} ${createTooltipIcon(I18N.get('tt_delete_empty'))}
                    </label>
                    <label style="display:inline-flex; align-items:center;">
                         <input type="checkbox" id="ras-nested-collections" checked=${c.nestedCollections} onChange=${e => updateGlobalState('nestedCollections', e.target.checked)} style="margin-right:5px;" /> ${I18N.get('lbl_nested_col')} ${createTooltipIcon(I18N.get('tt_nested_col'))}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-tag-broken" checked=${c.tagBrokenLinks} onChange=${e => updateGlobalState('tagBrokenLinks', e.target.checked)} style="margin-right:5px;" /> ${I18N.get('lbl_tag_broken')} ${createTooltipIcon(I18N.get('tt_tag_broken'))}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-safe-mode" checked=${c.safeMode} onChange=${e => updateGlobalState('safeMode', e.target.checked, () => this.forceUpdate())} style="margin-right:5px;" /> ${I18N.get('lbl_safe_mode')} ${createTooltipIcon(I18N.get('tt_safe_mode'))}
                    </label>
                    <span id="ras-min-votes-container" style="display:${c.safeMode ? 'inline-block' : 'none'}">
                        ${I18N.get('lbl_min_votes')}: <input type="number" id="ras-min-votes" min="1" max="10" value="${c.minVotes}" onChange=${e => updateGlobalState('minVotes', parseInt(e.target.value, 10))} style="width: 40px;" />
                    </span>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-review-clusters" checked=${c.reviewClusters} onChange=${e => updateGlobalState('reviewClusters', e.target.checked)} style="margin-right:5px;" /> ${I18N.get('lbl_review_clusters')} ${createTooltipIcon(I18N.get('tt_review_clusters'))}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-debug-mode" checked=${c.debugMode} onChange=${e => updateGlobalState('debugMode', e.target.checked)} style="margin-right:5px;" /> ${I18N.get('lbl_debug_mode')} ${createTooltipIcon(I18N.get('tt_debug_mode'))}
                    </label>
                </div>

                <div class="ras-field" style="border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px;">
                    <label>Smart Triggers (Background Service) ${createTooltipIcon('Automatically poll the Unsorted folder in the background to apply your Rules and Macros.')}</label>
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <label style="display:inline-flex; align-items:center;">
                                <input type="checkbox" id="ras-smart-triggers" checked=${c.smartTriggers} onChange=${e => updateGlobalState('smartTriggers', e.target.checked, () => this.forceUpdate())} style="margin-right:5px;" /> Enable Auto-Sorting
                            </label>
                            <span id="ras-smart-interval-container" style="display:${c.smartTriggers ? 'inline-block' : 'none'}">
                                Every <input type="number" id="ras-smart-interval" min="1" max="1440" value="${c.smartTriggersInterval}" onChange=${e => updateGlobalState('smartTriggersInterval', parseInt(e.target.value, 10))} style="width: 50px;" /> mins
                            </span>
                        </div>
                        <div id="ras-smart-llm-container" style="display:${c.smartTriggers ? 'block' : 'none'}">
                            <label style="display:inline-flex; align-items:center;">
                                <input type="checkbox" id="ras-smart-llm" checked=${c.smartTriggersLLM} onChange=${e => updateGlobalState('smartTriggersLLM', e.target.checked)} style="margin-right:5px;" /> Use AI Fallback ${createTooltipIcon('If no rules match, call the LLM to auto-tag. Costs API tokens.')}
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

class PromptsTab extends Component {
    render() {
        const c = STATE.config;
        return html`
            <div id="ras-tab-prompts" class="ras-tab-content ${this.props.active ? 'active' : ''}" style="${this.props.active ? '' : 'display:none;'}">
                <div class="ras-field" style="border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px;">
                    <label>${I18N.get('lbl_presets')} ${createTooltipIcon(I18N.get('tt_presets'))}</label>
                    <div style="display:flex; gap:5px;">
                        <select id="ras-prompt-preset-select" style="flex-grow:1;">
                            <option value="default">The Librarian (Default)</option>
                        </select>
                        <button id="ras-save-preset-btn" class="ras-btn" style="width:auto; padding: 4px 8px;">${I18N.get('btn_save')}</button>
                        <button id="ras-delete-preset-btn" class="ras-btn" style="width:auto; padding: 4px 8px; background:#dc3545;">X</button>
                    </div>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_tag_prompt')} ${createTooltipIcon(I18N.get('tt_tag_prompt'))}</label>
                    <textarea id="ras-tag-prompt" rows="6" onChange=${e => updateGlobalState('taggingPrompt', e.target.value)}>${c.taggingPrompt}</textarea>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_cluster_prompt')} ${createTooltipIcon(I18N.get('tt_cluster_prompt'))}</label>
                    <textarea id="ras-cluster-prompt" rows="6" onChange=${e => updateGlobalState('clusteringPrompt', e.target.value)}>${c.clusteringPrompt}</textarea>
                </div>

                 <div class="ras-field">
                    <label>${I18N.get('lbl_class_prompt')} ${createTooltipIcon(I18N.get('tt_class_prompt'))}</label>
                    <textarea id="ras-class-prompt" rows="6" onChange=${e => updateGlobalState('classificationPrompt', e.target.value)}>${c.classificationPrompt}</textarea>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_ignored_tags')} ${createTooltipIcon(I18N.get('tt_ignored_tags'))}</label>
                    <textarea id="ras-ignored-tags" rows="2" onChange=${e => updateGlobalState('ignoredTags', e.target.value)}>${c.ignoredTags}</textarea>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-auto-describe" checked=${c.autoDescribe} onChange=${e => updateGlobalState('autoDescribe', e.target.checked, () => this.forceUpdate())} style="margin-right:5px;" /> ${I18N.get('lbl_auto_describe')} ${createTooltipIcon(I18N.get('tt_auto_describe'))}
                    </label>
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-use-vision" checked=${c.useVision} onChange=${e => updateGlobalState('useVision', e.target.checked)} style="margin-right:5px;" /> ${I18N.get('lbl_use_vision')} ${createTooltipIcon(I18N.get('tt_use_vision'))}
                    </label>
                </div>
                <div class="ras-field" id="ras-desc-prompt-group" style="display:${c.autoDescribe ? 'block' : 'none'}">
                    <label>${I18N.get('lbl_desc_prompt')} ${createTooltipIcon(I18N.get('tt_desc_prompt'))}</label>
                    <textarea id="ras-desc-prompt" rows="3" onChange=${e => updateGlobalState('descriptionPrompt', e.target.value)}>${c.descriptionPrompt}</textarea>
                </div>
            </div>
        `;
    }
}

class OptionsApp extends Component {
    constructor() {
        super();
        this.state = { config: null, status: 'Loading configuration...', activeTab: 'settings' };
    }

    async componentDidMount() {
        const style = document.createElement('style');
        style.innerHTML = `
            .ras-field { margin-bottom: 15px; }
            .ras-field label { display: block; margin-bottom: 5px; font-weight: 500; font-size: 14px; }
            .ras-field select, .ras-field input[type="text"], .ras-field input[type="password"], .ras-field input[type="number"], .ras-field textarea { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-family: inherit;}
            .ras-btn { width: auto; padding: 8px 12px; background: #007aff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;}
            .ras-btn:hover { background: #0056b3; }
        `;
        document.head.appendChild(style);

        await STATE.init();
        this.setState({ config: STATE.config, status: '' });

        setTimeout(() => {
            if (window.rasRuleEngine) window.renderRulesList();
            if (window.rasMacroEngine) window.renderMacrosList();
        }, 100);
    }

    render() {
        if (!this.state.config) {
            return html`<div>${this.state.status}</div>`;
        }

        return html`
            <div>
                <h1 style="margin-top:0;">Raindrop AI Sorter (The Sentinel) - Settings</h1>
                <p style="color:#666;">Global configuration for your Web Extension. These settings sync automatically to the background service worker and the content scripts injected into app.raindrop.io.</p>
                <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />

                <div style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
                    <button class="ras-btn" style="background:${this.state.activeTab === 'settings' ? '#007aff' : '#f0f0f0'}; color:${this.state.activeTab === 'settings' ? 'white' : '#333'}" onClick=${() => this.setState({activeTab: 'settings'})}>${I18N.get('settings')}</button>
                    <button class="ras-btn" style="background:${this.state.activeTab === 'prompts' ? '#007aff' : '#f0f0f0'}; color:${this.state.activeTab === 'prompts' ? 'white' : '#333'}" onClick=${() => this.setState({activeTab: 'prompts'})}>${I18N.get('prompts')}</button>
                    <button class="ras-btn" style="background:${this.state.activeTab === 'rules' ? '#007aff' : '#f0f0f0'}; color:${this.state.activeTab === 'rules' ? 'white' : '#333'}" onClick=${() => this.setState({activeTab: 'rules'})}>Rules</button>
                    <button class="ras-btn" style="background:${this.state.activeTab === 'macros' ? '#007aff' : '#f0f0f0'}; color:${this.state.activeTab === 'macros' ? 'white' : '#333'}" onClick=${() => this.setState({activeTab: 'macros'})}>Macros</button>
                    <button class="ras-btn" style="background:${this.state.activeTab === 'templates' ? '#007aff' : '#f0f0f0'}; color:${this.state.activeTab === 'templates' ? 'white' : '#333'}" onClick=${() => this.setState({activeTab: 'templates'})}>Templates</button>
                    <button class="ras-btn" style="background:${this.state.activeTab === 'graph' ? '#007aff' : '#f0f0f0'}; color:${this.state.activeTab === 'graph' ? 'white' : '#333'}" onClick=${() => this.setState({activeTab: 'graph'})}>Graph</button>
                </div>

                <div style="max-width: 600px;">
                    <${SettingsTab} active=${this.state.activeTab === 'settings'} />
                    <${PromptsTab} active=${this.state.activeTab === 'prompts'} />
                    <${RulesTab} active=${this.state.activeTab === 'rules'} />
                    <${MacrosTab} active=${this.state.activeTab === 'macros'} />
                    <${TemplatesTab} active=${this.state.activeTab === 'templates'} />
                    <${GraphTab} active=${this.state.activeTab === 'graph'} />
                </div>
            </div>
        `;
    }
}

const root = document.getElementById('options-root');
if (root) {
    render(html`<${OptionsApp} />`, root);
}
