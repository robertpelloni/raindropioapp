# TODO.md

## Immediate Tasks
1.  **Semantic Search Integration**:
    *   Since we have local embeddings processing correctly to calculate similarity (>95%) for duplicates, we should consider exposing a "Semantic Search" bar to the user so they can query their library with natural language concepts rather than just keyword tags.
2.  **Semantic Graph Optimization**:
    *   Currently the semantic graph relies on `vis-network.js` via a CDN inside the content script. We should bundle this locally using Vite or implement a lighter-weight D3 visualizer to remove the external CDN dependency for security and performance.
