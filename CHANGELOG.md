# CHANGELOG

All notable changes to the Raindrop AI Sorter userscript will be documented in this file.

## [1.0.27] - 2024-04-18
### Fixed
- Restored `HelpTab` and `DashboardTab` in the Content Script UI after they were inadvertently removed during the extraction of the Options page.
### Changed
- Ported `QueryBuilder` to a native Preact component (`QueryBuilderUI`) inside the Content Script Dashboard.
- Refactored `RulesTab` and `MacrosTab` inside the Options page to function purely as native Preact components utilizing `chrome.storage.local`, removing legacy synchronous global DOM bindings.

## [1.0.26] - 2024-04-18
### Added
- Implemented Dashboard Status Indicator in the UI header. Shows a green dot when background polling (Smart Triggers) is active, and a red dot when offline.
- Added a `chrome.storage.onChanged` listener to `ui.js` to dynamically update the UI (including the status indicator) when configuration changes in the Options page.
### Fixed
- Updated hardcoded version string in `ui.js` header to properly reflect the current extension version.

## [1.0.25] - Current
### Changed
- **Semantic Search UI**: Enhanced the local Semantic Search mode. Instead of merely printing results to the text log, the extension now renders a sleek, interactive Preact modal directly within the Raindrop UI, displaying the top 25 semantic matches, their cosine similarity scores, domains, tags, and clickable links for immediate navigation.

## [1.0.24] - Previous
### Added
- **Semantic Search Mode**: Added a new mode to the Dashboard. By entering a natural language query into the Search Filter box, the extension will generate an embedding (using the local NLP model) and compare it against your library using cosine similarity, surfacing relevant bookmarks even if they don't share exact keywords.

## [1.0.23] - Previous
### Changed
- **Semantic Graph Localization**: The Semantic Graph visualization now explicitly bundles `vis-network/peer` and `vis-data/peer` directly into the extension via Vite, rather than dynamically injecting a `<script>` tag that reaches out to `unpkg.com`. This drastically improves security (by abiding strictly by Manifest V3 Content Security Policies) and ensures the graph works completely offline.

## [1.0.22] - Previous
### Changed
- **Background Worker Resilience**: Enhanced the `chrome.runtime.sendMessage` fetch relay in the background worker with intrinsic, exponential backoff retry logic. It will now automatically handle `429 Rate Limit` errors and network timeouts natively before passing the final response back to the content script's `NetworkClient` adapter.

## [1.0.21] - Previous
### Added
- **Extension Popup**: Upgraded the generic `popup.html` into a fully functional Preact component. Users can now click the extension icon in their browser toolbar to view the live status of their Smart Triggers (The Sentinel), check the LLM fallback configuration, and quickly launch the Options page or Raindrop.io.

## [1.0.20] - Previous
### Changed
- **Local Embeddings Optimization**: Configured `@xenova/transformers` (`local_embeddings.js`) to explicitly cache downloaded NLP models (like `all-MiniLM-L6-v2`) into the browser's IndexedDB. This prevents redundant, slow, multi-megabyte network downloads on subsequent semantic deduplication runs, drastically improving speed.

## [1.0.19] - Previous
### Changed
- **UI Decoupling Complete**: Successfully migrated the configuration interfaces (`SettingsTab`, `PromptsTab`, `RulesTab`, `MacrosTab`, `TemplatesTab`, `GraphTab`) completely out of the injected content script and into the dedicated Web Extension Options Page (`options.html`).
- **Dashboard Optimization**: The `app.raindrop.io` overlay is now extremely lightweight, containing only the "Dashboard" runner, the Visual Query Builder, and a shortcut button that uses `chrome.runtime.openOptionsPage()` to launch the deeper settings. This dramatically improves the aesthetics and payload size of the content script.

## [1.0.18] - Previous
### Changed
- **UI Decoupling**: Successfully migrated the massive configuration interfaces (`SettingsTab`, `PromptsTab`, `RulesTab`, `MacrosTab`, `TemplatesTab`, `GraphTab`) completely out of the injected content script and into a dedicated Web Extension Options Page (`options.html`).
- **Dashboard Optimization**: The `app.raindrop.io` overlay is now extremely lightweight, containing only the "Dashboard" runner, the active search query builder, and a convenient shortcut button that uses `chrome.runtime.openOptionsPage()` to launch the deeper settings. This dramatically improves the aesthetics and performance of the content script injection.

## [1.0.17] - Previous
### Changed
- **Background Worker**: Renamed `extension/src/background/index.js` to `extension/src/background.js` and updated the manifest to strictly align with project structure conventions for background service workers. Verified that `chrome.alarms` polling functions flawlessly in the new location.

## [1.0.16] - Previous
### Added
- **Options Page Scaffolding**: Added a dedicated Web Extension Options page (`options.html`) scaffolded with Preact. This prepares the groundwork to migrate configuration panels (Settings, Prompts, Rules, Macros) out of the injected DOM overlay for a cleaner browsing experience.
### Verified
- **Smart Triggers Background Polling**: Confirmed that the background service worker correctly implements `chrome.alarms` for scheduled autonomous execution, permanently replacing the legacy `setInterval` approach.

## [1.0.15] - Previous
### Changed
- **Componentized UI**: Completed the migration of the injected DOM overlay to a modern Preact architecture. All tabs (Settings, Prompts, Rules, Macros, Templates, Graph) are now rendered as functional, state-driven JSX components.
- **Interoperability**: Ensured all Preact-rendered form elements retain their legacy HTML `id` attributes so that the core `logic.js` engine can still blindly query the DOM without breaking changes.

## [1.0.14] - Previous
### Changed
- **UI Architecture**: Kicked off the migration of the monolithic `ui.js` into a modern, component-driven architecture utilizing Preact and HTM. The main container and Dashboard tab are now functionally rendered via JSX-style components natively bundled by Vite.

## [1.0.13] - Previous
### Changed
- **Network Relays**: Refactored internal content script network utilities (`scrapeUrl`, `checkWaybackMachine`) to use the newly implemented `NetworkClient` service worker relay instead of relying on legacy `GM_xmlhttpRequest` structures.

## [1.0.12] - Previous
### Added
- **The Librarian (Background LLM)**: The background polling service can now optionally fallback to calling an LLM (OpenAI/Anthropic) to auto-tag bookmarks if no deterministic Rules or Macros match. This provides true zero-click autonomous curation.
- **Background Scraper**: Implemented a lightweight HTML scraper within the background worker to provide page context to the LLM without needing to open the page in a tab.
### Fixed
- **Vite Build Warnings**: Added Rollup `onwarn` configurations to suppress expected `eval()` warnings generated by `onnxruntime-web` when bundling `transformers.js` for the Web Extension.

## [1.0.11] - Previous
### Added
- **Smart Triggers (The Librarian)**: Implemented autonomous background polling via `chrome.alarms`. The extension will now silently check the "Unsorted" collection at a user-defined interval and automatically apply saved Rules and Batch Macros.
- **Notifications**: Added `chrome.notifications` to alert the user when the background worker autonomously sorts bookmarks.
- **UI Updates**: Added "Enable Auto-Sorting" and interval controls to the Settings tab to manage Smart Triggers.

## [1.0.10] - Previous
### Added
- **Phase 5 Migration**: Fully ported the core Userscript modules (`api.js`, `state.js`, `logic.js`, `ui.js`, `llm.js`, etc) to ES Modules within the `extension/` directory.
- **State Management**: Refactored the `StateManager` to use the asynchronous `chrome.storage.local` API, seamlessly replacing the legacy `GM_getValue` and `GM_setValue`.
- **Semantic Deduplication**: Wired the `LocalEmbeddingEngine` (`@xenova/transformers`) into the deduplicate loop to detect content similarity (cosine similarity > 95%) rather than relying solely on exact URLs.
### Changed
- The build pipeline for the web extension now successfully bundles the content scripts using Vite, removing all Userscript-specific logic from the new structure.

## [1.0.9] - Previous
### Added
- **Phase 5 Migration**: Scaffolded the Manifest V3 Web Extension environment in the `extension/` directory using Vite and Preact.
- **CORS Bypass**: Implemented a Background Service Worker and a Content Script `NetworkClient` adapter to relay API requests natively, solving Userscript limitation issues.
- **Local Embeddings**: Implemented `LocalEmbeddingEngine` utilizing `@xenova/transformers` (all-MiniLM-L6-v2) for future offline semantic deduplication and categorization.

## [1.0.8] - Previous
### Added
- **UI Data Binding**: Rules and Macros are now fully functional in the UI, capable of saving, displaying, and deleting dynamic data generated by the backend engines.
- **Semantic Graph Visualization**: Added integration for `vis-network.js` to render an interactive map of tags based on frequency within the user's library.

## [1.0.7] - Previous
### Added
- **Smart Rules Engine**: Implemented logic to automatically save user-approved tag merges and folder moves during the review phase, storing them persistently to skip future manual reviews.
- **Batch Macros (Recipes)**: Implemented the execution engine to evaluate user-defined IF/THEN rules (e.g., if domain equals X, add tag Y) and integrated it into a new "Apply Macros" execution mode.
- **The Curator**: Implemented the underlying logic for the Visual Query Builder to construct complex Raindrop search strings (AND/OR/NOT).
### Fixed
- **Build Pipeline**: Fixed an issue where the userscript build process failed to include the new modular feature files, removing incompatible CommonJS exports.

## [1.0.6] - Previous
### Added
- **Feature Stubs**: Added foundational boilerplate files for Smart Rules Engine (`rules.js`), Batch Macros (`macros_ui.js`), and The Curator (`query_builder.js`).
- **Safety**: Added automatic export configuration before destructive actions like Flatten and Delete All Tags.

## [1.0.5] - Previous
### Added
- **Newsletter / Summary Mode**: Added functionality to iterate over a collection, scrape content, and use the LLM to generate a markdown newsletter summary.
- **Deduplicate Links Mode**: Added a new mode to find and remove exact URL duplicates across the library. Semantic deduplication placeholder added.
- **The Architect**: Implemented template generation (PARA, Dewey Decimal, Academic) allowing one-click folder structure creation.
- **UI Architecture**: Added missing tabs for 'Rules', 'Macros', 'Templates', and 'Graph' per the project roadmap.
- **Safety**: Automated configuration export (backup) before executing destructive operations like 'Flatten Library' or 'Delete All Tags'.

## [1.0.4] - Previous
### Added
- **Archival**: "The Archivist" feature now automatically checks the Internet Archive (Wayback Machine) for broken links.
    - If a snapshot is found, adds `has-archive` tag and appends the archive link to the bookmark description.
    - If not found, adds `broken-link` tag.
- **Scraping**: "Readability-lite v2" engine.
    - Improved text extraction scoring to prioritize content over navigation.
    - Support for JSON-LD metadata extraction.
    - Increased text limits for larger context.
- **Prompts**: Refined default prompts ("The Librarian" persona) for smarter, hierarchical tagging and context-aware classification.

### Infrastructure
- **Versioning**: Bumped to v1.0.4.

## [1.0.3] - Previous
### Infrastructure
- **Versioning**: Implemented centralized versioning. A single `VERSION` file now controls the version number in the build artifact and the UI header.
- **Documentation**: Unified documentation strategy with `LLM_INSTRUCTIONS.md`, `VISION.md`, and updated agent-specific files.
- **Project Structure**: Updated `DASHBOARD.md` to reflect the current modular architecture.

## [1.0.2] - Previous
### Added
- **UI**: Added tooltips to every field for better documentation.
- **UI**: Added comprehensive I18N support for all labels and tooltips.
- **UI**: Added specific Model fields for OpenAI, Anthropic, Groq, and DeepSeek.
- **UI**: Added "Classification Prompt" editor to the Prompts tab.
- **Documentation**: Rewrote `scripts/README.md` to be a comprehensive manual.

### Fixed
- **Cleanup**: Removed deprecated references to "Bobcoin".
- **Merge Conflicts**: Resolved conflicts in `state.js`, `ui.js`, `i18n.js`, and documentation files.
- **Tests**: Fixed conflicts in test files.

## [1.0.1] - Previous
### Fixed
- **UI**: Added missing checkboxes for "Allow Nested Folders" and "Tag Broken Links".
- **Persistence**: Fixed settings not saving for `skipTagged`, `dryRun`, `autoDescribe`, `debugMode`, `nestedCollections`, and `tagBrokenLinks`.
- **Documentation**: Updated `AGENTS.md` to reflect completed features.

## [1.0.0] - Previous
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
