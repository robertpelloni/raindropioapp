See `LLM_INSTRUCTIONS.md` for the global, universal instructions that govern this project.

## GitHub Copilot-Specific Directives
- Provide concise, highly relevant autocomplete suggestions for vanilla JavaScript and Preact/HTM components.
- Respect the existing project style, specifically the requirement to use `I18N.get('key')` for all user-facing strings.
- Automatically suggest `try/catch` blocks around all `NetworkClient` or `LLMClient` API calls.
# GitHub Copilot Instructions

When assisting with the Raindrop AI Sorter project, adhere to the following guidelines:

1.  **Architecture:** We are a Manifest V3 Web Extension. Avoid monolithic scripts; favor modular ES modules in the `extension/src/` directory.
2.  **UI Framework:** Use Preact with `htm` (no Babel). Keep components functional and lightweight.
3.  **State Management:** Always use `STATE.config` backed by `chrome.storage.local`. Do not use synchronous `localStorage` or `GM_getValue`.
4.  **Network Requests:** Never make direct `fetch` calls from the content script to bypass CORS. Always use the `NetworkClient` adapter to route requests through the background service worker.
5.  **Documentation:** Comment your code thoroughly. Explain the "why" behind complex logic. Keep `CHANGELOG.md` and `VERSION` updated.
6.  **Persona:** Align with "The Librarian" persona when generating system prompts—hierarchical, context-aware, and meticulous.
