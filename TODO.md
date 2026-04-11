# TODO.md

## Immediate Tasks
1.  **Migrate Core Logic**:
    *   Port `api.js`, `state.js`, `ui.js`, and `logic.js` from the `scripts/` directory to `extension/src/content/` adjusting for ES module syntax and the new `NetworkClient` adapter.
2.  **Web Extension UI**:
    *   Currently, the userscript injects a DOM overlay. For the Web Extension, consider if we keep the injected DOM overlay or move some logic to the Popup or a Side Panel API.
3.  **Semantic Deduplication**:
    *   The `LocalEmbeddingEngine` (Transformers.js) is scaffolded. We need to integrate it into the 'Deduplicate' mode logic to compute cosine similarity between bookmark content.
