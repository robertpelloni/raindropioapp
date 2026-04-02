# Handoff Log & Session History

This file documents the iterative progress made by AI agents (Claude, GPT, Gemini) throughout the Raindrop AI Sorter project. **Always read this file before beginning a new session to understand the current architecture, completed features, and the immediate next steps.**

## Current State of the Project
The project has successfully completed the "Userscript Era" (v1.6.0). All legacy features (Macros, Smart Triggers, Local Embeddings, Semantic Graph, Query Builder, Structural Templates, I18N, and Safe Modes) are 100% functional, stable, and tested in `scripts/raindrop_ai_sorter.user.js`.

We are now actively executing **Phase 5: The Sentinel**, which migints the entire architecture to a standalone Chrome/Firefox Manifest V3 Web Extension.

### Phase 5 Architecture Scaffold
- **Location:** `extension/` directory.
- **Build System:** Vite (`vite.config.js`). Run `cd extension && npm run build` to compile the `dist/` folder.
- **Manifest:** `manifest.json` requests `storage`, `alarms`, `scripting`, and necessary host permissions for CORS bypasses.
- **Components:**
  - `src/background/background.js`: Service worker. Handles alarm scheduling (Smart Triggers) and cross-origin `fetch` requests piped from the content script.
  - `src/content/content.js`: The content script injected into `app.raindrop.io`. It will eventually house the main Dashboard UI previously located in `scripts/src/ui.js`.
  - `src/content/network.js`: A rewritten `NetworkClient` class that uses `chrome.runtime.sendMessage` to bypass CORS, replacing the old `GM_xmlhttpRequest`.
  - `src/popup/popup.js`: A basic Preact component for the extension's browser action popup.

## Recent Accomplishments (Phase 5 Initiation)
*   **Scaffold Manifest V3:** Created the foundational `manifest.json` and directory structure for the new web extension.
*   **Vite Bundler:** Abandoned the primitive string-concatenator `scripts/build.js` in favor of a modern Vite/Preact build pipeline to compile the background worker, content script, and popup UI.
*   **Migrate Network Abstraction:** Successfully rewrote the core `NetworkClient` to handle cross-origin message passing instead of relying on Greasemonkey APIs.
*   **Documentation:** Bumped version to `2.0.0-alpha`, updated `CHANGELOG.md`, `ROADMAP.md`, and marked the high-priority `TODO.md` Phase 5 scaffolding tasks as complete.

## Immediate Next Steps for the Next Agent
You are picking up the project directly in the middle of the Phase 5 Web Extension migration. Your immediate goals are to migrate the existing userscript logic into the new Vite extension build.

1.  **Migrate the State Manager:** Port `scripts/src/state.js` into `extension/src/content/state.js`. You MUST replace all instances of `GM_getValue` and `GM_setValue` with `chrome.storage.local.get` and `chrome.storage.local.set`. Keep in mind that the Chrome storage API is asynchronous (returns a Promise or uses a callback), whereas `GM_getValue` was synchronous. This will require refactoring the initialization logic.
2.  **Port the UI Framework:** Begin migrating `scripts/src/ui.js` and `scripts/src/features/*` into the content script. We want to eventually refactor the messy template strings into Preact/JSX components, but the first step is simply getting the vanilla UI rendering correctly from within the Web Extension's isolated world.
3.  **Test the Network Wrapper:** Ensure that the newly written `extension/src/content/network.js` properly interacts with the `background.js` message listener to execute a real LLM API call or Raindrop API fetch.
