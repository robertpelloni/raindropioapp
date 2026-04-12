# TODO.md

## Immediate Tasks
1.  **Refine Extension UI**:
    *   The extension currently injects a UI panel directly into Raindrop's DOM (carried over from the userscript). For a more polished Web Extension experience, consider migrating the Settings, Prompts, and Dashboard views to the `popup.html` or a dedicated Side Panel.
2.  **Optimize Transformers.js Loading**:
    *   Currently, `local_embeddings.js` downloads the model on the fly. To improve reliability and performance, we should package the `all-MiniLM-L6-v2` weights directly into the extension assets or implement robust IndexedDB caching.
