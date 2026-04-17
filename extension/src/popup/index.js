import { h, render, Component } from 'preact';
import htm from 'htm';
import { STATE } from '../content/state.js';

const html = htm.bind(h);

class PopupApp extends Component {
    constructor() {
        super();
        this.state = {
            config: null,
            status: 'Loading...',
            lastSort: 'Never'
        };
    }

    async componentDidMount() {
        const style = document.createElement('style');
        style.innerHTML = `
            h3 { margin-top: 0; margin-bottom: 10px; font-size: 16px; color: #333; }
            p { font-size: 13px; color: #666; margin: 5px 0; }
            .ras-btn { width: 100%; padding: 8px; background: #007aff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; margin-top: 10px; }
            .ras-btn:hover { background: #0056b3; }
            .ras-btn-secondary { background: #f0f0f0; color: #333; }
            .ras-btn-secondary:hover { background: #e0e0e0; }
            .status-badge { display: inline-block; padding: 3px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; background: #28a745; color: white; }
            .status-badge.disabled { background: #dc3545; }
        `;
        document.head.appendChild(style);

        await STATE.init();

        // Optional: query local storage for last run time if we tracked it in state.js
        this.setState({ config: STATE.config, status: '' });
    }

    render() {
        if (!this.state.config) {
            return html`<div style="padding: 15px; text-align: center; color: #666;">${this.state.status}</div>`;
        }

        const c = this.state.config;
        const smartTriggersEnabled = c.smartTriggers;

        return html`
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                    <h3>The Sentinel (AI Sorter)</h3>
                    <span class="status-badge ${smartTriggersEnabled ? '' : 'disabled'}">${smartTriggersEnabled ? 'ACTIVE' : 'OFF'}</span>
                </div>

                <div style="background: #f8f9fa; border: 1px solid #eee; border-radius: 4px; padding: 10px; margin-bottom: 15px;">
                    <strong style="font-size: 12px; display:block; margin-bottom: 5px;">Background Polling</strong>
                    <p>Status: ${smartTriggersEnabled ? `Polling Unsorted every ${c.smartTriggersInterval}m` : 'Manual Mode Only'}</p>
                    <p>LLM Fallback: ${c.smartTriggersLLM ? 'Enabled' : 'Disabled'}</p>
                </div>

                <button class="ras-btn" onClick=${() => window.open('https://app.raindrop.io')}>Open Raindrop.io</button>
                <button class="ras-btn ras-btn-secondary" onClick=${() => { if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage(); else window.open(chrome.runtime.getURL('src/options/options.html')); }}>⚙️ Extension Settings</button>
            </div>
        `;
    }
}

const root = document.getElementById('popup-root');
if (root) {
    render(html`<${PopupApp} />`, root);
}
