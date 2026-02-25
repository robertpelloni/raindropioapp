    // Smart Rules Engine
    const RuleEngine = {
        rules: {
            merges: {}, // "bad_tag": "good_tag"
            moves: {}   // "tag": "Folder Name" or "domain.com": "Folder"
        },

        load() {
            this.rules = GM_getValue('smartRules', { merges: {}, moves: {} });
            // Ensure structure exists if GM_getValue returned null/undefined or partial object
            if (!this.rules) this.rules = { merges: {}, moves: {} };
            if (!this.rules.merges) this.rules.merges = {};
            if (!this.rules.moves) this.rules.moves = {};

            console.log(`[RuleEngine] Loaded ${Object.keys(this.rules.merges).length} merges, ${Object.keys(this.rules.moves).length} moves.`);
        },

        save() {
            GM_setValue('smartRules', this.rules);
        },

        addMergeRule(badTag, goodTag) {
            if (!badTag || !goodTag) return;
            this.rules.merges[badTag.toLowerCase()] = goodTag;
            this.save();
        },

        addMoveRule(criteria, folder) {
            if (!criteria || !folder) return;
            this.rules.moves[criteria.toLowerCase()] = folder;
            this.save();
        },

        removeMergeRule(badTag) {
            delete this.rules.merges[badTag.toLowerCase()];
            this.save();
        },

        removeMoveRule(criteria) {
            delete this.rules.moves[criteria.toLowerCase()];
            this.save();
        },

        getMerge(tag) {
            return this.rules.merges[tag.toLowerCase()];
        },

        getMove(tags) {
            // Check if any of the tags triggers a move rule
            // Returns the first matching folder
            for (const tag of tags) {
                const folder = this.rules.moves[tag.toLowerCase()];
                if (folder) return folder;
            }
            return null;
        },

        getAll() {
            return this.rules;
        },

        clear() {
            this.rules = { merges: {}, moves: {} };
            this.save();
        }
    };

    // Initialize on load
    try {
        RuleEngine.load();
    } catch(e) {
        console.warn('RuleEngine init failed (likely mock env)', e);
    }
