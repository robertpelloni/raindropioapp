# Handoff Log & Session History

This file documents the iterative progress made by AI agents (Claude, GPT, Gemini) throughout the Raindrop AI Sorter project. **Always read this file before beginning a new session to understand the current architecture, completed features, and the immediate next steps.**

## Current State of the Project
The project is currently a **Tampermonkey Userscript** (`scripts/raindrop_ai_sorter.user.js`). All planned features for the userscript phase (Phase 1-4) have been successfully and robustly implemented.

### Architecture & Tech Stack
1.  **Build System:** We use a simple Node.js concatenator script (`scripts/build.js`) instead of Webpack/Vite. This means we cannot use `import`/`require` syntax for NPM packages natively.
2.  **UI:** The majority of the UI is constructed using Vanilla JS and safe DOM creation methods (`document.createElement`). However, a successful Proof of Concept for a Preact migration was completed by dynamically loading `htm` and `preact` from `unpkg` via CDN (`scripts/src/features/preact_stats.js`).
3.  **Local AI:** We use `@xenova/transformers` (loaded via jsdelivr) in `local_embeddings.js` to execute ONNX models (`all-MiniLM-L6-v2`) via WebAssembly in the browser for zero-cost semantic deduplication.
4.  **Graphing:** The Semantic Graph visualization (`semantic_graph.js`) uses `vis-network` (loaded via unpkg).
5.  **State Management:** The `StateManager` (`state.js`) handles all `GM_getValue` calls, including saving user presets, macros, and configuration flags.

## Recent Accomplishments (Mega-Session)
*   **Conflict Resolution:** Eradicated all `<<<<<<< HEAD` merge conflicts left behind by previous branching/sync issues across `CHANGELOG.md`, `ui.js`, `logic.js`, and documentation.
*   **Bobcoin Removal:** Completely stripped all references to a deprecated "Bobcoin" vision and deleted its associated markdown file.
*   **Feature Implementation (Phase 3 & 4):**
    *   **I18N Expansion:** Added complete Japanese (`ja`) and Simplified Chinese (`zh`) interface translations.
    *   **SPA Scraping Fallback:** Integrated `https://r.jina.ai` as a proxy fallback for single-page applications that return insufficient text during standard DOM parsing.
    *   **Smart Triggers:** Built a background loop (`smart_triggers.js`) that automatically evaluates user-defined Batch Macros on bookmarks hitting the 'Unsorted' collection.
    *   **Cost Budget Alerts:** Implemented a session API cost limit that warns the user and pauses execution if breached (`utils.js`).
    *   **Cluster Review v2:** Replaced the flat checkbox list with an HTML5 Drag-and-Drop Kanban board for manually overriding AI folder assignments.
    *   **Semantic Graph:** Built an interactive topological map of tags and folders.
    *   **Local Vector Embeddings:** Integrated Transformers.js for offline deduplication via cosine similarity.
    *   **Preact UI Port:** Migrated the Dashboard's Stats & Progress panel to a reactive Preact/HTM component.
*   **Documentation Overhaul:** Restructured `LLM_INSTRUCTIONS.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `GPT.md`, and `copilot-instructions.md` to reference a single universal source of truth. Generated `DASHBOARD.md`, `VISION.md`, `DEPLOY.md`, `IDEAS.md`, and updated `MEMORY.md`.
*   **Versioning:** Bumped the central `VERSION` file to `1.5.0` and logged all changes in `CHANGELOG.md`.

## Immediate Next Steps for the Next Agent
The userscript is functionally complete. The immediate next phase (**Phase 5: The Sentinel**) is a massive architectural pivot. The goal is to migrate the entire project from a Tampermonkey userscript into a standalone, TypeScript-powered Chrome/Firefox Web Extension (Manifest V3).

1.  **Review Phase 5 in `ROADMAP.md` and `TODO.md`.**
2.  **Scaffold the Extension:** Create a new directory (e.g., `src/target/extension`) and generate a `manifest.json`.
3.  **Migrate `NetworkClient`:** The `GM_xmlhttpRequest` calls must be rewritten to use the native `fetch` API, as Greasemonkey APIs will not be available in the Web Extension. You must configure CORS permissions correctly in the manifest to allow the extension to scrape URLs and ping LLM endpoints.
4.  **Set up a Bundler:** Introduce Vite or Webpack. This will allow the project to natively import `preact` and `@xenova/transformers` via NPM instead of relying on fragile unpkg CDNs, and it will support compiling JSX and TypeScript.
