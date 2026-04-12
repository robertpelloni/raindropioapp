import { STATE } from '../content/state.js';

// Elements
const fields = {
    'raindropToken': 'opt-raindrop-token',
    'provider': 'opt-provider',
    'openaiKey': 'opt-openai-key',
    'openaiModel': 'opt-openai-model',
    'anthropicKey': 'opt-anthropic-key',
    'anthropicModel': 'opt-anthropic-model',
    'concurrency': 'opt-concurrency',
    'maxTags': 'opt-max-tags',
    'debugMode': 'opt-debug-mode',
    'dryRun': 'opt-dry-run',
    'useVision': 'opt-use-vision',
    'autoDescribe': 'opt-auto-describe',
    'taggingPrompt': 'opt-tag-prompt',
    'clusteringPrompt': 'opt-cluster-prompt',
    'classificationPrompt': 'opt-class-prompt',
    'ignoredTags': 'opt-ignored-tags',
    'smartTriggers': 'opt-smart-triggers',
    'smartTriggersInterval': 'opt-smart-interval',
    'smartTriggersLLM': 'opt-smart-llm',
    'tagBrokenLinks': 'opt-tag-broken',
    'deleteEmptyCols': 'opt-delete-empty'
};

const statusMsg = document.getElementById('status');

// Init
document.addEventListener('DOMContentLoaded', async () => {
    await STATE.init();
    loadValues();

    // Bind Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab, .tab-content').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.target).classList.add('active');
        });
    });

    // Bind Provider switch
    const provSel = document.getElementById('opt-provider');
    provSel.addEventListener('change', (e) => {
        document.querySelectorAll('.provider-group').forEach(el => el.style.display = 'none');
        const g = document.getElementById(\`group-\${e.target.value}\`);
        if(g) g.style.display = 'block';
    });

    // Bind Smart Triggers toggle
    const smartToggle = document.getElementById('opt-smart-triggers');
    smartToggle.addEventListener('change', (e) => {
        document.getElementById('opt-smart-interval-container').style.display = e.target.checked ? 'block' : 'none';
        document.getElementById('opt-smart-llm-container').style.display = e.target.checked ? 'block' : 'none';
    });

    // Save Button
    document.getElementById('btn-save').addEventListener('click', saveValues);

    // Export Button
    document.getElementById('btn-export').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(STATE.config, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href",     dataStr     );
        dlAnchorElem.setAttribute("download", "raindrop_ai_config_export.json");
        dlAnchorElem.click();
    });
});

function loadValues() {
    for (const [key, id] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (!el) continue;

        if (el.type === 'checkbox') {
            el.checked = !!STATE.config[key];
        } else {
            el.value = STATE.config[key] || '';
        }
    }

    // Trigger change events for visibility
    document.getElementById('opt-provider').dispatchEvent(new Event('change'));
    document.getElementById('opt-smart-triggers').dispatchEvent(new Event('change'));
}

function saveValues() {
    const prevTriggers = STATE.config.smartTriggers;
    const prevInterval = STATE.config.smartTriggersInterval;

    for (const [key, id] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (!el) continue;

        if (el.type === 'checkbox') {
            STATE.config[key] = el.checked;
        } else if (el.type === 'number') {
            STATE.config[key] = parseInt(el.value, 10);
        } else {
            STATE.config[key] = el.value;
        }
    }

    STATE.saveConfig();

    // Check if background worker needs updating
    if (prevTriggers !== STATE.config.smartTriggers || prevInterval !== STATE.config.smartTriggersInterval) {
        chrome.runtime.sendMessage({
            action: 'update_alarms',
            payload: {
                enabled: STATE.config.smartTriggers,
                interval: STATE.config.smartTriggersInterval
            }
        });
    }

    statusMsg.textContent = 'Settings saved successfully.';
    statusMsg.className = 'status-msg success';

    setTimeout(() => {
        statusMsg.style.display = 'none';
    }, 3000);
}
