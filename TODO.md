# TODO.md

## Immediate Tasks
1.  **Semantic Search Integration (Phase 2)**:
    *   The core Semantic Search is currently implemented as an Action Mode that filters and dumps results into the action log. To polish this, we should build a dedicated UI overlay or inject the results directly into Raindrop's own list view so the user can interact with them natively.
2.  **Semantic Graph Optimization**:
    *   Currently the semantic graph relies on `vis-network.js` via a CDN inside the content script. We should bundle this locally using Vite or implement a lighter-weight D3 visualizer to remove the external CDN dependency for security and performance.
