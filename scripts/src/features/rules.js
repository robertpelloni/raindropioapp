const RuleEngine = {
    getRules() {
        return GM_getValue('automationRules', []);
    },
    addRule(type, source, target) {
        const rules = this.getRules();
        // Dedup
        if (rules.find(r => r.type === type && r.source === source && r.target === target)) return;

        rules.push({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            type,
            source,
            target,
            created: Date.now()
        });
        GM_setValue('automationRules', rules);
        if(typeof log === 'function') log(`Rule saved: ${source} -> ${target}`, 'success');
    },
    deleteRule(id) {
        const rules = this.getRules();
        const newRules = rules.filter(r => r.id !== id);
        GM_setValue('automationRules', newRules);
        if(typeof log === 'function') log('Rule deleted.', 'info');
    },
    findRule(type, source) {
        const rules = this.getRules();
        return rules.find(r => r.type === type && r.source.toLowerCase() === source.toLowerCase());
    }
};

// Make globally available for UI and Logic
if (typeof window !== 'undefined') {
    window.RuleEngine = RuleEngine;
}
