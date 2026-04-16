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
                    ${this.state.activeTab === 'dashboard' && html`<${DashboardTab} />`}
                    ${this.state.activeTab !== 'dashboard' && html`
                        <div style="padding:20px; text-align:center; color:#666;">
                            <em>Migrating UI to Preact... Settings and other tabs are hidden during migration to native components.</em>
                        </div>
                    `}
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
