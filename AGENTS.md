# Agent Instructions & Memory

## 📚 Universal Instructions
See **[LLM_INSTRUCTIONS.md](LLM_INSTRUCTIONS.md)** for core directives.

## 🧠 Project Context
**Goal**: Build a robust, feature-rich userscript to automate Raindrop.io bookmark organization.
**Current State**: v1.0.0 (Release Candidate. Complete with Vision, Semantic Sorting, i18n).
**Location**: Source in `scripts/src/`, Artifact in `scripts/raindrop_ai_sorter.user.js`.

## 🚀 Future Roadmap
*   **UI Framework**: Refactor the injected UI to use a lightweight framework (Preact) for better maintainability.
*   **Web Extension**: Port the userscript to a full Raindrop.io browser extension.
*   **Advanced Scraping**: Improve content extraction for complex SPAs.

## ✅ Completed Features
*   **Recursive Classification**: Semantic folder creation based on content (v0.8.0).
*   **Vision Support**: Tag bookmarks using screenshot analysis (v0.9.0).
*   **Localization**: Multi-language support (v0.7.9).
