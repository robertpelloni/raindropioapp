# TODO

This document tracks immediate, fine-grained technical debt and tactical implementation tasks that support the broader goals outlined in the `ROADMAP.md`.

## Phase 5: The Sentinel (Web Extension Migration)

### High Priority
- [ ] **Scaffold Manifest V3**: Create a `src/target/extension` directory. Write a robust `manifest.json` that requests `storage`, `alarms`, and `declarativeNetRequest` permissions instead of relying on `GM_xmlhttpRequest`.
- [ ] **Migrate `NetworkClient`**: Rewrite the network abstraction layer (`network.js`) to use the native `fetch` API. Configure CORS headers within the extension manifest so we can still ping LLM APIs and scrape websites without issues.
- [ ] **Vite Bundler**: Replace the primitive string-concatenation `build.js` with a proper Vite build pipeline. This will allow us to use JSX syntax and import NPM packages natively.

### Medium Priority
- [ ] **UI Componentization**: Port the remaining vanilla JS template strings in `settings_ui.js`, `query_builder.js`, and `macros_ui.js` over to the new Preact/HTM architecture established by `preact_stats.js`.
- [ ] **IndexedDB Setup**: Integrate `dexie` or `localForage`. Update `local_embeddings.js` so that instead of just generating vectors on the fly for deduplication, it actively caches the `all-MiniLM-L6-v2` embeddings for *every* bookmark as they are processed.
- [ ] **Chrome Alarms**: Extract the logic inside `smart_triggers.js` (which currently uses `setInterval`) into a background service worker that wakes up periodically.

### Low Priority
- [ ] **TypeScript Types**: Begin defining interfaces (e.g., `interface Bookmark`, `interface RaindropCollection`) in a new `types/` directory to prepare for the full TypeScript migration.
- [ ] **Local RAG UI**: Add a search bar to the extension popup that queries the local IndexedDB vector store using cosine similarity.

## Completed (Legacy Phase 2/3/4)
- [x] **UI**: Port to Preact/React for better state management (`preact_stats.js`).
- [x] **Performance**: Switch to an embedded vector DB (`Transformers.js`) for true semantic clustering without API costs.
- [x] **Cost**: Token usage budgets/alerts.
- [x] **Feature**: Smart Triggers - Automatically run specific macros when new bookmarks are added.
- [x] **Scraping**: Add a fallback to a headless browser service if standard HTTP fetch fails (SPA fallback via Jina API).
- [x] **I18N**: Add Japanese/Chinese translations.
