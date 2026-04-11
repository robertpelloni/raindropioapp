
import { STATE } from './state.js';
import { createUI, togglePanel } from './ui.js';
import { RaindropAPI } from './api.js';
import { NetworkClient } from './network.js';

console.log("Raindrop AI Sorter (Web Extension) Content Script Loaded");

async function init() {
    if (document.getElementById('ras-container')) return; // Already initialized

    // Wait for async state init
    await STATE.init();

    // Inject UI
    createUI();

    // Auto load collections
    if(STATE.config.raindropToken) {
        const network = new NetworkClient();
        const api = new RaindropAPI(STATE.config.raindropToken, network);
        api.getCollections().then(items => {
             const sel = document.getElementById('ras-collection-select');
             if (sel) {
                 items.forEach(c => {
                     const opt = document.createElement('option');
                     opt.value = c._id;
                     opt.innerText = c.title;
                     sel.appendChild(opt);
                 });
             }
        }).catch(e => console.log("Could not auto-load collections", e));
    }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
} else {
    window.addEventListener('load', init);
}
