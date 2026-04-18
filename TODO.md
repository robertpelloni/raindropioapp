# TODO.md

## Immediate Tasks
1.  **Browser Cache Fallback Strategy**:
    *   If IndexedDB ever fails or is cleared, `transformers.js` has to re-download the 20MB model. For the true final version, we should explore hard-bundling `model_quantized.onnx` into `extension/public/models/` to provide a guaranteed instant load on install, regardless of user network.
2.  **Semantic Graph Optimization**:
    *   Currently the semantic graph relies on `vis-network.js` via a CDN inside the content script. We should bundle this locally using Vite or implement a lighter-weight D3 visualizer to remove the external CDN dependency for security and performance.
