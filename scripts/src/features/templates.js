// The Architect: Structural Templates for Raindrop.io

class TemplateManager {
    static getTemplates() {
        return {
            "PARA": {
                description: "Projects, Areas, Resources, Archives (Tiago Forte)",
                structure: ["1. Projects", "2. Areas", "3. Resources", "4. Archives"]
            },
            "Dewey": {
                description: "Simplified Dewey Decimal System",
                structure: ["000 General", "100 Philosophy", "200 Religion", "300 Social", "400 Language", "500 Science", "600 Technology", "700 Arts", "800 Lit", "900 History"]
            },
            "Johnny.Decimal": {
                description: "Johnny.Decimal System (10-99 Categories)",
                structure: ["10-19 Finance", "20-29 Admin", "30-39 Marketing", "40-49 Sales", "50-59 Operations"]
            },
            "Simple": {
                description: "Basic topical organization",
                structure: ["Read Later", "Reference", "Tools", "Inspiration", "News"]
            }
        };
    }

    static getCustomTemplates() {
        return GM_getValue('customTemplates', {});
    }

    static saveCustomTemplate(name, structure) {
        const custom = this.getCustomTemplates();
        custom[name] = {
            description: "Custom Template",
            structure: structure.split('\n').map(s => s.trim()).filter(s => s)
        };
        GM_setValue('customTemplates', custom);
    }

    static deleteCustomTemplate(name) {
        const custom = this.getCustomTemplates();
        delete custom[name];
        GM_setValue('customTemplates', custom);
    }
}

// Export
if (typeof window !== 'undefined') {
    window.TemplateManager = TemplateManager;
}
