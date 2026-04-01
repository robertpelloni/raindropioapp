const SmartTriggers = {
    interval: null,

    start() {
        if (!STATE.config.smartTriggers || !STATE.config.raindropToken) return;

        // Run once shortly after load, then every 2 minutes
        setTimeout(() => this.runSilently(), 5000);
        this.interval = setInterval(() => this.runSilently(), 120000);
    },

    stop() {
        if (this.interval) clearInterval(this.interval);
    },

    async runSilently() {
        if (STATE.isRunning) return; // Don't interrupt manual runs

        const macros = GM_getValue('macros', []);
        if (macros.length === 0) return;

        try {
            // We need a dummy network client to pass to API
            const network = typeof NetworkClient !== 'undefined' ? new NetworkClient() : null;
            const api = new RaindropAPI(STATE.config.raindropToken, network);

            // Fetch newest bookmarks from Unsorted (Collection ID -1)
            const res = await api.getBookmarks(-1, 0, "");
            if (!res.items || res.items.length === 0) return;

            const needsCollections = macros.some(m => m.action === 'move_to');
            if (needsCollections) {
                await api.loadCollectionCache(true);
            }

            for (const bm of res.items) {
                let updatePayload = {};
                let newCollectionId = null;
                let tagsModified = false;
                let currentTags = new Set(bm.tags || []);

                for (const macro of macros) {
                    let match = false;

                    if (macro.condition === 'has_tag') {
                        match = currentTags.has(macro.conditionValue.toLowerCase().replace(/^#/, ''));
                    } else if (macro.condition === 'no_tags') {
                        match = currentTags.size === 0;
                    } else if (macro.condition === 'domain_is') {
                        match = bm.link.toLowerCase().includes(macro.conditionValue.toLowerCase());
                    } else if (macro.condition === 'title_contains') {
                        match = bm.title.toLowerCase().includes(macro.conditionValue.toLowerCase());
                    }

                    if (match) {
                        if (macro.action === 'add_tag') {
                            const tagToAdd = macro.actionValue.replace(/^#/, '').toLowerCase();
                            if (!currentTags.has(tagToAdd)) {
                                currentTags.add(tagToAdd);
                                tagsModified = true;
                                if(typeof log === 'function') log(`[Smart Trigger] Added tag "${tagToAdd}" to "${bm.title}"`);
                                console.log(`[Smart Trigger] Added tag "${tagToAdd}" to "${bm.title}"`);
                            }
                        } else if (macro.action === 'remove_tag') {
                            const tagToRemove = macro.actionValue.replace(/^#/, '').toLowerCase();
                            if (currentTags.has(tagToRemove)) {
                                currentTags.delete(tagToRemove);
                                tagsModified = true;
                                if(typeof log === 'function') log(`[Smart Trigger] Removed tag "${tagToRemove}" from "${bm.title}"`);
                                console.log(`[Smart Trigger] Removed tag "${tagToRemove}" from "${bm.title}"`);
                            }
                        } else if (macro.action === 'move_to') {
                            const targetName = macro.actionValue.toLowerCase();
                            const targetId = Object.keys(api.collectionCache).find(
                                id => api.collectionCache[id].title.toLowerCase() === targetName
                            );
                            if (targetId && targetId !== String(bm.collectionId)) {
                                newCollectionId = targetId;
                                if(typeof log === 'function') log(`[Smart Trigger] Moved "${bm.title}" to folder "${macro.actionValue}"`);
                                console.log(`[Smart Trigger] Moved "${bm.title}" to folder "${macro.actionValue}"`);
                            }
                        }
                    }
                }

                if (tagsModified) {
                    updatePayload.tags = Array.from(currentTags);
                }
                if (newCollectionId !== null) {
                    updatePayload.collectionId = parseInt(newCollectionId, 10);
                }

                if (Object.keys(updatePayload).length > 0) {
                    if (!STATE.config.dryRun) {
                        await api.updateBookmark(bm._id, updatePayload);
                    }
                }
            }
        } catch (e) {
            console.error("[Smart Triggers] Error:", e);
        }
    }
};

if (typeof window !== 'undefined') {
    window.SmartTriggers = SmartTriggers;
}
