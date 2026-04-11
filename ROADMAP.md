# ROADMAP.md: Raindrop AI Sorter

## Phase 1: Foundation (Complete)
- [x] Basic LLM integration (OpenAI, Anthropic).
- [x] Auto-tagging based on content scraping.
- [x] Bulk operations (Flatten, Prune, Delete Tags).
- [x] Recursive clustering logic.
- [x] Userscript UI with Settings/Dashboard.

## Phase 2: Refinement & Architecture (Current)
- [x] Modular Refactor (split into src/).
- [x] Multimodal Vision support.
- [x] I18N and Localization.
- [x] Centralized Versioning (VERSION file).
- [x] Semantic sorting into existing folder structures.
- [x] Implement "Newsletter / Summary" mode.
- [x] Implement "Deduplicate Links" mode.
- [x] Implement "The Architect" (Templates) & UI tab.
- [x] Implement "Smart Rules Engine" & UI tab logic.
- [x] Implement "Batch Macros (Recipes)" & UI tab logic.
- [x] Implement "The Curator" (Visual Query Builder).

## Phase 3: The "Librarian" & Web Extension (Future)
- [x] **Phase 5 Migration**: Migrate Userscript to Web Extension (Manifest V3) in `extension/` directory (Scaffolding complete).
- [x] **Semantic Graph**: Interactive D3/Vis.js visualization of tags and collections.
- [x] **Smart Triggers**: Background polling of the "Unsorted" collection to auto-apply rules.
- [x] **Local Embeddings**: Use Transformers.js for offline semantic deduplication and categorization.
