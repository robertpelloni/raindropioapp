    // Application State
    const STATE = {
        isRunning: false,
        stopRequested: false,
        log: [],
        stats: {
            processed: 0,
            updated: 0,
            broken: 0,
            moved: 0,
            errors: 0,
            deleted: 0,
            tokens: { input: 0, output: 0 }
        },
        actionLog: [],
        config: {
            openaiKey: GM_getValue('openaiKey', ''),
            openaiModel: GM_getValue('openaiModel', 'gpt-4o-mini'),
            anthropicKey: GM_getValue('anthropicKey', ''),
            anthropicModel: GM_getValue('anthropicModel', 'claude-3-haiku-20240307'),
            raindropToken: GM_getValue('raindropToken', ''),
            provider: GM_getValue('provider', 'openai'), // 'openai', 'anthropic', 'groq', 'deepseek', or 'custom'
            groqKey: GM_getValue('groqKey', ''),
            groqModel: GM_getValue('groqModel', 'llama3-70b-8192'),
            deepseekKey: GM_getValue('deepseekKey', ''),
            deepseekModel: GM_getValue('deepseekModel', 'deepseek-chat'),
            customBaseUrl: GM_getValue('customBaseUrl', 'http://localhost:11434/v1'),
            customModel: GM_getValue('customModel', 'llama3'),
            concurrency: GM_getValue('concurrency', 20),
            maxTags: GM_getValue('maxTags', 5),
            targetCollectionId: 0, // 0 is 'All bookmarks'
            skipTagged: GM_getValue('skipTagged', false),
            dryRun: GM_getValue('dryRun', false),
            taggingPrompt: GM_getValue('taggingPrompt', ''),
            clusteringPrompt: GM_getValue('clusteringPrompt', ''),
            classificationPrompt: GM_getValue('classificationPrompt', ''),
            ignoredTags: GM_getValue('ignoredTags', ''),
            autoDescribe: GM_getValue('autoDescribe', false),
            useVision: GM_getValue('useVision', false),
            descriptionPrompt: GM_getValue('descriptionPrompt', ''),
            nestedCollections: GM_getValue('nestedCollections', false),
            tagBrokenLinks: GM_getValue('tagBrokenLinks', false),
            debugMode: GM_getValue('debugMode', false),
            reviewClusters: GM_getValue('reviewClusters', false),
            minTagCount: GM_getValue('minTagCount', 2),
            deleteEmptyCols: GM_getValue('deleteEmptyCols', false),
            safeMode: GM_getValue('safeMode', true),
            minVotes: GM_getValue('minVotes', 2),
            language: GM_getValue('language', 'en')
        }
    };

    console.log('Raindrop.io AI Sorter loaded');
