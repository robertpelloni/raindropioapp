# TODO.md

## Immediate Tasks
1.  **Optimize Web Extension Assets**:
    *   ONNX Runtime warns about `eval()`. Configure Vite to handle WebAssembly files properly if needed for the `transformers.js` library to pass Chrome Web Store review.
2.  **Phase 6 (Continued)**:
    *   Currently "The Librarian" (background worker) only executes `batch_macros` and `smart_rules`. We need to expand this so it can optionally call the LLM in the background for bookmarks that do not match any rules.
