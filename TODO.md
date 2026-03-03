# TODO

## High Priority
- [ ] **Feature**: Smart Triggers - Automatically run specific macros when new bookmarks are added.
- [ ] **Performance**: Switch to an embedded vector DB (Transformers.js) for true semantic clustering without API costs.

## Medium Priority
- [ ] **UI**: Port to Preact/React for better state management. The `ui.js` file is becoming too large to manage via template strings.
- [ ] **Scraping**: Add a fallback to a headless browser service if standard HTTP fetch fails (e.g., for SPAs).

## Low Priority
- [ ] **I18N**: Add Japanese/Chinese translations.

## Completed Recently
- [x] French & German I18N.
- [x] Semantic Deduplication (LLM content-based matching).
- [x] Polish CSS for the "Review Panel" (diff styles).
- [x] Add more mock tests for `logic.js`.
- [x] Data Safety: Automatically export config before bulk destructive actions.
- [x] Batch Macros ("Recipes").
- [x] Diagnostics Modal.
