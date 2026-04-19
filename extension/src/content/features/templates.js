import { STATE } from '../state.js';
import { RaindropAPI } from '../api.js';
import { NetworkClient } from '../network.js';

export class TemplateManager {
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
        try {
            return JSON.parse(STATE.config.customTemplates || '{}');
        } catch(e) {
            return {};
        }
    }

    static saveCustomTemplate(name, structure) {
        const custom = this.getCustomTemplates();
        custom[name] = {
            description: "Custom Template",
            structure: structure.split('\n').map(s => s.trim()).filter(s => s)
        };
        STATE.config.customTemplates = JSON.stringify(custom);
        STATE.saveConfig();
    }

    static deleteCustomTemplate(name) {
        const custom = this.getCustomTemplates();
        delete custom[name];
        STATE.config.customTemplates = JSON.stringify(custom);
        STATE.saveConfig();
    }

    static async applyTemplate(templateName, parentCollectionId = null) {
        const standard = this.getTemplates();
        const custom = this.getCustomTemplates();
        const template = standard[templateName] || custom[templateName];

        if (!template) throw new Error("Template not found");
        if (!STATE.config.raindropToken) throw new Error("API Token required");

        const api = new RaindropAPI(STATE.config.raindropToken, new NetworkClient());

        console.log(`[Templates] Applying ${templateName}...`);

        // Ensure we have collection cache loaded
        await api.getCollections();

        let createdCount = 0;
        for (const folderName of template.structure) {
            console.log(`[Templates] Ensuring folder: ${folderName}`);
            // Check if it already exists at the target level
            const existing = api.collectionCache.find(c => {
                const titleMatch = c.title.toLowerCase() === folderName.toLowerCase();
                const parentMatch = parentCollectionId ? (c.parent && c.parent.$id === parseInt(parentCollectionId)) : (!c.parent);
                return titleMatch && parentMatch;
            });

            if (!existing) {
                await api.createCollection(folderName, parentCollectionId);
                createdCount++;
            } else {
                console.log(`[Templates] Folder ${folderName} already exists.`);
            }
        }

        return createdCount;
    }
}
