# TODO

## High Priority
- [ ] **Feature**: Batch Macros ("Recipes") - Allow users to define IF/THEN rules for automatic processing without LLMs.
- [ ] **Diagnostics**: Add a "Debug Log" UI modal to view raw LLM prompts and responses to help users tune their presets.

## Medium Priority
- [ ] **Test**: Add more mock tests for `logic.js` (specifically coverage for Macros and Deduplication).
- [ ] **Data Safety**: Automatically export configuration to a local file before performing bulk destructive actions (like "Flatten" or "Delete All Tags").

## Low Priority
- [ ] **Style**: Polish CSS for the "Review Panel" to make diffs clearer.
- [ ] **I18N**: Add German/French translations.

## Completed Recently
- [x] Visual Query Builder (UI).
- [x] Structural Templates (PARA, etc).
- [x] Move global `STATE` to a `StateManager` class.
- [x] Universal Docs Framework (`LLM_INSTRUCTIONS.md`).
- [x] Add "Dark Mode" toggle.
- [x] Optimize `scrapeUrl` with `AbortSignal` and 10s timeout.
- [x] Exact URL Deduplication Mode.
