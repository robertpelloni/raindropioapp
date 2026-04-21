# Roadmap

## 🌟 Long Term Vision
**"The Autonomous Librarian"**: A set-and-forget system that maintains a perfectly organized knowledge base.

## 🚀 Upcoming Features (Prioritized)

### Phase 5: The Sentinel (Robustness & Extension)
The userscript architecture is complete. To achieve the ultimate vision, the project must migrate to a more powerful, native browser extension format.
- [ ] **Web Extension Migration**: Port the Tampermonkey Userscript into a standalone Chrome/Firefox Extension (Manifest V3).
- [ ] **Background Workers**: Utilize `chrome.alarms` to run Smart Triggers and Deduplication silently in the background without needing the Raindrop tab open.
- [ ] **TypeScript Rewrite**: Refactor the core logic loop (`api.js`, `logic.js`, `llm.js`) to TypeScript for strict type safety.
- [ ] **Preact SPA**: Replace the remaining Vanilla JS template strings in `ui.js` and `settings_ui.js` with a fully bundled Preact/Vite Single Page Application.
- [ ] **Local RAG Search**: Expand `local_embeddings.js` to create a full client-side vector database (IndexedDB) for instant semantic search across all bookmarks.

## ✅ Completed

### Phase 4: Data Safety & UI Polish
- [x] **v1.5.0**: UI Port (Preact): Began UI migration using HTM (Hyperscript Tagged Markup) and Preact for reactive stats.
- [x] **v1.4.0**: Deduplication v3 (Local Embeddings): Zero-cost, privacy-first semantic duplicate detection using Transformers.js directly in the browser.
- [x] **v1.3.0**: Semantic Graph: Interactive 2D mapping of tags, their co-occurrences, and collections using `vis-network`.
- [x] **v1.2.0**: Cluster Review v2: HTML5 Drag-and-Drop interface for overriding AI folder classifications during review.
- [x] **v1.1.3**: Smart Triggers (Auto-run macros on Unsorted items), SPA Scraping Fallback (Jina API integration), I18N (Japanese/Chinese).
- [x] **v1.1.2**: French/German I18N, Semantic Deduplication (LLM-based).
- [x] **v1.1.1**: Data Safety Auto-export, Review CSS Polish.

### Phase 3: Structural Intelligence
- [x] **v1.1.0**: Batch Macros ("Recipes"), AI Diagnostics Modal.
- [x] **v1.0.9**: Universal Docs, StateManager, Dark Mode, URL Deduplication.
- [x] **v1.0.8**: The Architect (Templates), The Curator (Query Builder).
- [x] **v1.0.7**: Toast Notifications, Rules Tab, Smart Repair.

### Phase 2 & 1: Core Functionality
- [x] **v1.0.6**: Newsletter Generation.
- [x] **v1.0.5**: The Archivist (Wayback Machine).
- [x] **v1.0.0**: Core Logic (Tag, Organize, Clean, Flatten, Prune).

## 🚧 Phase 5 (In Progress)
- [x] **v2.0.0-alpha**: Scaffolded the Manifest V3 Web Extension. Built the Vite bundler pipeline (`vite.config.js`). Created the foundational `background.js` Service Worker and rewrote `NetworkClient` to handle cross-origin message passing instead of `GM_xmlhttpRequest`.
# ROADMAP.md: Raindrop AI Sorter

## Phase 1: Foundation (Complete)
- [x] Basic LLM integration (OpenAI, Anthropic).
- [x] Auto-tagging based on content scraping.
- [x] Bulk operations (Flatten, Prune, Delete Tags).
- [x] Recursive clustering logic.
- [x] Userscript UI with Settings/Dashboard.

## Phase 2: Refinement & Architecture (Current)
- [x] Modular Refactor (split into src/).
- [x] Multimodal Vision support.
- [x] I18N and Localization.
- [x] Centralized Versioning (VERSION file).
- [x] Semantic sorting into existing folder structures.
- [x] Implement "Newsletter / Summary" mode.
- [x] Implement "Deduplicate Links" mode.
- [x] Implement "The Architect" (Templates) & UI tab.
- [x] Implement "Smart Rules Engine" & UI tab logic.
- [x] Implement "Batch Macros (Recipes)" & UI tab logic.
- [x] Implement "The Curator" (Visual Query Builder).

## Phase 3: The "Librarian" & Web Extension (Future)
- [x] **Phase 5 Migration**: Migrate Userscript to Web Extension (Manifest V3) in `extension/` directory (Scaffolding complete).
- [x] **Semantic Graph**: Interactive D3/Vis.js visualization of tags and collections.
- [x] **Componentized UI**: Rewrite the injected overlay into modern React/Preact components for easier maintenance.
- [x] **Smart Triggers**: Background polling of the "Unsorted" collection to auto-apply rules.
- [x] **Local Embeddings**: Use Transformers.js for offline semantic deduplication and categorization.
