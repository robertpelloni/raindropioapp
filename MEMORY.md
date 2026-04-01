# Agent Memory & Observations

## Codebase Architecture
- The application logic operates as a client-side Tampermonkey userscript.
- The build pipeline uses a simplistic Node.js script (`scripts/build.js`) to concatenate the `scripts/src/` directory into a single `raindrop_ai_sorter.user.js` file.
- There are no formal bundlers like Webpack, Rollup, or Vite. To implement reactive UI components, the architecture relies on dynamically loading Preact and HTM (Hyperscript Tagged Markup) via CDN (`https://unpkg.com/htm/preact/standalone.module.js`) instead of using JSX and Babel. See `scripts/src/features/preact_stats.js` for this implementation.

## Design Preferences
- **Safety First:** The user is highly concerned about accidental data destruction. All bulk actions (like `flatten` or `delete_all_tags`) must include double-confirmation prompts and automatically export a JSON backup of the user's `STATE.config`.
- **Transparency:** The user demands extensive debug logging (e.g., `debugMode` printing raw LLM prompts) and a UI that explicitly explains what is happening (e.g., the `aiDiagnosticsLog` modal).
- **Tooltips & I18N:** Every single feature flag, checkbox, and dropdown must have a human-readable label and a comprehensive tooltip (using the `createTooltipIcon()` helper) across all six supported languages (en, es, de, fr, ja, zh).
- **Cost Management:** LLM API tokens add up. The UI tracks estimated cost and enforces a user-defined `costBudget`. The codebase prefers local processing (e.g., `LocalEmbeddings` using `Transformers.js`) over external API calls whenever possible.

## Known Complexities
- **The DOM:** The userscript injects a massive control panel over the Raindrop.io UI. To avoid XSS vulnerabilities when displaying bookmark titles, the system uses safe DOM creation methods (`document.createElement`) instead of string interpolation for dynamic lists (e.g., the Cluster Review v2 Kanban board).
- **Rate Limits:** The `RaindropAPI` and `LLMClient` handle `429 Too Many Requests` using an exponential backoff wrapper (`fetchWithRetry`).
- **Asynchronicity:** Deeply nested async loops (fetching pages of bookmarks, extracting local embeddings, prompting the LLM, updating the API) require strict adherence to the `STATE.abortController.signal` to allow the user to cleanly cancel a run in progress.
