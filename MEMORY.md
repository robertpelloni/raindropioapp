# Memory & Observations

## Codebase Preferences
- **UI Architecture**: Modularized. `scripts/src/ui.js` acts as the main orchestrator, injecting HTML structures and binding events. Specific complex UI components (like Settings, Templates) have their logic in `scripts/src/features/*.js`.
- **State Management**: Historically used a global `STATE` object (`scripts/src/state.js`). Moving towards a more encapsulated `StateManager` approach to avoid global namespace pollution and improve testability.
- **Styling**: Global CSS is managed via a single injected string (`RAS_STYLES` in `scripts/src/styles.js`) to ensure it applies correctly within the Raindrop SPA without conflict.
- **Localization**: Strict adherence to using `I18N.get('key')` for all user-facing strings.
- **Network**: All API calls route through `NetworkClient` (which wraps `GM_xmlhttpRequest`) to allow for `AbortController` support and future Web Extension migration.
- **Error Handling**: LLM operations and Scraping must gracefully handle errors (timeouts, 404s, malformed JSON) and log them to the custom UI logger and console, without halting the entire batch process.

## Ongoing Technical Debt / Notes
- The `scrapeUrl` function is critical but can be slow on heavy pages. It currently uses a custom "Readability-lite" algorithm. Further optimization or timeouts might be needed.
- Duplication of class definitions must be strictly avoided due to the concatenation build process. Define classes in one file and attach to `window` if needed across modules.
