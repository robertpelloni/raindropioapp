const SemanticGraphUI = {
    render() {
        return `
            <div id="ras-tab-graph" class="ras-tab-content" style="display:none; flex-direction:column; height:100%;">
                <div style="padding: 10px; background: var(--ras-header-bg); border-bottom: 1px solid var(--ras-border); display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; font-weight:bold;">Semantic Graph (Tags & Folders)</span>
                    <button id="ras-load-graph-btn" class="ras-btn" style="width:auto; padding:4px 10px; font-size:11px;">Generate Graph</button>
                </div>
                <div id="ras-graph-container" style="flex:1; position:relative; overflow:hidden; background: var(--ras-bg); min-height: 400px; border-bottom: 1px solid var(--ras-border);">
                    <div id="ras-graph-status" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:var(--ras-text-muted); font-size:12px; text-align:center;">
                        Click "Generate Graph" to map the relationships between your tags and collections.
                    </div>
                    <div id="ras-graph-canvas" style="width: 100%; height: 100%;"></div>
                </div>
            </div>
        `;
    },

    init() {
        const btn = document.getElementById('ras-load-graph-btn');
        if (btn) {
            btn.addEventListener('click', async () => {
                const status = document.getElementById('ras-graph-status');
                const canvas = document.getElementById('ras-graph-canvas');

                status.style.display = 'block';
                status.textContent = 'Loading library data...';
                canvas.innerHTML = ''; // Clear existing graph

                try {
                    await this.loadVisJs();
                    await this.buildGraph();
                    status.style.display = 'none';
                } catch (e) {
                    status.textContent = 'Error building graph: ' + e.message;
                    console.error('[SemanticGraph]', e);
                }
            });
        }
    },

    loadVisJs() {
        return new Promise((resolve, reject) => {
            if (typeof vis !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/vis-network/standalone/umd/vis-network.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load vis-network.js from unpkg'));
            document.head.appendChild(script);
        });
    },

    async buildGraph() {
        if (!STATE.config.raindropToken) {
            throw new Error("Raindrop token required.");
        }

        // We need network client
        const network = typeof NetworkClient !== 'undefined' ? new NetworkClient() : null;
        const api = new RaindropAPI(STATE.config.raindropToken, network);

        // Load collections to map IDs to Titles
        await api.loadCollectionCache(false);
        const collections = api.collectionCache || {};

        // Fetch ALL tags and their counts
        const allTags = await api.getAllTags();
        if (!allTags || allTags.length === 0) {
            throw new Error("No tags found to graph.");
        }

        // We need to fetch bookmarks to see co-occurrences of tags and collection mappings.
        // To not overwhelm the API, we fetch the first N pages (e.g., 500 items).
        let page = 0;
        let items = [];
        let hasMore = true;
        const MAX_PAGES = 5;

        document.getElementById('ras-graph-status').textContent = 'Analyzing co-occurrences...';

        while (hasMore && page < MAX_PAGES) {
            const res = await api.getBookmarks(0, page, "");
            if (!res.items || res.items.length === 0) {
                hasMore = false;
            } else {
                items = items.concat(res.items);
                page++;
            }
        }

        // --- Build Nodes and Edges ---

        const nodesData = [];
        const edgesData = [];
        const nodeMap = new Map(); // id -> node
        const edgeMap = new Map(); // "idA-idB" -> weight

        let nodeIdCounter = 1;

        // 1. Add Collection Nodes (Root level)
        Object.keys(collections).forEach(id => {
            const cId = `col_${id}`;
            nodeMap.set(cId, {
                id: cId,
                label: collections[id].title,
                group: 'collection',
                value: 20 // Base size
            });
        });

        // 'Unsorted' Collection
        nodeMap.set('col_-1', { id: 'col_-1', label: 'Unsorted', group: 'collection', value: 15 });

        // 2. Map Tags to Collections & Co-occurrences
        const tagCounts = {};

        items.forEach(bm => {
            const colId = `col_${bm.collectionId}`;
            const bmtags = bm.tags || [];

            bmtags.forEach(tag => {
                const tagId = `tag_${tag.toLowerCase()}`;

                // Track Tag count for size
                tagCounts[tagId] = (tagCounts[tagId] || 0) + 1;

                // Add tag node if not exists
                if (!nodeMap.has(tagId)) {
                    nodeMap.set(tagId, {
                        id: tagId,
                        label: tag,
                        group: 'tag'
                    });
                }

                // Link Tag -> Collection
                const edgeKey1 = `${tagId}-${colId}`;
                edgeMap.set(edgeKey1, (edgeMap.get(edgeKey1) || 0) + 1);

                // Link Tag -> Tag (Co-occurrence in same bookmark)
                bmtags.forEach(otherTag => {
                    const otherTagId = `tag_${otherTag.toLowerCase()}`;
                    if (tagId !== otherTagId) {
                        // Sort IDs to prevent directionality (A->B == B->A)
                        const sorted = [tagId, otherTagId].sort();
                        const edgeKey2 = `${sorted[0]}-${sorted[1]}`;
                        edgeMap.set(edgeKey2, (edgeMap.get(edgeKey2) || 0) + 1);
                    }
                });
            });
        });

        // Update Tag node sizes
        nodeMap.forEach((node, id) => {
            if (node.group === 'tag') {
                node.value = (tagCounts[id] || 1) * 3;
            }
            nodesData.push(node);
        });

        // Filter edges to remove noise (weight < 2)
        edgeMap.forEach((weight, key) => {
            if (weight > 1) { // Min threshold for visibility
                const [from, to] = key.split('-');
                edgesData.push({
                    from: from,
                    to: to,
                    value: weight,
                    title: `Strength: ${weight}` // Tooltip
                });
            }
        });

        const container = document.getElementById('ras-graph-canvas');
        const data = {
            nodes: new vis.DataSet(nodesData),
            edges: new vis.DataSet(edgesData)
        };

        const options = {
            nodes: {
                shape: 'dot',
                scaling: { min: 10, max: 40 },
                font: { size: 12, face: 'Tahoma', color: STATE.config.darkMode ? '#fff' : '#333' }
            },
            edges: {
                color: { inherit: 'both', opacity: 0.5 },
                smooth: { type: 'continuous' }
            },
            groups: {
                collection: { color: { background: '#007aff', border: '#0056b3' } },
                tag: { color: { background: '#28a745', border: '#1e7e34' } }
            },
            physics: {
                forceAtlas2Based: { gravitationalConstant: -50, centralGravity: 0.01, springLength: 100, springConstant: 0.08 },
                maxVelocity: 50,
                solver: 'forceAtlas2Based',
                timestep: 0.35,
                stabilization: { iterations: 150 }
            },
            interaction: {
                tooltipDelay: 200,
                hideEdgesOnDrag: true
            }
        };

        new vis.Network(container, data, options);
    }
};

if (typeof window !== 'undefined') {
    window.SemanticGraphUI = SemanticGraphUI;
}
