# TODO.md

## Immediate Tasks
1.  **Migrate Settings to Options Page**:
    *   The `options.html` page and `OptionsApp` component have been scaffolded. We need to extract `SettingsTab`, `PromptsTab`, `RulesTab`, and `MacrosTab` from `extension/src/content/ui.js` into the Options page to clean up the browsing experience.
2.  **Optimize Transformers.js Loading**:
    *   Currently, `local_embeddings.js` downloads the model on the fly. To improve reliability and performance, we should package the `all-MiniLM-L6-v2` weights directly into the extension assets or implement robust IndexedDB caching.
