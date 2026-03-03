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
