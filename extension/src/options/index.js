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


class MacrosTab extends Component {
    constructor() {
        super();
        this.state = {
            macros: [],
            cType: 'domain_equals',
            cVal: '',
            aType: 'add_tag',
            aVal: ''
        };
    }

    componentDidMount() {
        this.loadMacros();
    }

    loadMacros() {
        try {
            const macros = JSON.parse(STATE.config.batch_macros || '[]');
            this.setState({ macros });
        } catch(e) {
            this.setState({ macros: [] });
        }
    }

    addMacro() {
        const { cType, cVal, aType, aVal, macros } = this.state;
        if (!cVal.trim() || !aVal.trim()) return;

        const newMacro = {
            condition: { type: cType, value: cVal.trim() },
            action: { type: aType, value: aVal.trim() },
            id: Date.now().toString()
        };

        const updated = [...macros, newMacro];
        updateGlobalState('batch_macros', JSON.stringify(updated), () => {
            this.setState({ macros: updated, cVal: '', aVal: '' });
        });
    }

    removeMacro(id) {
        const updated = this.state.macros.filter(m => m.id !== id);
        updateGlobalState('batch_macros', JSON.stringify(updated), () => {
            this.setState({ macros: updated });
        });
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
                        <select value=${this.state.cType} onChange=${e => this.setState({cType: e.target.value})} style="flex:1; padding:4px;">
                            <option value="domain_equals">Domain Equals</option>
                            <option value="has_tag">Has Tag</option>
                            <option value="title_contains">Title Contains</option>
                        </select>
                        <input type="text" placeholder="e.g. github.com" value=${this.state.cVal} onInput=${e => this.setState({cVal: e.target.value})} style="flex:1; padding:4px;" />
                    </div>
                    <div style="display:flex; gap:5px; margin-bottom:5px;">
                        <span style="line-height:24px;">THEN</span>
                        <select value=${this.state.aType} onChange=${e => this.setState({aType: e.target.value})} style="flex:1; padding:4px;">
                            <option value="add_tag">Add Tag</option>
                            <option value="move_to_folder">Move to Folder (Name)</option>
                        </select>
                        <input type="text" placeholder="e.g. open-source" value=${this.state.aVal} onInput=${e => this.setState({aVal: e.target.value})} style="flex:1; padding:4px;" />
                    </div>
                    <button class="ras-btn" onClick=${() => this.addMacro()} style="padding:4px 8px;">Add Macro</button>
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
                        <tbody>
                            ${this.state.macros.map(m => html`
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 4px;">${m.condition.type}: ${m.condition.value}</td>
                                    <td style="padding: 4px;">${m.action.type}: ${m.action.value}</td>
                                    <td style="padding: 4px; text-align:right;">
                                        <button style="background:none; border:none; color:#dc3545; cursor:pointer;" onClick=${() => this.removeMacro(m.id)}>X</button>
                                    </td>
                                </tr>
                            `)}
                            ${this.state.macros.length === 0 ? html`<tr><td colspan="3" style="padding:10px; text-align:center; color:#999;">No macros defined.</td></tr>` : ''}
                        </tbody>
                    </table>
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
                    </div>

                <div style="max-width: 600px;">
                    <${SettingsTab} active=${this.state.activeTab === 'settings'} />
                    <${PromptsTab} active=${this.state.activeTab === 'prompts'} />
                    <${RulesTab} active=${this.state.activeTab === 'rules'} />
                    <${MacrosTab} active=${this.state.activeTab === 'macros'} />
                    </div>
            </div>
        `;
    }
}

const root = document.getElementById('options-root');
if (root) {
    render(html`<${OptionsApp} />`, root);
}
