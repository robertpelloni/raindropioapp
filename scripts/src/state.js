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

            // Refined Default Prompts
            taggingPrompt: GM_getValue('taggingPrompt', `
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
            `.trim()),

            clusteringPrompt: GM_getValue('clusteringPrompt', `
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
            `.trim()),

            classificationPrompt: GM_getValue('classificationPrompt', `
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
            `.trim()),

            ignoredTags: GM_getValue('ignoredTags', 'unsorted, import, bookmark'),
            autoDescribe: GM_getValue('autoDescribe', false),
            useVision: GM_getValue('useVision', false),
            descriptionPrompt: GM_getValue('descriptionPrompt', 'Summarize this in one sentence.'),
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
