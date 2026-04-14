# Raindrop AI Sorter (The Sentinel) - Architecture & Knowledge Base

## Core Vision & Identity
The **Raindrop AI Sorter** has successfully evolved from a manual "list management" Tampermonkey userscript into an autonomous "Personal Knowledge Management" (PKM) Web Extension (Manifest V3). The ultimate goal is a "Set and Forget" AI Librarian that recursively categorizes, auto-tags, summarizes, and deduplicates a user's bookmark library. 

## Architectural Evolution (Phase 1-4 vs. Phase 5+)
### Legacy Architecture (Userscript)
*   **Structure**: Monolithic script built by concatenating modular files in `scripts/src/` via a custom `scripts/build.js` Node script.
*   **Execution**: Injected a floating HTML/CSS overlay (`#ras-container`) directly into the `app.raindrop.io` DOM.
*   **Storage**: Synchronous local storage via `GM_getValue` and `GM_setValue`.
*   **Network**: Bypassed CORS restrictions using the privileged `GM_xmlhttpRequest` API.

### Modern Architecture (Web Extension)
*   **Structure**: A Vite + Preact bundled Manifest V3 Extension located in the `extension/` directory.
*   **Execution**: Content scripts (`src/content/index.js`) still inject the UI overlay for seamless integration, but the core logic is now strictly ES Modules.
*   **Storage**: Migrated to the asynchronous `chrome.storage.local` API. The `StateManager` class handles this via an `async init()` sequence before the UI renders.
*   **Network (CORS Bypass)**: Content scripts cannot use `GM_xmlhttpRequest`. Instead, a `NetworkClient` adapter serializes `fetch()` payloads and passes them via `chrome.runtime.sendMessage` to the Background Service Worker (`src/background/index.js`), which executes the native fetch without CORS restrictions and passes the data back. This adapter completely powers internal utilities like `scrapeUrl` and `checkWaybackMachine`.

## Key Feature Modules & Implementation Patterns
The project utilizes a decoupled architecture where `ui.js` handles DOM binding, `api.js` handles Raindrop communication, `llm.js` handles AI providers, and `logic.js` acts as the main processing loop. Feature-specific logic is isolated in `src/content/features/`.

1.  **The Librarian (Smart Triggers)**: 
    *   **Pattern**: Uses `chrome.alarms` in the background service worker to wake up at user-defined intervals (e.g., every 15 minutes).
    *   **Logic**: Polls the Raindrop "Unsorted" collection (ID `-1`), evaluates bookmarks against user-defined recipes, and issues `PUT` requests to sort them. 
    *   **Background LLM Fallback**: If no deterministic rules match, it optionally scrapes the URL in the background (`bgScrapeUrl`) and queries the LLM (OpenAI/Anthropic) to autonomously categorize it. Alerts the user via `chrome.notifications`.
2.  **Smart Rules Engine (`rules.js`)**:
    *   **Pattern**: When the user manually approves an AI-suggested tag merge or folder move in the UI's Review Panel, the engine stores this mapping.
    *   **Logic**: These rules are evaluated *before* making an LLM call in future runs, saving tokens and enforcing user preferences autonomously. Wired directly to the UI for CRUD operations.
3.  **Batch Macros / Recipes (`macros_ui.js`)**:
    *   **Pattern**: A deterministic, zero-token IF/THEN ruleset. 
    *   **Logic**: Users can define conditions (`domain_equals`, `has_tag`, `title_contains`) mapped to actions (`add_tag`, `move_to_folder`). These execute instantly via "Apply Macros" or silently by the background worker. Wired to UI.
4.  **Semantic Deduplication (`local_embeddings.js`)**:
    *   **Pattern**: Moves beyond exact URL string matching to true content-based similarity.
    *   **Logic**: Dynamically imports `@xenova/transformers` (using `all-MiniLM-L6-v2`) in the content script to generate a high-dimensional float array (embedding) from the bookmark title/excerpt. Computes Cosine Similarity and flags duplicates hitting a >95% threshold.
5.  **Semantic Graph (`semantic_graph.js`)**:
    *   **Pattern**: Visualizes the user's implicit knowledge structures.
    *   **Logic**: Dynamically injects `vis-network.js` via a CDN script tag to render an interactive, physics-based 2D canvas of tags weighted by frequency.
6.  **The Architect (Templates)**:
    *   **Pattern**: Bootstraps organizational structure.
    *   **Logic**: Creates hardcoded, nested folder hierarchies (P.A.R.A, Dewey Decimal, Academic) via rapid sequential API `POST` requests.
7.  **Newsletter / Summary Mode**:
    *   **Pattern**: RAG-lite document synthesis.
    *   **Logic**: Iterates a collection, scrapes text via `utils.js` Readability-lite, concatenates snippets, and prompts the LLM to generate a Markdown digest, rendered in a custom modal.
8.  **The Archivist**:
    *   **Pattern**: Dead-link prevention.
    *   **Logic**: If scraping returns a 404, it queries the Wayback Machine API. If a snapshot exists, it tags the bookmark `has-archive` and appends the URL.

## Best Practices & Directives for Future Agents
*   **Documentation is Paramount**: Before *and* after coding, always update `ROADMAP.md`, `TODO.md`, `CHANGELOG.md`, `HANDOFF.md`, and the `VERSION` file. 
*   **Commit Often**: The overarching instruction is "Don't ever stop the party." Implement, verify, commit with a descriptive message referencing the version bump, and immediately proceed to the next roadmap item.
*   **UI Representation**: Do not write "ghost code." Every feature implemented in the backend (Rules, Macros, etc.) *must* be fully wired to the frontend UI with descriptive labels and tooltips (`createTooltipIcon`).
*   **Data Safety**: Always trigger a configuration backup download before executing destructive batch modes (Flatten, Delete All Tags). 
*   **Testing Limitations**: The legacy `tests/test_logic.js` environment currently uses `eval()` against the concatenated userscript payload. For the new Web Extension in `extension/`, rely on `npm run build` with Vite to catch syntax/module resolution errors, and configure Rollup's `onwarn` to safely ignore expected `eval` warnings from WASM libraries like ONNX.