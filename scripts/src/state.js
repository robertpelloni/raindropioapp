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
            anthropicKey: GM_getValue('anthropicKey', ''),
            raindropToken: GM_getValue('raindropToken', ''),
            provider: GM_getValue('provider', 'openai'), // 'openai', 'anthropic', or 'custom'
            customBaseUrl: GM_getValue('customBaseUrl', 'http://localhost:11434/v1'),
            customModel: GM_getValue('customModel', 'llama3'),
            model: GM_getValue('model', 'gpt-3.5-turbo'),
            concurrency: GM_getValue('concurrency', 20),
            maxTags: GM_getValue('maxTags', 5),
            targetCollectionId: 0, // 0 is 'All bookmarks'
<<<<<<< HEAD
            skipTagged: GM_getValue('skipTagged', false),
            dryRun: GM_getValue('dryRun', false),
=======
            skipTagged: false,
            dryRun: false,
>>>>>>> origin/feature/raindrop-ai-sorter-userscript-7272302230095877234
            taggingPrompt: GM_getValue('taggingPrompt', ''),
            clusteringPrompt: GM_getValue('clusteringPrompt', ''),
            classificationPrompt: GM_getValue('classificationPrompt', ''),
            ignoredTags: GM_getValue('ignoredTags', ''),
<<<<<<< HEAD
            autoDescribe: GM_getValue('autoDescribe', false),
            useVision: GM_getValue('useVision', false),
            descriptionPrompt: GM_getValue('descriptionPrompt', ''),
            nestedCollections: GM_getValue('nestedCollections', false),
            tagBrokenLinks: GM_getValue('tagBrokenLinks', false),
            debugMode: GM_getValue('debugMode', false),
=======
            autoDescribe: false,
            useVision: GM_getValue('useVision', false),
            descriptionPrompt: GM_getValue('descriptionPrompt', ''),
            nestedCollections: false,
            debugMode: false,
>>>>>>> origin/feature/raindrop-ai-sorter-userscript-7272302230095877234
            reviewClusters: GM_getValue('reviewClusters', false),
            minTagCount: GM_getValue('minTagCount', 2),
            deleteEmptyCols: GM_getValue('deleteEmptyCols', false),
            safeMode: GM_getValue('safeMode', true),
            minVotes: GM_getValue('minVotes', 2),
            language: GM_getValue('language', 'en')
        }
    };

    console.log('Raindrop.io AI Sorter loaded');
