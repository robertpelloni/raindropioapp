import { Network } from 'vis-network/peer';
import { DataSet } from 'vis-data/peer';

export class SemanticGraph {
    constructor(containerId) {
        this.containerId = containerId;
        this.network = null;
    }

    async render(apiClient) {
        try {
            const container = document.getElementById(this.containerId);
            if (!container) return;

            container.innerHTML = 'Loading graph data...';

            // Fetch data
            const tags = await apiClient.getAllTags();

            const nodes = [{ id: 0, label: 'Library', shape: 'database', size: 30, color: '#FF9900' }];
            const edges = [];

            // Limit to top 50 tags to avoid browser freeze
            const topTags = tags.sort((a,b) => b.count - a.count).slice(0, 50);

            topTags.forEach((tag, idx) => {
                const nodeId = idx + 1;
                nodes.push({
                    id: nodeId,
                    label: `${tag._id} (${tag.count})`,
                    shape: 'dot',
                    size: Math.max(10, Math.min(30, tag.count * 2)),
                    color: '#97C2FC'
                });

                edges.push({
                    from: 0,
                    to: nodeId,
                    value: tag.count
                });
            });

            const data = {
                nodes: new DataSet(nodes),
                edges: new DataSet(edges)
            };

            const options = {
                nodes: {
                    font: { size: 12, color: '#333' },
                    borderWidth: 2
                },
                edges: {
                    width: 2,
                    color: { inherit: 'from' }
                },
                physics: {
                    stabilization: false,
                    barnesHut: {
                        gravitationalConstant: -8000,
                        springConstant: 0.04,
                        springLength: 95
                    }
                }
            };

            container.innerHTML = '';
            this.network = new Network(container, data, options);

        } catch (e) {
            console.error('Failed to render graph:', e);
            const container = document.getElementById(this.containerId);
            if(container) container.innerHTML = `<div style="color:red; padding:20px;">Failed to load graph: ${e.message}</div>`;
        }
    }
}
