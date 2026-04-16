import { h, render, Component } from 'preact';
import htm from 'htm';
import { STATE } from './state.js';
import { I18N } from './i18n.js';
import { createTooltipIcon, log, debug } from './utils.js';
import { startSorting, stopSorting } from './logic.js';
import { NetworkClient } from './network.js';
import { RaindropAPI } from './api.js';
import { SemanticGraph } from './features/semantic_graph.js';
import { RuleEngine } from './features/rules.js';
import { MacroEngine } from './features/macros_ui.js';

// Initialize HTM to work with Preact
const html = htm.bind(h);
class RulesTab extends Component {
    componentDidMount() {
        if (window.rasRuleEngine) window.renderRulesList(); // Re-use legacy rendering logic for now to prevent breaking changes
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
                            <!-- Rules populated dynamically -->
                        </tbody>
                    </table>
                </div>
                <button id="ras-refresh-rules-btn" class="ras-btn" style="margin-top: 10px;">Refresh Rules</button>
            </div>
        `;
    }
}

class MacrosTab extends Component {
    componentDidMount() {
        if (window.rasMacroEngine) window.renderMacrosList();
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
                    <button id="ras-add-macro-btn" class="ras-btn">Add Macro</button>
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
                            <!-- Macros populated dynamically -->
                        </tbody>
                    </table>
                </div>
                <button id="ras-run-macros-btn" class="ras-btn" style="margin-top: 10px; background: #28a745;">Run Macros Now</button>
            </div>
        `;
    }
}

class TemplatesTab extends Component {
    render() {
        return html`
            <div id="ras-tab-templates" class="ras-tab-content ${this.props.active ? 'active' : ''}" style="${this.props.active ? '' : 'display:none;'}">
                <h3>The Architect (Templates)</h3>
                <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Apply pre-defined folder structures (PARA, Dewey Decimal, etc).</p>
                <div class="ras-field">
                    <select id="ras-template-select">
                        <option value="para">P.A.R.A Method</option>
                        <option value="dewey">Dewey Decimal System</option>
                        <option value="academic">Academic Research</option>
                    </select>
                </div>
                <button id="ras-apply-template-btn" class="ras-btn">Apply Template</button>
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
                    <button id="ras-render-graph-btn" class="ras-btn" style="width:auto; padding:4px 12px;">Render Graph</button>
                </div>
                <p style="font-size: 12px; color: #666; margin-bottom: 10px;">Visual map of tags. (Requires vis-network.js)</p>
                <div id="ras-graph-container" style="width: 100%; height: 350px; background: #fafafa; border: 1px solid #ccc; text-align: center; line-height: 350px;">
                    <em>Graph Visualization Pending</em>
                </div>
            </div>
        `;
    }
}

class SettingsTab extends Component {
    render() {
        return html`
            <div id="ras-tab-settings" class="ras-tab-content ${this.props.active ? 'active' : ''}" style="${this.props.active ? '' : 'display:none;'}">
                <div class="ras-field">
                    <label>${I18N.get('lbl_language')} ${createTooltipIcon(I18N.get('tt_language'))}</label>
                    <select id="ras-language">
                        <option value="en" selected=${STATE.config.language === 'en'}>English</option>
                        <option value="es" selected=${STATE.config.language === 'es'}>Español</option>
                    </select>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_raindrop_token')} ${createTooltipIcon(I18N.get('tt_raindrop_token'))}</label>
                    <input type="password" id="ras-raindrop-token" value="${STATE.config.raindropToken}" />
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_provider')} ${createTooltipIcon(I18N.get('tt_provider'))}</label>
                    <select id="ras-provider" onChange=${(e) => this.setState({provider: e.target.value})}>
                        <option value="openai" selected=${STATE.config.provider === 'openai'}>OpenAI</option>
                        <option value="anthropic" selected=${STATE.config.provider === 'anthropic'}>Anthropic</option>
                        <option value="groq" selected=${STATE.config.provider === 'groq'}>Groq</option>
                        <option value="deepseek" selected=${STATE.config.provider === 'deepseek'}>DeepSeek</option>
                        <option value="custom" selected=${STATE.config.provider === 'custom'}>Custom / Local</option>
                    </select>
                </div>

                <div class="ras-field" id="ras-openai-group" style="display:${(!this.state.provider && STATE.config.provider === 'openai') || this.state.provider === 'openai' ? 'block' : 'none'}">
                    <label>${I18N.get('lbl_openai_key')} ${createTooltipIcon(I18N.get('tt_openai_key'))}</label>
                    <input type="password" id="ras-openai-key" value="${STATE.config.openaiKey}" />
                    <label style="margin-top:5px;">${I18N.get('lbl_openai_model')} ${createTooltipIcon(I18N.get('tt_openai_model'))}</label>
                    <input type="text" id="ras-openai-model" value="${STATE.config.openaiModel || 'gpt-4o-mini'}" placeholder="gpt-4o-mini" />
                </div>

                <div class="ras-field" id="ras-anthropic-group" style="display:${(!this.state.provider && STATE.config.provider === 'anthropic') || this.state.provider === 'anthropic' ? 'block' : 'none'}">
                    <label>${I18N.get('lbl_anthropic_key')} ${createTooltipIcon(I18N.get('tt_anthropic_key'))}</label>
                    <input type="password" id="ras-anthropic-key" value="${STATE.config.anthropicKey}" />
                    <label style="margin-top:5px;">${I18N.get('lbl_anthropic_model')} ${createTooltipIcon(I18N.get('tt_anthropic_model'))}</label>
                    <input type="text" id="ras-anthropic-model" value="${STATE.config.anthropicModel || 'claude-3-haiku-20240307'}" placeholder="claude-3-haiku-20240307" />
                </div>

                <div class="ras-field" id="ras-groq-group" style="display:${(!this.state.provider && STATE.config.provider === 'groq') || this.state.provider === 'groq' ? 'block' : 'none'}">
                    <label>${I18N.get('lbl_groq_key')} ${createTooltipIcon(I18N.get('tt_groq_key'))}</label>
                    <input type="password" id="ras-groq-key" value="${STATE.config.groqKey}" />
                    <label style="margin-top:5px;">${I18N.get('lbl_groq_model')} ${createTooltipIcon(I18N.get('tt_groq_model'))}</label>
                    <input type="text" id="ras-groq-model" value="${STATE.config.groqModel || 'llama3-8b-8192'}" placeholder="llama3-8b-8192" />
                </div>

                <div class="ras-field" id="ras-deepseek-group" style="display:${(!this.state.provider && STATE.config.provider === 'deepseek') || this.state.provider === 'deepseek' ? 'block' : 'none'}">
                    <label>${I18N.get('lbl_deepseek_key')} ${createTooltipIcon(I18N.get('tt_deepseek_key'))}</label>
                    <input type="password" id="ras-deepseek-key" value="${STATE.config.deepseekKey || ''}" />
                    <label style="margin-top:5px;">${I18N.get('lbl_deepseek_model')} ${createTooltipIcon(I18N.get('tt_deepseek_model'))}</label>
                    <input type="text" id="ras-deepseek-model" value="${STATE.config.deepseekModel || 'deepseek-chat'}" placeholder="deepseek-chat" />
                </div>

                <div id="ras-custom-group" style="display:${(!this.state.provider && STATE.config.provider === 'custom') || this.state.provider === 'custom' ? 'block' : 'none'}">
                     <div class="ras-field">
                        <label>${I18N.get('lbl_custom_url')} ${createTooltipIcon(I18N.get('tt_custom_url'))}</label>
                        <input type="text" id="ras-custom-url" placeholder="http://localhost:11434/v1" value="${STATE.config.customBaseUrl}" />
                    </div>
                     <div class="ras-field">
                        <label>${I18N.get('lbl_custom_model')} ${createTooltipIcon(I18N.get('tt_custom_model'))}</label>
                        <input type="text" id="ras-custom-model" placeholder="llama3" value="${STATE.config.customModel}" />
                    </div>
                </div>

                <div style="display:flex; gap: 10px;">
                    <div class="ras-field" style="flex:1">
                        <label>${I18N.get('lbl_concurrency')} ${createTooltipIcon(I18N.get('tt_concurrency'))}</label>
                        <input type="number" id="ras-concurrency" min="1" max="50" value="${STATE.config.concurrency}" />
                    </div>
                    <div class="ras-field" style="flex:1">
                        <label>${I18N.get('lbl_max_tags')} ${createTooltipIcon(I18N.get('tt_max_tags'))}</label>
                        <input type="number" id="ras-max-tags" min="1" max="20" value="${STATE.config.maxTags}" />
                    </div>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_min_tag_count')} ${createTooltipIcon(I18N.get('tt_min_tag_count'))}</label>
                    <input type="number" id="ras-min-tag-count" min="1" max="1000" value="${STATE.config.minTagCount}" />
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-skip-tagged" checked=${STATE.config.skipTagged} style="margin-right:5px;" /> ${I18N.get('lbl_skip_tagged')} ${createTooltipIcon(I18N.get('tt_skip_tagged'))}
                    </label>
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-dry-run" checked=${STATE.config.dryRun} style="margin-right:5px;" /> ${I18N.get('lbl_dry_run')} ${createTooltipIcon(I18N.get('tt_dry_run'))}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                         <input type="checkbox" id="ras-delete-empty" checked=${STATE.config.deleteEmptyCols} style="margin-right:5px;" /> ${I18N.get('lbl_delete_empty')} ${createTooltipIcon(I18N.get('tt_delete_empty'))}
                    </label>
                    <label style="display:inline-flex; align-items:center;">
                         <input type="checkbox" id="ras-nested-collections" checked=${STATE.config.nestedCollections} style="margin-right:5px;" /> ${I18N.get('lbl_nested_col')} ${createTooltipIcon(I18N.get('tt_nested_col'))}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-tag-broken" checked=${STATE.config.tagBrokenLinks} style="margin-right:5px;" /> ${I18N.get('lbl_tag_broken')} ${createTooltipIcon(I18N.get('tt_tag_broken'))}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-safe-mode" checked=${STATE.config.safeMode} onChange=${(e) => this.setState({safeMode: e.target.checked})} style="margin-right:5px;" /> ${I18N.get('lbl_safe_mode')} ${createTooltipIcon(I18N.get('tt_safe_mode'))}
                    </label>
                    <span id="ras-min-votes-container" style="display:${(!this.state.hasOwnProperty('safeMode') && STATE.config.safeMode) || this.state.safeMode ? 'inline-block' : 'none'}">
                        ${I18N.get('lbl_min_votes')}: <input type="number" id="ras-min-votes" min="1" max="10" value="${STATE.config.minVotes}" style="width: 40px;" />
                    </span>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-review-clusters" checked=${STATE.config.reviewClusters} style="margin-right:5px;" /> ${I18N.get('lbl_review_clusters')} ${createTooltipIcon(I18N.get('tt_review_clusters'))}
                    </label>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-debug-mode" checked=${STATE.config.debugMode} style="margin-right:5px;" /> ${I18N.get('lbl_debug_mode')} ${createTooltipIcon(I18N.get('tt_debug_mode'))}
                    </label>
                </div>

                <div class="ras-field" style="border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px;">
                    <label>Smart Triggers (Background Service) ${createTooltipIcon('Automatically poll the Unsorted folder in the background to apply your Rules and Macros.')}</label>
                    <div style="display:flex; flex-direction:column; gap:5px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <label style="display:inline-flex; align-items:center;">
                                <input type="checkbox" id="ras-smart-triggers" checked=${STATE.config.smartTriggers} onChange=${(e) => this.setState({smartTriggers: e.target.checked})} style="margin-right:5px;" /> Enable Auto-Sorting
                            </label>
                            <span id="ras-smart-interval-container" style="display:${(!this.state.hasOwnProperty('smartTriggers') && STATE.config.smartTriggers) || this.state.smartTriggers ? 'inline-block' : 'none'}">
                                Every <input type="number" id="ras-smart-interval" min="1" max="1440" value="${STATE.config.smartTriggersInterval}" style="width: 50px;" /> mins
                            </span>
                        </div>
                        <div id="ras-smart-llm-container" style="display:${(!this.state.hasOwnProperty('smartTriggers') && STATE.config.smartTriggers) || this.state.smartTriggers ? 'block' : 'none'}">
                            <label style="display:inline-flex; align-items:center;">
                                <input type="checkbox" id="ras-smart-llm" checked=${STATE.config.smartTriggersLLM} style="margin-right:5px;" /> Use AI Fallback ${createTooltipIcon('If no rules match, call the LLM to auto-tag. Costs API tokens.')}
                            </label>
                        </div>
                    </div>
                </div>

                <div class="ras-field" style="border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px;">
                    <label>${I18N.get('lbl_config_mgmt')}</label>
                    <div style="display:flex; gap: 5px;">
                        <button id="ras-export-config-btn" class="ras-btn" style="background:#6c757d;">${I18N.get('btn_export_config')}</button>
                        <button id="ras-import-config-btn" class="ras-btn" style="background:#6c757d;">${I18N.get('btn_import_config')}</button>
                        <input type="file" id="ras-import-file" style="display:none" accept=".json" />
                    </div>
                </div>
            </div>
        `;
    }
}

class PromptsTab extends Component {
    render() {
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
                    <textarea id="ras-tag-prompt" rows="6">${STATE.config.taggingPrompt}</textarea>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_cluster_prompt')} ${createTooltipIcon(I18N.get('tt_cluster_prompt'))}</label>
                    <textarea id="ras-cluster-prompt" rows="6">${STATE.config.clusteringPrompt}</textarea>
                </div>

                 <div class="ras-field">
                    <label>${I18N.get('lbl_class_prompt')} ${createTooltipIcon(I18N.get('tt_class_prompt'))}</label>
                    <textarea id="ras-class-prompt" rows="6">${STATE.config.classificationPrompt}</textarea>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_ignored_tags')} ${createTooltipIcon(I18N.get('tt_ignored_tags'))}</label>
                    <textarea id="ras-ignored-tags" rows="2">${STATE.config.ignoredTags}</textarea>
                </div>

                <div class="ras-field">
                    <label style="display:inline-flex; align-items:center; margin-right: 15px;">
                        <input type="checkbox" id="ras-auto-describe" checked=${STATE.config.autoDescribe} onChange=${(e) => this.setState({autoDescribe: e.target.checked})} style="margin-right:5px;" /> ${I18N.get('lbl_auto_describe')} ${createTooltipIcon(I18N.get('tt_auto_describe'))}
                    </label>
                    <label style="display:inline-flex; align-items:center;">
                        <input type="checkbox" id="ras-use-vision" checked=${STATE.config.useVision} style="margin-right:5px;" /> ${I18N.get('lbl_use_vision')} ${createTooltipIcon(I18N.get('tt_use_vision'))}
                    </label>
                </div>
                <div class="ras-field" id="ras-desc-prompt-group" style="display:${(!this.state.hasOwnProperty('autoDescribe') && STATE.config.autoDescribe) || this.state.autoDescribe ? 'block' : 'none'}">
                    <label>${I18N.get('lbl_desc_prompt')} ${createTooltipIcon(I18N.get('tt_desc_prompt'))}</label>
                    <textarea id="ras-desc-prompt" rows="3">${STATE.config.descriptionPrompt}</textarea>
                </div>
            </div>
        `;
    }
}

class HelpTab extends Component {
    render() {
        return html`
            <div id="ras-tab-help" class="ras-tab-content ${this.props.active ? 'active' : ''}" style="${this.props.active ? '' : 'display:none;'}">
                <h3>${I18N.get('help')} / Quick Start</h3>
                <p>1. <strong>${I18N.get('lbl_raindrop_token')}</strong>: Go to Raindrop.io Settings -> Integrations -> Test Token and paste it in the Settings tab.</p>
                <p>2. <strong>${I18N.get('lbl_openai_key')}</strong>: Enter an API key for OpenAI, Anthropic, Groq, or use a local model like Ollama (Custom URL).</p>
                <p>3. <strong>${I18N.get('dashboard')}</strong>: Select your target collection (or Unsorted) and the Mode (e.g. Full Organize) and click Start.</p>
                <hr style="margin: 15px 0; border:0; border-top: 1px solid var(--ras-border);"/>
                <p><strong>Keyboard Shortcut:</strong> <code>Alt+Shift+S</code> to toggle this panel.</p>
                <p><strong>Safe Mode:</strong> Enable in Settings to require manual review for all AI actions.</p>
                <p><strong>Smart Triggers:</strong> Enable in Settings to have the Background Service sort bookmarks automatically!</p>
                <p style="text-align:center; margin-top: 15px;">
                    <a href="https://github.com/robertpelloni/raindropioapp" target="_blank" style="color:#007aff;">View Documentation & GitHub</a>
                </p>
                <button id="ras-view-logs-btn" class="ras-btn" style="margin-top: 10px; background: #6c757d;">View Raw AI Logs</button>
            </div>
        `;
    }
}


class DashboardTab extends Component {
    render() {
        return html`
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
                        </optgroup>
                        <optgroup label="Maintenance">
                            <option value="cleanup_tags">${I18N.get('cleanup')}</option>
                            <option value="prune_tags">${I18N.get('prune')}</option>
                            <option value="flatten">${I18N.get('flatten')}</option>
                            <option value="delete_all_tags">${I18N.get('delete_all')}</option>
                            <option value="deduplicate">Deduplicate Links</option>
                            <option value="apply_macros">Run Batch Macros</option>
                            <option value="summarize">Newsletter / Summary</option>
                        </optgroup>
                    </select>
                </div>

                <div class="ras-field" style="background: var(--ras-hover-bg); padding: 5px; border-radius: 4px;">
                    <label>The Curator (Visual Query Builder)</label>
                    <div id="ras-query-builder-rows" style="margin-bottom: 5px;"></div>
                    <div style="display:flex; gap: 5px; margin-bottom: 5px;">
                        <select id="ras-qb-field" style="flex:1;">
                            <option value="tag">Tag</option>
                            <option value="domain">Domain</option>
                            <option value="title">Title</option>
                        </select>
                        <select id="ras-qb-operator" style="flex:1;">
                            <option value="IS">IS / INCLUDES</option>
                            <option value="NOT">NOT</option>
                        </select>
                        <input type="text" id="ras-qb-value" placeholder="value" style="flex:2;" />
                        <button id="ras-qb-add-btn" class="ras-btn" style="flex:1;">Add</button>
                    </div>
                </div>

                <div class="ras-field">
                    <label>${I18N.get('lbl_search_filter')} ${createTooltipIcon(I18N.get('tt_search_filter'))}</label>
                    <input type="text" id="ras-search-input" placeholder="Optional search query..." />
                </div>

                <div id="ras-progress-container" style="display:none; margin-bottom: 10px; background: #eee; height: 10px; border-radius: 5px; overflow: hidden;">
                    <div id="ras-progress-bar" style="width: 0%; height: 100%; background: #28a745; transition: width 0.3s;"></div>
                </div>

                <div id="ras-stats-bar">
                    <span id="ras-stats-tokens">${I18N.get('tokens')}: 0</span>
                    <span id="ras-stats-cost">${I18N.get('cost')}: $0.00</span>
                </div>

                <div style="display:flex; gap: 5px; margin-bottom: 10px;">
                    <button id="ras-start-btn" class="ras-btn" onClick=${() => startSorting()}>${I18N.get('start')}</button>
                    <button id="ras-stop-btn" class="ras-btn stop" style="display:none" onClick=${() => stopSorting()}>${I18N.get('stop')}</button>
                    <button id="ras-export-btn" class="ras-btn" style="background:#6c757d; width:auto; padding: 0 12px; font-size: 12px;" title="Download Audit Log">💾</button>
                </div>

                <div id="ras-log"></div>
            </div>
        `;
    }
}

class App extends Component {
    constructor() {
        super();
        this.state = { minimized: false, activeTab: 'dashboard' };
    }

    componentDidMount() {
        // We can add global styles here, or move them out
        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('ras-styles')) return;
        const style = document.createElement('style');
        style.id = 'ras-styles';
        style.innerHTML = `
        :root {
            --ras-bg: #fff;
            --ras-text: #333;
            --ras-border: #ddd;
            --ras-input-bg: #fff;
            --ras-header-bg: #f5f5f5;
            --ras-hover-bg: #f0f0f0;
        }
        /* Dark Mode Support */
        html.theme-dark #ras-container, body.theme-dark #ras-container {
            --ras-bg: #1c1c1c;
            --ras-text: #e0e0e0;
            --ras-border: #333;
            --ras-input-bg: #2a2a2a;
            --ras-header-bg: #252525;
            --ras-hover-bg: #333;
        }

        #ras-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 380px;
            background: var(--ras-bg);
            color: var(--ras-text);
            border: 1px solid var(--ras-border);
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            max-height: 85vh;
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
            background: var(--ras-header-bg);
            border-bottom: 1px solid var(--ras-border);
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            font-weight: 600;
        }
        #ras-tabs {
            display: flex;
            border-bottom: 1px solid var(--ras-border);
            background: var(--ras-header-bg);
            overflow-x: auto;
            white-space: nowrap;
        }
        .ras-tab-btn {
            flex: 1;
            padding: 8px 12px;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            color: var(--ras-text);
            opacity: 0.7;
            border-bottom: 2px solid transparent;
        }
        .ras-tab-btn:hover { background: var(--ras-hover-bg); }
        .ras-tab-btn.active {
            color: #007aff;
            opacity: 1;
            border-bottom: 2px solid #007aff;
            background: var(--ras-bg);
        }
        #ras-body {
            padding: 15px;
            overflow-y: auto;
            flex-grow: 1;
        }
        .ras-field {
            margin-bottom: 15px;
        }
        .ras-field label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            font-size: 13px;
        }
        .ras-field select, .ras-field input[type="text"], .ras-field input[type="password"], .ras-field input[type="number"], .ras-field textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--ras-border);
            border-radius: 4px;
            box-sizing: border-box;
            background: var(--ras-input-bg);
            color: var(--ras-text);
        }
        .ras-btn {
            width: 100%;
            padding: 10px;
            background: #007aff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
        }
        .ras-btn:hover { background: #0056b3; }
        .ras-btn.stop { background: #dc3545; }
        .ras-btn.stop:hover { background: #c82333; }

        #ras-log {
            height: 150px;
            overflow-y: auto;
            background: #1e1e1e;
            color: #a9dc76;
            font-family: monospace;
            font-size: 11px;
            padding: 10px;
            border-radius: 4px;
            white-space: pre-wrap;
            border: 1px solid #000;
        }
        .ras-log-error { color: #ff6188; }
        .ras-log-warn { color: #ffd866; }
        .ras-log-success { color: #a9dc76; font-weight: bold; }

        #ras-stats-bar {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--ras-text);
            margin-bottom: 10px;
            padding: 5px;
            background: var(--ras-hover-bg);
            border-radius: 4px;
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
            font-size: 20px;
            border: none;
        }
        `;
        document.head.appendChild(style);
    }

    render() {
        if (this.state.minimized) {
            return html`
                <button id="ras-toggle-btn" onClick=${() => this.setState({ minimized: false })}>🤖</button>
            `;
        }

        return html`
            <div id="ras-container">
                <div id="ras-header" onClick=${() => this.setState({ minimized: true })}>
                    <span>Raindrop AI Sorter v${'1.0.13'}</span>
                    <span>▼</span>
                </div>
                <div id="ras-tabs">
                    <button class="ras-tab-btn ${this.state.activeTab === 'dashboard' ? 'active' : ''}" onClick=${() => this.setState({activeTab: 'dashboard'})}>${I18N.get('dashboard')}</button>
                    <button class="ras-tab-btn ${this.state.activeTab === 'rules' ? 'active' : ''}" onClick=${() => this.setState({activeTab: 'rules'})}>Rules</button>
                    <button class="ras-tab-btn ${this.state.activeTab === 'macros' ? 'active' : ''}" onClick=${() => this.setState({activeTab: 'macros'})}>Macros</button>
                    <button class="ras-tab-btn ${this.state.activeTab === 'templates' ? 'active' : ''}" onClick=${() => this.setState({activeTab: 'templates'})}>Templates</button>
                    <button class="ras-tab-btn ${this.state.activeTab === 'graph' ? 'active' : ''}" onClick=${() => this.setState({activeTab: 'graph'})}>Graph</button>
                    <button class="ras-tab-btn ${this.state.activeTab === 'settings' ? 'active' : ''}" onClick=${() => this.setState({activeTab: 'settings'})}>${I18N.get('settings')}</button>
                    <button class="ras-tab-btn ${this.state.activeTab === 'prompts' ? 'active' : ''}" onClick=${() => this.setState({activeTab: 'prompts'})}>${I18N.get('prompts')}</button>
                    <button class="ras-tab-btn ${this.state.activeTab === 'help' ? 'active' : ''}" onClick=${() => this.setState({activeTab: 'help'})}>${I18N.get('help')}</button>
                </div>
                <div id="ras-body">
                    <div style="${this.state.activeTab === 'dashboard' ? '' : 'display:none'}">
                        <${DashboardTab} />
                    </div>
                    <${RulesTab} active=${this.state.activeTab === 'rules'} />
                    <${MacrosTab} active=${this.state.activeTab === 'macros'} />
                    <${TemplatesTab} active=${this.state.activeTab === 'templates'} />
                    <${GraphTab} active=${this.state.activeTab === 'graph'} />
                    <${SettingsTab} active=${this.state.activeTab === 'settings'} />
                    <${PromptsTab} active=${this.state.activeTab === 'prompts'} />
                    <${HelpTab} active=${this.state.activeTab === 'help'} />
                </div>
            </div>
        `;
    }
}

export function createUI() {
    if (document.getElementById('ras-preact-root')) return;

    const root = document.createElement('div');
    root.id = 'ras-preact-root';
    document.body.appendChild(root);

    render(html`<${App} />`, root);
}


export function togglePanel() {
    const container = document.getElementById('ras-container');
    const toggleBtn = document.getElementById('ras-toggle-btn');

    // Quick hack for the root level if the state isn't directly exposed
    if (container && container.style.display !== 'none') {
        container.style.display = 'none';
        if (toggleBtn) toggleBtn.style.display = 'flex';
    } else if (toggleBtn) {
        toggleBtn.style.display = 'none';
        if (container) container.style.display = 'flex';
    }
}
