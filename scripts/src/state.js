    // Application State Management
    class StateManager {
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

            // Wait until runtime to fetch configs so GM_getValue is available
            this.config = {};
        }

        init() {
            this.config = {
                openaiKey: typeof GM_getValue !== 'undefined' ? GM_getValue('openaiKey', '') : '',
                openaiModel: typeof GM_getValue !== 'undefined' ? GM_getValue('openaiModel', 'gpt-4o-mini') : 'gpt-4o-mini',
                anthropicKey: typeof GM_getValue !== 'undefined' ? GM_getValue('anthropicKey', '') : '',
                anthropicModel: typeof GM_getValue !== 'undefined' ? GM_getValue('anthropicModel', 'claude-3-haiku-20240307') : 'claude-3-haiku-20240307',
                raindropToken: typeof GM_getValue !== 'undefined' ? GM_getValue('raindropToken', '') : '',
                provider: typeof GM_getValue !== 'undefined' ? GM_getValue('provider', 'openai') : 'openai', // 'openai', 'anthropic', 'groq', 'deepseek', or 'custom'
                groqKey: typeof GM_getValue !== 'undefined' ? GM_getValue('groqKey', '') : '',
                groqModel: typeof GM_getValue !== 'undefined' ? GM_getValue('groqModel', 'llama3-70b-8192') : 'llama3-70b-8192',
                deepseekKey: typeof GM_getValue !== 'undefined' ? GM_getValue('deepseekKey', '') : '',
                deepseekModel: typeof GM_getValue !== 'undefined' ? GM_getValue('deepseekModel', 'deepseek-chat') : 'deepseek-chat',
                customBaseUrl: typeof GM_getValue !== 'undefined' ? GM_getValue('customBaseUrl', 'http://localhost:11434/v1') : 'http://localhost:11434/v1',
                customModel: typeof GM_getValue !== 'undefined' ? GM_getValue('customModel', 'llama3') : 'llama3',
                concurrency: typeof GM_getValue !== 'undefined' ? GM_getValue('concurrency', 20) : 20,
                maxTags: typeof GM_getValue !== 'undefined' ? GM_getValue('maxTags', 5) : 5,
                targetCollectionId: 0, // 0 is 'All bookmarks'
                skipTagged: typeof GM_getValue !== 'undefined' ? GM_getValue('skipTagged', false) : false,
                dryRun: typeof GM_getValue !== 'undefined' ? GM_getValue('dryRun', false) : false,

                // Refined Default Prompts
                taggingPrompt: typeof GM_getValue !== 'undefined' ? GM_getValue('taggingPrompt', `
                    Analyze the following content (text and/or image) to understand its core topic, context, and utility.

                    Task 1: Generate {{MAX_TAGS}} tags.
                    - Tags should be hierarchical where possible (e.g., "Dev", "Dev > Web").
                    - Tags should be broad enough for grouping but specific enough to be useful.
                    - If the content is a tool, tag its purpose (e.g., "Productivity", "Utility").
                    - If it's a receipt/invoice, tag as "Finance > Receipt".
                    - Avoid these tags: {{IGNORED_TAGS}}

                    ${GM_getValue('autoDescribe', false) ? 'Task 2: Summarize the content in 1 sentence.' : ''}

                    Output JSON ONLY:
                    {
                        "tags": ["tag1", "tag2"],
                        "description": "Summary..."
                    }

                    Content:
                    {{CONTENT}}
                `.trim()) : '',

                clusteringPrompt: typeof GM_getValue !== 'undefined' ? GM_getValue('clusteringPrompt', `
                    You are a Librarian. Organize these tags into a clean folder structure.

                    Rules:
                    1. Group related tags into broad categories (e.g., "React", "Vue" -> "Development > Web > Frameworks").
                    2. Use nested paths separated by " > " if "Allow Nested Folders" is enabled.
                    3. Create 5-15 high-level categories maximum.
                    4. Do not force tags that don't fit into a "Misc" category unless absolutely necessary.

                    Output JSON ONLY:
                    { "Folder Name": ["tag1", "tag2"] }

                    Tags:
                    {{TAGS}}
                `.trim()) : '',

                classificationPrompt: typeof GM_getValue !== 'undefined' ? GM_getValue('classificationPrompt', `
                    Determine the single best folder for this bookmark based on the existing structure.

                    Bookmark:
                    {{BOOKMARK}}

                    Existing Folders:
                    {{CATEGORIES}}

                    Rules:
                    1. Choose the most specific matching folder.
                    2. If the bookmark is a receipt/purchase, look for "Finance" or "Purchases".
                    3. If it's a tutorial, look for "Reference" or "Dev".
                    4. Return null if it fits nowhere.

                    Output JSON ONLY: { "category": "Folder Name" }
                `.trim()) : '',

                ignoredTags: typeof GM_getValue !== 'undefined' ? GM_getValue('ignoredTags', 'unsorted, import, bookmark') : 'unsorted, import, bookmark',
                autoDescribe: typeof GM_getValue !== 'undefined' ? GM_getValue('autoDescribe', false) : false,
                useVision: typeof GM_getValue !== 'undefined' ? GM_getValue('useVision', false) : false,
                descriptionPrompt: typeof GM_getValue !== 'undefined' ? GM_getValue('descriptionPrompt', 'Summarize this in one sentence.') : 'Summarize this in one sentence.',
                nestedCollections: typeof GM_getValue !== 'undefined' ? GM_getValue('nestedCollections', false) : false,
                tagBrokenLinks: typeof GM_getValue !== 'undefined' ? GM_getValue('tagBrokenLinks', false) : false,
                debugMode: typeof GM_getValue !== 'undefined' ? GM_getValue('debugMode', false) : false,
                reviewClusters: typeof GM_getValue !== 'undefined' ? GM_getValue('reviewClusters', false) : false,
                minTagCount: typeof GM_getValue !== 'undefined' ? GM_getValue('minTagCount', 2) : 2,
                deleteEmptyCols: typeof GM_getValue !== 'undefined' ? GM_getValue('deleteEmptyCols', false) : false,
                semanticDedupe: typeof GM_getValue !== 'undefined' ? GM_getValue('semanticDedupe', false) : false,
                localEmbeddings: typeof GM_getValue !== 'undefined' ? GM_getValue('localEmbeddings', false) : false,
                safeMode: typeof GM_getValue !== 'undefined' ? GM_getValue('safeMode', true) : true,
                minVotes: typeof GM_getValue !== 'undefined' ? GM_getValue('minVotes', 2) : 2,
                language: typeof GM_getValue !== 'undefined' ? GM_getValue('language', 'en') : 'en',
                darkMode: typeof GM_getValue !== 'undefined' ? GM_getValue('darkMode', false) : false,
                smartTriggers: typeof GM_getValue !== 'undefined' ? GM_getValue('smartTriggers', false) : false,
                costBudget: typeof GM_getValue !== 'undefined' ? parseFloat(GM_getValue('costBudget', 0)) : 0
            };
        }
    }

    const STATE = new StateManager();

    console.log('Raindrop.io AI Sorter loaded');
