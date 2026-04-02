# CHANGELOG

## [1.1.2] - 2024-05-26
### Added
- **Semantic Deduplication:** Upgraded Deduplicate mode. If enabled, the LLM will analyze the title and excerpt of bookmarks under the same domain to identify content duplicates even if their URLs vary.
- **I18N:** Added French and German localizations for the UI.
- **Data Safety:** The script now automatically generates a full configuration backup (including your macros, rules, and prompts) and downloads it to your machine before performing destructive bulk operations like 'Flatten Library' or 'Delete All Tags'.
- **UI Polish:** Completely revamped the Review Modal CSS to clearly show what is being deleted (strikethrough) and what is being kept (bold green).
- **Tests:** Expanded integration test coverage to secure Deduplication and Macros features against future regressions.

## [1.1.0] - 2024-05-25
### Added
- **Batch Macros ("Recipes"):** Added a new 'Macros' tab and 'Apply Macros' mode. Users can now define standard IF/THEN automation rules (e.g., IF Domain is github.com THEN Add Tag #dev) to process bookmarks entirely locally, bypassing AI costs.
- **AI Diagnostics:** Added a "View Raw AI Logs" button (🔍) to the Dashboard. When Debug Mode is enabled, users can view the exact JSON prompts sent to the LLM and the raw text returned, greatly aiding in prompt engineering.

## [1.0.9] - 2024-05-25
### Added
- **Dark Mode:** Added a toggle in Settings. The UI now fully supports custom CSS variables for dark themes.
- **URL Deduplication:** Added a new mode to automatically find and remove exact URL duplicates across the library.
- **Abort Controller:** `scrapeUrl` is now bound to the Stop button. Network requests are cancelled immediately when sorting is stopped.
### Changed
- **Architecture:** Refactored the global `STATE` object into a dynamic `StateManager` class, fixing initialization scope issues.
- **Robustness:** Restored `fetchWithRetry` for LLM calls to gracefully handle HTTP 429 Rate Limits using exponential backoff.
- **Documentation:** Consolidated all agent and developer instructions into a universal `LLM_INSTRUCTIONS.md` framework. Added `DEPLOY.md` and `MEMORY.md`.

## [1.0.8] - 2024-05-24
### Added
- **"The Architect" (Structural Templates):** New feature to organize bookmarks based on predefined or custom structural schemas.
  - Added "Templates" tab in the UI.
  - Built-in templates: PARA, Dewey Decimal, Johnny.Decimal, Simple.
  - Ability to create, save, and delete custom structural templates.
  - Integrated into "Organize (Semantic)" mode: if a template is selected, the LLM classifies bookmarks into the template's structure instead of existing folders.
- **"The Curator" (Visual Query Builder):** (Previously added in v1.0.7 dev) Visual interface for constructing complex Raindrop search queries (AND/OR/NOT logic for tags, domains, titles).
- **Refined Prompts:** Updated default prompts for better structural adherence.
- **Code Organization:** Modularized UI components (`templates_ui_injector.js`, `query_builder.js`) and updated build pipeline.

### Changed
- **UI:** Updated main panel with new tabs and improved layout.
- **Logic:** `organize_semantic` mode now prioritizes selected templates over existing folder structure if active.
- **Documentation:** Updated `LLM_INSTRUCTIONS.md`, `ROADMAP.md`, `VISION.md` to reflect new architecture.

## [1.0.7] - 2024-05-23
- Initial implementation of Visual Query Builder.
- Modularization of UI code.

## [1.0.6] - 2024-05-22
- Added token usage tracking and cost estimation.
- Improved "Prune Tags" mode with batch operations.
- Added "Newsletter" summary mode.

## [1.0.5] - 2024-05-21
- Added "Safe Mode" voting mechanism for clustering.
- Added "Search Filter" mode.
- Added "Review Clusters" UI for manual approval.

## [1.0.0] - 2024-05-20
- Initial Release.

## [1.1.3] - 2024-03-04
### Added
- **Smart Triggers:** A new background automation feature. Users can now enable "Smart Triggers" in settings. Every few minutes, the script will silently check the "Unsorted" collection (-1) and run any saved Batch Macros ("Recipes") against new bookmarks, automatically tagging and sorting them without manual intervention.
- **SPA Scraping Fallback:** Added a fallback layer for fetching URL content. If the standard browser HTTP fetch returns less than 500 characters of text (often the case with Single Page Applications built on React/Vue), the userscript now routes the URL through the `r.jina.ai` markdown scraping proxy to retrieve the fully hydrated page content, significantly improving AI tagging accuracy.
- **I18N Expansion:** Added complete Japanese (`ja`) and Simplified Chinese (`zh`) interface translations, accessible via the Settings tab.

### Changed
- Added descriptive tooltips to the Smart Triggers toggle to better inform users of its functionality.
- Reduced the standard scraping HTTP timeout slightly to speed up batch processing, allowing the Jina fallback to trigger faster for unresponsive/heavy sites.

## [1.3.0] - 2024-03-04
### Added
- **Semantic Graph Visualization:** Added a dedicated 'Graph' tab to visually map your Raindrop.io knowledge base. Uses an embedded force-directed interactive node graph (`vis-network`) to reveal connections between tags (co-occurrences) and their assigned collections. This helps visualize your structural intelligence and identify orphaned clusters.

## [1.4.0] - 2024-03-04
### Added
- **Deduplication v3 (Local Vector DB):** Integrated `@xenova/transformers` to run the `all-MiniLM-L6-v2` AI model directly in your browser. When running "Semantic Deduplication", you can now check the "Local Vector Embeddings" setting. This allows the script to compute cosine similarities to find duplicate content without making *any* external LLM API calls, completely eliminating token costs for large libraries and enhancing privacy.

## [1.5.0] - 2024-03-04
### Added
- **UI Modernization (Preact/HTM):** Addressed the roadmap backlog item to begin porting the UI to Preact. We successfully injected a dynamic, build-less Preact component module (`preact_stats.js`) using HTM (Hyperscript Tagged Markup) to manage the real-time reactivity of the Dashboard stats, tokens, cost, and progress bar without destroying the stability of the existing Tampermonkey UI architecture.

## [1.6.0] - 2024-03-04
### Changed
- **Global Documentation Overhaul:** Executed a massive analysis and restructuring of all project documentation to prepare for the Phase 5 Web Extension migration. Consolidated agent instructions into a single `LLM_INSTRUCTIONS.md`. Created a comprehensive `DASHBOARD.md` mapping the directory structure and dynamic CDN dependencies. Updated `VISION.md`, `DEPLOY.md`, `MEMORY.md`, and completely rewrote the `HANDOFF.md` history. All backlog tasks for the Tampermonkey Userscript architecture are now officially complete.

## [2.0.0-alpha] - 2024-03-04
### Added
- **Phase 5 Scaffold (Web Extension Migration):** Began the massive architectural shift from a single-file Tampermonkey Userscript to a standalone Chrome/Firefox Manifest V3 Web Extension.
- Created the `extension/` directory with a new `manifest.json` requesting `storage`, `alarms`, and `declarativeNetRequest` permissions.
- Implemented a robust Vite build pipeline (`vite.config.js`) to compile `background.js`, `content.js`, and `popup.js`.
- Rewrote the foundational `NetworkClient` to bypass Content Script CORS restrictions by piping HTTP `fetch` requests through the Background Service Worker via Chrome's message passing API.

## [2.1.0-alpha] - 2024-03-04
### Changed
- **Web Extension State Management:** Migrated the monolithic, synchronous `StateManager` (which relied on `GM_getValue`) into a standalone, asynchronous ES module (`extension/src/content/state.js`) using `chrome.storage.local`.
- **API & LLM Refactoring:** Ported the `RaindropAPI` and `LLMClient` wrappers into the new Web Extension architecture as strict ES modules, hooking them up to the new cross-origin `NetworkClient`.
