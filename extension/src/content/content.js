import { STATE } from './state.js';
import { RaindropAPI } from './api.js';
import { LLMClient } from './llm.js';
import { NetworkClient } from './network.js';

console.log('[Raindrop AI Sorter] Content script initialized on app.raindrop.io');

// Listen for initialization messages from background or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        sendResponse({ success: true, version: '2.1.0-alpha' });
    }
});

// Boot the async state manager
STATE.init().then(() => {
    console.log('[Raindrop AI Sorter] State initialized.', STATE.config);
    // Future: Boot UI injection here.
});
