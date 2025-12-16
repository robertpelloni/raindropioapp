    // Initialize
    window.addEventListener('load', () => {
        createUI();
        // Try to populate collections if token is already there
        if(STATE.config.raindropToken) {
            const api = new RaindropAPI(STATE.config.raindropToken);
            api.getCollections().then(items => {
                 const sel = document.getElementById('ras-collection-select');
                 items.forEach(c => {
                     const opt = document.createElement('option');
                     opt.value = c._id;
                     opt.innerText = c.title;
                     sel.appendChild(opt);
                 });
            }).catch(e => console.log("Could not auto-load collections", e));
        }
    });

})();
