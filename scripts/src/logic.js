    async function startSorting() {
        if (STATE.isRunning) return;
        saveConfig();

        if (!STATE.config.raindropToken) {
            log('Error: Raindrop Token is required', 'error');
            return;
        }

        STATE.isRunning = true;
        STATE.stopRequested = false;
        document.getElementById('ras-start-btn').style.display = 'none';
        document.getElementById('ras-stop-btn').style.display = 'block';
        updateProgress(0);

        if (STATE.config.dryRun) {
            log('--- DRY RUN MODE ENABLED ---', 'warn');
            log('No changes will be made to your bookmarks.', 'warn');
        }

        log('Starting process...');
        // Reset stats (keep history?)
        STATE.stats = { processed: 0, updated: 0, broken: 0, moved: 0, errors: 0, deleted: 0, tokens: {input:0, output:0} };
        STATE.actionLog = []; // Reset log on new run? Or append? Resetting for now.

        try {
            // Logic will go here
            await runMainProcess();
        } catch (e) {
            if (e.message === 'Aborted' || e.message.includes('Aborted')) {
                log('Process aborted.', 'warn');
            } else {
                log(`Error: ${e.message}`, 'error');
                console.error(e);
            }
        } finally {
            STATE.isRunning = false;
            document.getElementById('ras-start-btn').style.display = 'block';
            document.getElementById('ras-stop-btn').style.display = 'none';
            log('Process finished or stopped.');

            const summary = `Run Complete.\nProcessed: ${STATE.stats.processed}\nUpdated: ${STATE.stats.updated}\nBroken Links: ${STATE.stats.broken}\nMoved: ${STATE.stats.moved}\nDeleted Tags/Cols: ${STATE.stats.deleted}\nErrors: ${STATE.stats.errors}`;
            log(summary);
            alert(summary);

            updateProgress(100);
            setTimeout(() => {
                 document.getElementById('ras-progress-container').style.display = 'none';
            }, 3000);
        }
    }

    function stopSorting() {
        if (STATE.isRunning) {
            STATE.stopRequested = true;
            if (STATE.abortController) {
                STATE.abortController.abort();
                log('Aborting active requests...', 'warn');
            }
            log('Stopping... please wait for current tasks to finish.', 'warn');
        }
    }

    async function runMainProcess() {
        // Initialize Network & AbortController
        if (STATE.abortController) STATE.abortController.abort();
        STATE.abortController = new AbortController();
        const network = new NetworkClient();

        const api = new RaindropAPI(STATE.config.raindropToken, network);
        const llm = new LLMClient(STATE.config, network);
        const collectionId = document.getElementById('ras-collection-select').value;
        const searchQuery = document.getElementById('ras-search-input').value.trim();
        const mode = document.getElementById('ras-action-mode').value;

        let allTags = new Set();
        let processedCount = 0;

        // ============================
        // MODE: Flatten Library
        // ============================
        if (mode === 'flatten') {
            log('Starting Library Flattening (Reset to Unsorted)...');
            if (confirm("WARNING: This will move bookmarks to 'Unsorted' and optionally DELETE empty folders. Continue?")) {
                await api.loadCollectionCache(true);
                const collections = api.collectionCache || [];

                // Exclude system collections (-1, 0, etc if present in list?)
                // API returns custom collections.
                log(`Found ${collections.length} collections.`);

                for (const col of collections) {
                    if (STATE.stopRequested) break;
                    if (col._id < 0) continue; // Skip Unsorted/Trash if they appear

                    log(`Processing collection: ${col.title}...`);

                    // Move items to -1
                    let page = 0;
                    while (!STATE.stopRequested) {
                        try {
                            const res = await api.getBookmarks(col._id, page);
                            if (!res.items || res.items.length === 0) break;

                            const items = res.items;
                            log(`Moving ${items.length} items to Unsorted...`);

                            await Promise.all(items.map(bm => api.moveBookmark(bm._id, -1)));
                            STATE.stats.moved += items.length;

                            // If we move items out, pagination might shift if we stay on same page?
                            // Raindrop removes moved items from source collection immediately.
                            // So page 0 should be used repeatedly.

                        } catch(e) {
                            log(`Error moving items from ${col.title}: ${e.message}`, 'error');
                            break;
                        }
                        // Safety break for empty loops
                        await new Promise(r => setTimeout(r, 500));
                    }

                    // Delete collection if requested
                    if (STATE.config.deleteEmptyCols) {
                        try {
                            await api.deleteCollection(col._id);
                            log(`Deleted collection: ${col.title}`, 'success');
                            STATE.stats.deleted++;
                        } catch(e) {
                            log(`Failed to delete collection ${col.title}: ${e.message}`, 'error');
                        }
                    }
                }
            }
            return;
        }

        // ============================
        // MODE: Organize (Semantic)
        // ============================
        if (mode === 'organize_semantic') {
            log('Organizing Semantic (Content -> Folder Path)...');
            await api.loadCollectionCache(true);

            const idToPath = {};
            const buildPath = (col) => {
                if (idToPath[col._id]) return idToPath[col._id];
                let p = col.title;
                if (col.parent && col.parent.$id) {
                    const parent = api.collectionCache.find(c => c._id === col.parent.$id);
                    if (parent) {
                        p = buildPath(parent) + ' > ' + p;
                    }
                }
                idToPath[col._id] = p;
                return p;
            };

            if (api.collectionCache) {
                api.collectionCache.forEach(c => buildPath(c));
            }
            const existingPaths = Object.values(idToPath).sort();

            let page = 0;
            let hasMore = true;

            while(hasMore && !STATE.stopRequested) {
                const res = await api.getBookmarks(collectionId, page, searchQuery);
                const items = res.items;
                if (!items || items.length === 0) break;

                log(`Processing page ${page} (${items.length} items)...`);

                for (const bm of items) {
                    if (STATE.stopRequested) break;
                    try {
                        const result = await llm.classifyBookmarkSemantic(bm, existingPaths);
                        if (result && result.path) {
                            const targetId = await api.ensureCollectionPath(result.path);
                            if (targetId) {
                                if (bm.collection && bm.collection.$id === targetId) {
                                    log(`Skipping ${bm.title} (already in path)`);
                                } else {
                                    await api.moveBookmark(bm._id, targetId);
                                    STATE.stats.moved++;
                                    log(`Moved "${bm.title}" -> ${result.path}`, 'success');
                                }
                            }
                        }
                    } catch(e) {
                        log(`Error processing ${bm.title}: ${e.message}`, 'error');
                    }
                }
                page++;
                await new Promise(r => setTimeout(r, 500));
            }
            return;
        }

        // ============================
        // MODE: Delete All Tags
        // ============================
        if (mode === 'delete_all_tags') {
            log('Deleting ALL Tags...');
            if (confirm("WARNING: This will remove EVERY tag from your library. This cannot be undone. Continue?")) {
                try {
                    const allTags = await api.getAllTags();
                    if (allTags.length === 0) {
                        log('No tags found.');
                        return;
                    }

                    const tagNames = allTags.map(t => t._id);
                    log(`Found ${tagNames.length} tags to delete.`);

                    // Batch delete
                    const BATCH_SIZE = 50;
                    for (let i = 0; i < tagNames.length; i += BATCH_SIZE) {
                        if (STATE.stopRequested) break;
                        const batch = tagNames.slice(i, i + BATCH_SIZE);
                        log(`Deleting batch ${Math.floor(i/BATCH_SIZE)+1}...`);
                        await api.removeTagsBatch(batch);
                        STATE.stats.deleted += batch.length;
                        updateProgress((i / tagNames.length) * 100);
                        await new Promise(r => setTimeout(r, 500));
                    }
                } catch(e) {
                    log(`Error deleting tags: ${e.message}`, 'error');
                }
            }
            return;
        }

        // ============================
        // MODE: Prune Infrequent Tags
        // ============================
        if (mode === 'prune_tags') {
            const minCount = STATE.config.minTagCount;
            log(`Pruning tags with fewer than ${minCount} occurrences...`);

            try {
                const allTags = await api.getAllTags();
                const tagsToDelete = allTags.filter(t => t.count < minCount).map(t => t._id);

                if (tagsToDelete.length === 0) {
                    log('No tags found matching criteria.');
                    return;
                }

                log(`Found ${tagsToDelete.length} tags to prune.`);

                if (STATE.config.reviewClusters) {
                     // Reuse review panel?
                     // It expects "moves", let's mock it or just use confirm for now simpler
                     if (!confirm(`Found ${tagsToDelete.length} tags to delete (e.g. ${tagsToDelete.slice(0,5).join(', ')}). Proceed?`)) {
                         return;
                     }
                }

                const BATCH_SIZE = 50;
                for (let i = 0; i < tagsToDelete.length; i += BATCH_SIZE) {
                    if (STATE.stopRequested) break;
                    const batch = tagsToDelete.slice(i, i + BATCH_SIZE);
                    await api.removeTagsBatch(batch);
                    STATE.stats.deleted += batch.length;
                    log(`Deleted ${batch.length} tags.`);
                    updateProgress((i / tagsToDelete.length) * 100);
                    await new Promise(r => setTimeout(r, 500));
                }
            } catch(e) {
                log(`Error pruning tags: ${e.message}`, 'error');
            }
            return;
        }

        // ============================
        // MODE: Organize (Existing Folders)
        // ============================
        if (mode === 'organize_existing') {
            log('Organizing into EXISTING folders only...');
            await api.loadCollectionCache(true);
            const collections = api.collectionCache;
            if (!collections || collections.length === 0) {
                log('No existing collections found.', 'error');
                return;
            }

            const colNames = collections.map(c => c.title);

            // Process bookmarks
            // Only process Unsorted? Or Selected Collection?
            // Use standard loop logic
            let page = 0;
            let hasMore = true;

            while(hasMore && !STATE.stopRequested) {
                const res = await api.getBookmarks(collectionId, page, searchQuery);
                const items = res.items;
                if (!items || items.length === 0) break;

                log(`Processing page ${page} (${items.length} items)...`);

                for (const bm of items) {
                    if (STATE.stopRequested) break;

                    try {
                        const classification = await llm.classifyBookmarkIntoExisting(bm, colNames);
                        if (classification && classification.category) {
                            const target = collections.find(c => c.title.toLowerCase() === classification.category.toLowerCase());
                            if (target) {
                                // Check if already there
                                if (bm.collection && bm.collection.$id === target._id) {
                                    log(`Skipping ${bm.title} (already in ${target.title})`);
                                } else {
                                    await api.moveBookmark(bm._id, target._id);
                                    STATE.stats.moved++;
                                    log(`Moved "${bm.title}" -> ${target.title}`, 'success');
                                }
                            } else {
                                log(`LLM suggested non-existent category "${classification.category}" for "${bm.title}"`, 'warn');
                            }
                        }
                    } catch(e) {
                         log(`Error processing ${bm.title}: ${e.message}`, 'error');
                    }
                }

                page++;
                await new Promise(r => setTimeout(r, 500));
            }
            return;
        }

        // ============================
        // MODE: Organize (Tag Frequency)
        // ============================
        if (mode === 'organize_frequency') {
            log('Creating folder structure from Tag Frequency...');

            // 1. Get Top Tags
            const allTags = await api.getAllTags();
            // Filter by min count
            const frequentTags = allTags.filter(t => t.count >= STATE.config.minTagCount).sort((a,b) => b.count - a.count);

            if (frequentTags.length === 0) {
                log('No tags meet frequency criteria.');
                return;
            }

            log(`Found ${frequentTags.length} frequent tags. Generating hierarchy...`);

            // 2. LLM Hierarchy
            const topTags = frequentTags.slice(0, 100).map(t => t._id); // Limit context
            const hierarchy = await llm.clusterTags(topTags); // Reuse clustering logic
            // Expected: { "Category": ["tag1", "tag2"] }

            if (STATE.config.reviewClusters) {
                 if(!confirm(`Proposed Structure:\n${JSON.stringify(hierarchy, null, 2)}\n\nProceed to create and move?`)) return;
            }

            // 3. Create & Move
            for (const [category, tags] of Object.entries(hierarchy)) {
                if (STATE.stopRequested) break;

                // Create Collection
                let targetId = null;
                 try {
                     // Check existing
                     if (!api.collectionCache) await api.loadCollectionCache();
                     const existing = api.collectionCache.find(c => c.title.toLowerCase() === category.toLowerCase());
                     if (existing) targetId = existing._id;
                     else {
                         const newCol = await api.createCollection(category);
                         targetId = newCol.item._id;
                     }
                 } catch(e) {
                     log(`Failed to create collection ${category}`, 'error');
                     continue;
                 }

                 // Move bookmarks for each tag
                 for (const tag of tags) {
                     if (STATE.stopRequested) break;
                     // Find bookmarks with this tag
                     // Search logic
                     let page = 0;
                     let searching = true;
                     while(searching && !STATE.stopRequested) {
                        const searchStr = encodeURIComponent(JSON.stringify([{key: 'tag', val: tag}]));
                        const res = await api.request(`/raindrops/0?search=${searchStr}&page=${page}`);

                        if (!res.items || res.items.length === 0) break;

                        await Promise.all(res.items.map(bm => {
                            // Verify tag is still present
                            if (bm.tags.includes(tag)) {
                                return api.moveBookmark(bm._id, targetId)
                                    .then(() => {
                                        STATE.stats.moved++;
                                        log(`Moved "${bm.title}" (Tag: ${tag}) -> ${category}`);
                                    });
                            }
                        }));

                        if (res.items.length < 50) searching = false;
                        // page 0 again? Raindrop removes moved items from search view usually if they moved collection?
                        // No, search is global usually unless filtered by collection.
                        // If we search global /raindrops/0, items still match search after move.
                        // So we must increment page.
                        page++;
                     }
                 }
            }
            return;
        }

        // --- Phase 1: Tagging (Standard) ---
        if (mode === 'tag_only' || mode === 'full') {
            log('Phase 1: Fetching bookmarks...');
            let page = 0;
            let hasMore = true;
            let totalItemsApprox = 0;

            // Check for saved session
            const savedState = GM_getValue('sessionState', null);
            if (savedState && savedState.mode === mode && savedState.collectionId === collectionId && savedState.searchQuery === searchQuery) {
                if (confirm(`Resume previous session from page ${savedState.page}?`)) {
                    page = savedState.page;
                    log(`Resuming from page ${page}...`);
                }
            }

            // Try to get total count first for progress bar
            try {
                 const res = await api.getBookmarks(collectionId, 0, searchQuery);
                 if(res.count) totalItemsApprox = res.count;
            } catch(e) {}

            while (hasMore && !STATE.stopRequested) {
                // Save state
                GM_setValue('sessionState', {
                    mode,
                    collectionId,
                    searchQuery,
                    page,
                    timestamp: Date.now()
                });
                try {
                    const res = await api.getBookmarks(collectionId, page, searchQuery);
                    const bookmarks = res.items;
                    if (bookmarks.length === 0) {
                        hasMore = false;
                        break;
                    }

                    log(`Processing page ${page} (${bookmarks.length} items)...`);

                    // Filter out already tagged items if config says so
                    const itemsToProcess = STATE.config.skipTagged
                        ? bookmarks.filter(bm => !bm.tags || bm.tags.length === 0)
                        : bookmarks;

                    if (itemsToProcess.length === 0) {
                        log('All items on this page skipped (already tagged).');
                        page++;
                        continue;
                    }

                    // Process batch with concurrency
                    const chunks = [];
                    for (let i = 0; i < itemsToProcess.length; i += STATE.config.concurrency) {
                        chunks.push(itemsToProcess.slice(i, i + STATE.config.concurrency));
                    }

                    for (const chunk of chunks) {
                        if (STATE.stopRequested) break;

                        await Promise.all(chunk.map(async (bm) => {
                            try {
                                log(`Scraping: ${bm.title.substring(0, 30)}...`);
                                const scraped = await scrapeUrl(bm.link);

                                let result = { tags: [], description: null };

                                if (scraped && scraped.error && STATE.config.tagBrokenLinks) {
                                    log(`Broken link detected (${scraped.error}): ${bm.title}`, 'warn');
                                    // Tag as broken
                                    const brokenTag = 'broken-link';
                                    if (!bm.tags.includes(brokenTag)) {
                                        await api.updateBookmark(bm._id, { tags: [...bm.tags, brokenTag] });
                                        STATE.stats.broken++;
                                    }
                                    return; // Skip AI tagging for broken links
                                }

                                if (scraped && scraped.text) {
                                    log(`Generating tags for: ${bm.title.substring(0, 20)}...`);
                                    result = await llm.generateTags(scraped.text, bm.tags);
                                } else {
                                    log(`Skipping content gen for ${bm.title} (scrape failed), using metadata`);
                                    result = await llm.generateTags(bm.title + "\n" + bm.excerpt, bm.tags);
                                }

                                const updateData = {};

                                if (result.tags && result.tags.length > 0) {
                                    const combinedTags = [...new Set([...(bm.tags || []), ...result.tags])];
                                    updateData.tags = combinedTags;
                                    combinedTags.forEach(t => allTags.add(t));
                                } else {
                                    log(`No tags generated for "${bm.title}"`, 'warn');
                                }

                                if (STATE.config.autoDescribe && result.description) {
                                    updateData.excerpt = result.description;
                                }

                                if (Object.keys(updateData).length > 0) {
                                    await api.updateBookmark(bm._id, updateData);
                                    STATE.stats.updated++;
                                    log(`Updated ${bm.title} (${updateData.tags ? updateData.tags.length + ' tags' : ''}${updateData.excerpt ? ', desc' : ''})`, 'success');
                                }
                            } catch (err) {
                                STATE.stats.errors++;
                                log(`Failed to process ${bm.title}: ${err.message}`, 'error');
                            }
                        }));
                    }

                    // Small pause between batches to be nice
                    await new Promise(r => setTimeout(r, 500));

                    page++;
                    processedCount += bookmarks.length;
                    STATE.stats.processed += bookmarks.length;

                    if (totalItemsApprox > 0) {
                        updateProgress((processedCount / totalItemsApprox) * 100);
                    }

                } catch (e) {
                    log(`Error fetching bookmarks: ${e.message}`, 'error');
                    break;
                }
            }
            // Clear session if finished naturally
            if (!STATE.stopRequested) {
                GM_setValue('sessionState', null);
            }
        }

        if (STATE.stopRequested) return;

        // --- Phase 3: Cleanup (Tag Consolidation) ---
        if (mode === 'cleanup_tags') {
            log('Phase 3: Tag Cleanup...');

            // 1. Fetch all tags
            log('Fetching all tags...');
            let allUserTags = [];
            try {
                allUserTags = await api.getAllTags();
            } catch(e) {
                log('Failed to fetch tags: ' + e.message, 'error');
                return;
            }

            if (allUserTags.length === 0) {
                log('No tags found to cleanup.', 'warn');
                return;
            }

            // 2. Analyze with LLM (Chunked)
            log(`Analyzing ${allUserTags.length} tags for duplicates/synonyms...`);
            // Sort case-insensitively
            const tagNames = allUserTags.map(t => t._id).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            debug(tagNames, 'All Tags (Sorted)');

            const mergePlan = {};
            const CHUNK_SIZE = 100; // Reduced from 500 to prevent errors

            for (let i = 0; i < tagNames.length; i += CHUNK_SIZE) {
                if (STATE.stopRequested) break;
                const chunk = tagNames.slice(i, i + CHUNK_SIZE);
                log(`Analyzing batch ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(tagNames.length/CHUNK_SIZE)} (${chunk.length} tags)...`);

                try {
                    const chunkResult = await llm.analyzeTagConsolidation(chunk);
                    // Filter identity mappings
                    Object.entries(chunkResult).forEach(([k, v]) => {
                        if (k.toLowerCase() !== v.toLowerCase()) {
                            mergePlan[k] = v;
                        }
                    });
                } catch(e) {
                    log(`Failed to analyze batch: ${e.message}`, 'error');
                }

                // Pause slightly
                await new Promise(r => setTimeout(r, 500));
            }

            debug(mergePlan, 'Merge Plan (Combined)');

            let changes = Object.entries(mergePlan);
            if (changes.length === 0) {
                log('No tag consolidations suggested.');
                return;
            }

            log(`Proposed merges: ${changes.length}`);

            // Review Step for Cleanup
            if (STATE.config.reviewClusters) {
                log(`Pausing for review of ${changes.length} merges...`);
                const approved = await waitForTagCleanupReview(changes);
                if (!approved) {
                    log('User cancelled merges. Stopping process.');
                    return;
                }
                changes = approved;
                log(`Approved ${changes.length} merges.`);
            }

            if (STATE.config.dryRun) {
                log('DRY RUN: No tags modified.');
                return;
            }

            // 3. Execute Merges
            let processed = 0;
            updateProgress(0);

            for (const [badTag, goodTag] of changes) {
                if (STATE.stopRequested) break;
                if (!goodTag || typeof goodTag !== 'string' || goodTag.trim() === '') {
                    log(`Skipping invalid merge pair: "${badTag}" -> "${goodTag}"`, 'warn');
                    continue;
                }

                log(`Merging "${badTag}" into "${goodTag}"...`);
                try {
                    await api.mergeTags([badTag], goodTag);
                    log(`Merged "${badTag}" -> "${goodTag}"`, 'success');
                } catch(e) {
                    log(`Failed to merge "${badTag}": ${e.message}`, 'error');
                }

                processed++;
                updateProgress((processed / changes.length) * 100);
            }
        }

        // --- Phase 2: Recursive Clustering & Organization ---
        if (mode === 'organize_only' || mode === 'full') {
            log('Phase 2: Recursive Organizing...');

            // Parse Ignored Tags
            const ignoredTagsList = STATE.config.ignoredTags
                ? STATE.config.ignoredTags.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
                : [];
            const ignoredTagsSet = new Set(ignoredTagsList);

            // Pre-fetch collections into cache to optimize hierarchical lookups
            log('Loading collection structure...');
            await api.loadCollectionCache(true);

            // Build ID->Name map for logging
            const collectionIdToName = { '-1': 'Unsorted', '0': 'All' };
            if (api.collectionCache) {
                api.collectionCache.forEach(c => {
                    collectionIdToName[c._id] = c.title;
                });
            }

            // Initialize category cache from loaded collections
            const categoryCache = {}; // name -> id
            try {
                const existingCols = await api.getCollections();
                existingCols.forEach(c => {
                    categoryCache[c.title.toLowerCase()] = c._id;
                    categoryCache[c.title] = c._id;
                });
            } catch(e) { console.warn("Could not pre-fetch collections"); }

            let iteration = 0;
            const MAX_ITERATIONS = 20; // Increased to allow full processing

            while(iteration < MAX_ITERATIONS && !STATE.stopRequested) {
                iteration++;
                log(`Starting Clustering Iteration ${iteration}...`);

                // Step A: Collect tags and counts
                let tagCounts = new Map(); // tag -> count
                let bookmarksToOrganizeMap = new Map(); // id -> bookmark (for dedup)

                // Fetch first few pages to analyze tags
                log('Scanning items for tags...');
                for(let p=0; p<4; p++) {
                    try {
                        const res = await api.getBookmarks(collectionId, p, searchQuery);
                        if (!res.items || res.items.length === 0) break;

                        res.items.forEach(bm => {
                            bookmarksToOrganizeMap.set(bm._id, bm);
                            bm.tags.forEach(t => {
                                if (!ignoredTagsSet.has(t.toLowerCase())) {
                                    tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
                                }
                            });
                        });
                    } catch(e) { break; }
                }

                const bookmarksToOrganize = Array.from(bookmarksToOrganizeMap.values());

                if (tagCounts.size === 0) {
                    log('No tags found (after filtering) in remaining items. Stopping.');
                    break;
                }

                // Sort tags by frequency
                const sortedTags = Array.from(tagCounts.entries())
                    .sort((a, b) => b[1] - a[1]) // Descending count
                    .map(entry => entry[0]);

                // Step B: Cluster top tags
                log(`Clustering top tags (out of ${sortedTags.length} unique) (Iteration ${iteration})...`);
                // Pass sorted tags so LLM sees the most important ones first
                const clusters = await llm.clusterTags(sortedTags);

                if (Object.keys(clusters).length === 0) {
                    log('No clusters suggested by LLM. Stopping.');
                    break;
                }

                log(`Clusters found: ${Object.keys(clusters).join(', ')}`);

                // Invert map (normalize keys to lowercase for matching)
                const tagToCategory = {};
                for (const [category, tags] of Object.entries(clusters)) {
                    tags.forEach(t => tagToCategory[t.toLowerCase()] = category);
                }
                debug(tagToCategory, 'Tag Mapping');

                // Step C: Prepare moves
                let itemsMovedInThisPass = 0;
                let pendingMoves = []; // { bm, category }

                for (const bm of bookmarksToOrganize) {
                     if (STATE.stopRequested) break;

                     const votes = {};
                     let maxVote = 0;
                     let bestCategory = null;

                     bm.tags.forEach(t => {
                         const cat = tagToCategory[t.toLowerCase()];
                         if (cat) {
                             votes[cat] = (votes[cat] || 0) + 1;
                             if (votes[cat] > maxVote) {
                                 maxVote = votes[cat];
                                 bestCategory = cat;
                             }
                         }
                     });

                     // Safe Mode Validation
                     if (bestCategory && STATE.config.safeMode) {
                         if (maxVote < STATE.config.minVotes) {
                             if (STATE.config.debugMode) {
                                 console.log(`[SafeMode] Skipping "${bm.title}" - Max Vote ${maxVote} < Min ${STATE.config.minVotes}`);
                             }
                             bestCategory = null;
                         }
                     }

                     if (STATE.config.debugMode) {
                         console.log(`[Clustering] Item "${bm.title}" votes:`, JSON.stringify(votes), `Winner: ${bestCategory}`);
                     }

                     if (bestCategory) {
                         pendingMoves.push({ bm, category: bestCategory });
                     }
                }

                if (pendingMoves.length === 0) {
                    log('No moves identified in this iteration.');
                    break;
                }

                // Review Step
                if (STATE.config.reviewClusters) {
                    log(`Pausing for review of ${pendingMoves.length} moves...`);
                    const approved = await waitForUserReview(pendingMoves);
                    if (!approved) {
                        log('User cancelled moves. Stopping process.');
                        break;
                    }
                    pendingMoves = approved;
                    log(`Approved ${pendingMoves.length} moves.`);
                }

                // Execution Step
                for (const move of pendingMoves) {
                     if (STATE.stopRequested) break;
                     const { bm, category: bestCategory } = move;

                     // Check/Create Collection
                     let targetColId = categoryCache[bestCategory] || categoryCache[bestCategory.toLowerCase()];

                     if (!targetColId) {
                         try {
                             if (STATE.config.nestedCollections && (bestCategory.includes('>') || bestCategory.includes('/') || bestCategory.includes('\\'))) {
                                 log(`Ensuring path: ${bestCategory}`);
                                 targetColId = await api.ensureCollectionPath(bestCategory);
                             } else {
                                 // Flat creation logic
                                 const existingCols = await api.getCollections();
                                 const found = existingCols.find(c => c.title.toLowerCase() === bestCategory.toLowerCase());
                                 if (found) {
                                     targetColId = found._id;
                                 } else {
                                     log(`Creating collection: ${bestCategory}`);
                                     const newCol = await api.createCollection(bestCategory);
                                     targetColId = newCol.item._id;
                                 }
                             }

                             if(targetColId) {
                                 categoryCache[bestCategory] = targetColId;
                                 categoryCache[bestCategory.toLowerCase()] = targetColId;
                             }
                         } catch (e) {
                             log(`Error creating collection ${bestCategory}`, 'error');
                             continue;
                         }
                     }

                     // Move
                     if (targetColId) {
                         try {
                            await api.moveBookmark(bm._id, targetColId);
                            itemsMovedInThisPass++;
                            STATE.stats.moved++;
                            const sourceName = collectionIdToName[bm.collection?.$id] || 'Unknown';
                            log(`Moved "${bm.title}" (from ${sourceName}) -> ${bestCategory}`, 'success');
                         } catch(e) {
                             log(`Failed to move ${bm.title}`, 'error');
                         }
                     }
                }

                log(`Iteration ${iteration} complete. Moved ${itemsMovedInThisPass} items.`);

                if (itemsMovedInThisPass === 0) {
                    log("No items moved in this iteration. Stopping recursion to avoid infinite loop.");
                    break;
                }
            }
        }
    }
