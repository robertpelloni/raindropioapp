import { h, render, Component } from 'preact';
import htm from 'htm';

const html = htm.bind(h);

class OptionsApp extends Component {
    constructor() {
        super();
        this.state = { config: null, status: 'Loading configuration...' };
    }

    componentDidMount() {
        chrome.storage.local.get(null, (result) => {
            this.setState({ config: result || {}, status: '' });
        });
    }

    render() {
        if (!this.state.config) {
            return html`<div>${this.state.status}</div>`;
        }

        return html`
            <div>
                <h1>Raindrop AI Sorter (The Sentinel) - Settings</h1>
                <p>Global configuration for your Web Extension. These settings sync to the background service worker and the content scripts injected into app.raindrop.io.</p>
                <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;" />

                <div style="padding: 20px; background: #fff3cd; color: #856404; border-radius: 4px; margin-bottom: 20px;">
                    <strong>Migration in Progress:</strong> The Settings, Prompts, Rules, and Macros tabs are currently injected directly into the Raindrop.io UI. They will be moved to this dedicated extension page in the upcoming release to clean up the browsing experience.
                </div>

                <p>To access the AI Sorter, open <a href="https://app.raindrop.io" target="_blank">Raindrop.io</a> and click the floating 🤖 button in the bottom right corner.</p>
            </div>
        `;
    }
}

const root = document.getElementById('options-root');
if (root) {
    render(html`<${OptionsApp} />`, root);
}
