# Vision: The Autonomous AI Librarian

## Goal
To create the ultimate, self-driving organization tool for Raindrop.io that transforms a chaotic heap of links into a meticulously curated library of knowledge, completely autonomously.

## Core Philosophy
1.  **Autonomous**: The user should click "Start" and walk away. The system handles pagination, rate limits, errors, and decision-making.
2.  **Privacy-First**: Support for local LLMs (Ollama) ensures data privacy for sensitive bookmarks.
3.  **Robust**: It must handle thousands of bookmarks without crashing, losing data, or getting stuck in loops.
4.  **Transparent**: Every action is logged. Every decision can be reviewed. "Safe Mode" prevents catastrophic mistakes.
5.  **Multimodal**: It sees what you see. It reads the page text and looks at the cover image to understand context.

## Planned Features & Roadmap

### Phase 1: Foundation (Complete)
-   [x] Basic LLM integration (OpenAI, Anthropic).
-   [x] Auto-tagging based on content scraping.
-   [x] Bulk operations (Flatten, Prune, Delete Tags).
-   [x] Recursive clustering logic.
-   [x] Userscript UI with Settings/Dashboard.

### Phase 2: Refinement (Current)
-   [x] Multimodal Vision support.
-   [x] I18N and Localization.
-   [x] Centralized Versioning.
-   [x] semantic sorting into existing folder structures.
-   [ ] **Optimization**: Improve scraping speed and quality.
-   [ ] **Feedback Loop**: Learn from user corrections in Review Mode (future).

### Phase 3: The "Librarian" (Future)
-   **Background Worker**: Runs silently in the background (as a Web Extension).
-   **Context Awareness**: "This looks like a receipt, move to Finance" vs "This looks like a tutorial, move to Dev".
-   **Broken Link Archival**: Automatically save copies of broken pages to Internet Archive.
-   **Newsletter Generation**: Summarize new bookmarks weekly.

## Directory Structure
-   `scripts/`: The core Userscript codebase.
-   `scripts/src/`: Modular source files (UI, Logic, API).
-   `tests/`: Node.js test harness.
-   `submodules/`: (Currently empty, reserved for future dependencies).
