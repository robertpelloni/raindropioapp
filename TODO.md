# TODO.md

## Immediate Tasks
1.  **Browser Cache Fallback Strategy**:
    *   If IndexedDB ever fails or is cleared, `transformers.js` has to re-download the 20MB model. For the true final version, we should explore hard-bundling `model_quantized.onnx` into `extension/public/models/` to provide a guaranteed instant load on install, regardless of user network.
