// state.js (Web Extension Migration)
// Replaces GM_getValue/GM_setValue with chrome.storage.local

export class StateManager {
    constructor() {
        this.config = {
            raindropToken: '',
            provider: 'openai',
            openaiKey: '',
            openaiModel: 'gpt-4o-mini',
            anthropicKey: '',
            anthropicModel: 'claude-3-haiku-20240307',
            groqKey: '',
            groqModel: 'llama3-8b-8192',
            deepseekKey: '',
            deepseekModel: 'deepseek-chat',
            customBaseUrl: '',
            customModel: '',

            concurrency: 5,
            maxTags: 3,
            minTagCount: 5,

            taggingPrompt: 'Analyze the title and domain, output a JSON array of 1 to 3 relevant, broad category tags. Keep them simple.',
            clusteringPrompt: 'Cluster the following tags into 3-5 broad categories. Output JSON mapping each category name to an array of tags.',
            classificationPrompt: 'Given the title, URL, and tags of a bookmark, choose the most appropriate category from the provided list. Return only the category name.',
            ignoredTags: 'read-later, to-read, favorite',
            descriptionPrompt: 'Summarize this in one sentence.',

            language: 'en',
            skipTagged: false,
            dryRun: false,
            autoDescribe: false,
            useVision: false,
            deleteEmptyCols: false,
            nestedCollections: false,
            safeMode: false,
            minVotes: 2,
            reviewClusters: true,
            debugMode: false,
            tagBrokenLinks: false,

            // New Phase 2 data stores
            smart_rules: '[]',
            batch_macros: '[]'
        };

        this.isRunning = false;
        this.stopRequested = false;
        this.abortController = null;
        this.stats = { processed: 0, updated: 0, broken: 0, moved: 0, errors: 0, deleted: 0, tokens: {input:0, output:0} };
        this.actionLog = [];
    }

    async init() {
        return new Promise((resolve) => {
            chrome.storage.local.get(null, (result) => {
                if (result && Object.keys(result).length > 0) {
                    this.config = { ...this.config, ...result };
                }
                resolve();
            });
        });
    }

    saveConfig() {
        chrome.storage.local.set(this.config, () => {
            if (chrome.runtime.lastError) {
                console.error("Failed to save config:", chrome.runtime.lastError);
            }
        });
    }

    aiDiagnosticsLog(type, details) {
        if (!this.config.debugMode) return;
        const entry = {
            timestamp: new Date().toISOString(),
            type,
            details
        };

        chrome.storage.local.get(['aiDiagnostics'], (result) => {
            let logs = result.aiDiagnostics || [];
            logs.push(entry);
            // Keep last 50
            if (logs.length > 50) logs = logs.slice(-50);
            chrome.storage.local.set({ aiDiagnostics: logs });
        });

        console.log("[RAS-AI-LOG] " + type, details);
    }
}

export const STATE = new StateManager();
