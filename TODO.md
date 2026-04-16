# TODO.md

## Immediate Tasks
1.  **Refine Extension UI**:
    *   Now that the UI is fully Preact, we can explore moving the settings to the actual `popup.html` extension popup or side panel, leaving only the "Dashboard" overlay injected into the Raindrop DOM.
2.  **Optimize Transformers.js Loading**:
    *   Currently, `local_embeddings.js` downloads the model on the fly. To improve reliability and performance, we should package the `all-MiniLM-L6-v2` weights directly into the extension assets or implement robust IndexedDB caching.
