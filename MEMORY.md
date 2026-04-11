# MEMORY.md: Ongoing Observations

*   **Modular Architecture**: The move to `scripts/src/` has greatly improved maintainability. `ui.js` manages rendering, `logic.js` handles the core processing loop, `llm.js` manages API calls, and `utils.js` has helpers.
*   **The Archivist**: WayBack Machine integration (`checkWaybackMachine`) is present in `utils.js` and used in `logic.js` when `tagBrokenLinks` is enabled.
*   **Design Preferences**: The UI is a floating panel, draggable/minimizable. Tabbed interface is preferred to avoid overwhelming the user.
*   **Data Safety**: We MUST export the user's config to JSON before destructive modes like `flatten` or `delete_all_tags`. This needs to be implemented or double-checked.
*   **Web Extension Migration**: The ultimate goal (Phase 5) is moving to an `extension/` directory with Vite+Preact. For now, we are stabilizing the userscript in `scripts/`.
