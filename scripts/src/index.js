    // Initialize
<<<<<<< HEAD
    function init() {
        if (document.getElementById('ras-container')) return; // Already initialized

=======
    window.addEventListener('load', () => {
>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195
        createUI();
        // Try to populate collections if token is already there
        if(STATE.config.raindropToken) {
            const api = new RaindropAPI(STATE.config.raindropToken);
            api.getCollections().then(items => {
                 const sel = document.getElementById('ras-collection-select');
<<<<<<< HEAD
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
=======
                 items.forEach(c => {
                     const opt = document.createElement('option');
                     opt.value = c._id;
                     opt.innerText = c.title;
                     sel.appendChild(opt);
                 });
            }).catch(e => console.log("Could not auto-load collections", e));
        }
    });
>>>>>>> 194ae138fbedc19387d50f6b4c61069304fbe195

})();
