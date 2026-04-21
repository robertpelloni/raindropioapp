import { STATE } from '../state.js';

export class MacroEngine {
    constructor() {
        this.macros = [];
        this.loadMacros();
    }

    loadMacros() {
        try {
            const saved = STATE.config.batch_macros || '[]';
            this.macros = JSON.parse(saved);
        } catch(e) {
            console.error("Failed to load macros", e);
            this.macros = [];
        }
    }

    saveMacros() {
        STATE.config.batch_macros = JSON.stringify(this.macros);
        STATE.saveConfig();
    }

    addMacro(condition, action) {
        // condition: { type: 'domain_equals', value: 'github.com' }
        // action: { type: 'add_tag', value: 'dev' }
        this.macros.push({ id: Date.now(), condition, action });
        this.saveMacros();
    }

    getMacros() {
        return this.macros;
    }

    deleteMacro(id) {
        this.macros = this.macros.filter(m => m.id !== id);
        this.saveMacros();
    }

    evaluate(bookmark) {
        const applicableActions = [];
        for (const macro of this.macros) {
            let matches = false;
            if (macro.condition.type === 'domain_equals') {
                try {
                    const domain = new URL(bookmark.link).hostname;
                    if (domain === macro.condition.value) matches = true;
                } catch(e) {}
            } else if (macro.condition.type === 'has_tag') {
                if (bookmark.tags && bookmark.tags.includes(macro.condition.value)) matches = true;
            } else if (macro.condition.type === 'title_contains') {
                if (bookmark.title && bookmark.title.toLowerCase().includes(macro.condition.value.toLowerCase())) matches = true;
            }

            if (matches) {
                applicableActions.push(macro.action);
            }
        }
        return applicableActions;
    }
}
