
class RuleEngine {
    constructor() {
        this.rules = [];
        this.loadRules();
    }

    loadRules() {
        try {
            const saved = typeof GM_getValue === 'function' ? GM_getValue('smart_rules', '[]') : '[]';
            this.rules = JSON.parse(saved);
        } catch(e) {
            console.error("Failed to load rules", e);
            this.rules = [];
        }
    }

    saveRules() {
        if (typeof GM_setValue === 'function') {
            GM_setValue('smart_rules', JSON.stringify(this.rules));
        }
    }

    addRule(type, source, target) {
        // type: 'merge_tag', 'move_bookmark'
        // source: tag name or bookmark domain
        // target: tag name or folder name
        const exists = this.rules.find(r => r.type === type && r.source === source);
        if (!exists) {
            this.rules.push({ type, source, target, date: new Date().toISOString() });
            this.saveRules();
            console.log(`Rule added: ${type} ${source} -> ${target}`);
        } else {
            exists.target = target;
            exists.date = new Date().toISOString();
            this.saveRules();
        }
    }

    getRule(type, source) {
        return this.rules.find(r => r.type === type && r.source === source);
    }

    getRules() {
        return this.rules;
    }

    deleteRule(type, source) {
        this.rules = this.rules.filter(r => !(r.type === type && r.source === source));
        this.saveRules();
    }
}
// module.exports = RuleEngine; // Removed for userscript concat
