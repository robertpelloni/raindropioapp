# TODO.md

## Immediate Tasks
1.  **Semantic Graph Optimization**:
    *   Currently the semantic graph relies on `vis-network.js` via a CDN inside the content script. We should bundle this locally using Vite or implement a lighter-weight D3 visualizer to remove the external CDN dependency for security and performance.
2.  **Model Packaging**:
    *   While `transformers.js` now caches to IndexedDB perfectly, the very first run requires a ~20MB download from HuggingFace. If we want offline-first, we should eventually download `all-MiniLM-L6-v2` and bundle it directly into the `extension/public/` directory.
