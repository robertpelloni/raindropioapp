
// Expose engines globally for UI bindings
if (typeof window !== 'undefined') {
    // Note: In the concatenated userscript, these classes are defined globally above this point
    // We just need to make sure they don't error out if called
}
    // Initialize
    function init() {
        if (document.getElementById('ras-container')) return; // Already initialized

        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand("Open AI Sorter", togglePanel);
        }

        STATE.init();

        if (STATE.config.darkMode) {
            document.body.classList.add('ras-dark-mode');
        }

        createUI();

        // Start Smart Triggers if enabled
        if (typeof SmartTriggers !== 'undefined') {
            SmartTriggers.start();
        }

        // Try to populate collections if token is already there
        if(STATE.config.raindropToken) {
            const api = new RaindropAPI(STATE.config.raindropToken);
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

})();
