/**
 * Web Extension StateManager
 * Replaces the legacy `state.js` from the Tampermonkey architecture.
 * Migrates synchronous `GM_getValue`/`GM_setValue` to asynchronous `chrome.storage.local`.
 */

export class StateManager {
    constructor() {
        this.isRunning = false;
        this.stopRequested = false;
        this.abortController = null;
        this.log = [];
        this.stats = {
            processed: 0,
            updated: 0,
            broken: 0,
            moved: 0,
            errors: 0,
            deleted: 0,
            tokens: { input: 0, output: 0 }
        };
        this.actionLog = [];
        this.aiDiagnosticsLog = [];
        this.budgetAlertShown = false;

        // Configuration object will be populated asynchronously
        this.config = {};
    }

    /**
     * Initializes the StateManager by fetching all stored configuration values
     * from the extension's local storage database.
     * @returns {Promise<void>}
     */
    async init() {
        return new Promise((resolve) => {
            // Default configuration values
            const defaultConfigs = {
                openaiKey: '',
                openaiModel: 'gpt-4o-mini',
                anthropicKey: '',
                anthropicModel: 'claude-3-haiku-20240307',
                raindropToken: '',
                provider: 'openai',
                groqKey: '',
                groqModel: 'llama3-70b-8192',
                deepseekKey: '',
                deepseekModel: 'deepseek-chat',
                customBaseUrl: 'http://localhost:11434/v1',
                customModel: 'llama3',
                concurrency: 20,
                maxTags: 5,
                targetCollectionId: 0,
                skipTagged: false,
                dryRun: false,

                taggingPrompt: `Analyze the following content (text and/or image) to understand its core topic, context, and utility.\nTask 1: Generate {{MAX_TAGS}} tags.\n- Tags should be hierarchical where possible (e.g., "Dev", "Dev > Web").\n- Tags should be broad enough for grouping but specific enough to be useful.\n- If the content is a tool, tag its purpose (e.g., "Productivity", "Utility").\n- If it's a receipt/invoice, tag as "Finance > Receipt".\n- Avoid these tags: {{IGNORED_TAGS}}\n\nOutput JSON ONLY:\n{\n"tags": ["tag1", "tag2"]\n}\n\nContent:\n{{CONTENT}}`,
                clusteringPrompt: `You are a Librarian. Organize these tags into a clean folder structure.\nRules:\n1. Group related tags into broad categories (e.g., "React", "Vue" -> "Development > Web > Frameworks").\n2. Use nested paths separated by " > " if "Allow Nested Folders" is enabled.\n3. Create 5-15 high-level categories maximum.\n4. Do not force tags that don't fit into a "Misc" category unless absolutely necessary.\n\nOutput JSON ONLY:\n{ "Folder Name": ["tag1", "tag2"] }\n\nTags:\n{{TAGS}}`,
                classificationPrompt: `Determine the single best folder for this bookmark based on the existing structure.\nBookmark:\n{{BOOKMARK}}\nExisting Folders:\n{{CATEGORIES}}\nRules:\n1. Choose the most specific matching folder.\n2. If the bookmark is a receipt/purchase, look for "Finance" or "Purchases".\n3. If it's a tutorial, look for "Reference" or "Dev".\n4. Return null if it fits nowhere.\nOutput JSON ONLY: { "category": "Folder Name" }`,

                ignoredTags: 'unsorted, import, bookmark',
                autoDescribe: false,
                useVision: false,
                descriptionPrompt: 'Summarize this in one sentence.',
                nestedCollections: false,
                tagBrokenLinks: false,
                debugMode: false,
                reviewClusters: false,
                minTagCount: 2,
                deleteEmptyCols: false,
                semanticDedupe: false,
                localEmbeddings: false,
                safeMode: true,
                minVotes: 2,
                language: 'en',
                darkMode: false,
                smartTriggers: false,
                costBudget: 0
            };

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(null, (result) => {
                    // Merge defaults with stored values
                    for (const key in defaultConfigs) {
                        this.config[key] = result.hasOwnProperty(key) ? result[key] : defaultConfigs[key];
                    }
                    resolve();
                });
            } else {
                // Fallback for environments outside the extension (e.g., tests)
                console.warn('[StateManager] chrome.storage.local is not available. Using defaults.');
                this.config = { ...defaultConfigs };
                resolve();
            }
        });
    }

    /**
     * Safely updates a configuration value and syncs it to chrome.storage
     * @param {string} key
     * @param {any} value
     */
    setConfig(key, value) {
        this.config[key] = value;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [key]: value });
        }
    }
}

// Global Singleton Instance
export const STATE = new StateManager();
