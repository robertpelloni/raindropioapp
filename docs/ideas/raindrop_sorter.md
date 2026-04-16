# IDEAS: Creative & Constructive Improvements

## 1. Refactoring & Code Quality
-   **TypeScript Migration**: Port the userscript to TypeScript. The current JS codebase relies heavily on implicit typing and globals (`STATE`, `GM_*`), which is prone to runtime errors.
-   **Dependency Injection**: Instead of instantiating `LLMClient` and `RaindropAPI` inside `runMainProcess`, inject them. This would make testing significantly easier and less reliant on mock globals.
-   **State Management**: Replace the global `STATE` object with a proper state machine (e.g., XState-lite or a simple reducer pattern) to manage the complex transitions between "Running", "Paused", "Reviewing", and "Stopped".

## 2. Architecture & Design
-   **Web Component UI**: The current UI is built with raw DOM string interpolation (`innerHTML`). Refactoring this to Web Components (Shadow DOM) or Preact would isolate styles and prevent CSS conflicts with the host page.
-   **Worker Thread**: Move heavy JSON parsing and potential local LLM inference (future) to a Web Worker to prevent freezing the main UI thread during large batch operations.
-   **Plugin System**: Architect the "Modes" (Tag, Organize, Clean) as plugins. This would allow third-party developers to add new capabilities without modifying the core userscript.

## 3. New Features (The "Curator")
-   **Visual Query Builder**: A drag-and-drop interface to build complex Raindrop search queries (`#tag AND !#other`).
-   **Bulk Action Macros**: Allow users to record a sequence of actions (e.g., "Find #news -> Summarize -> Add #read-later -> Move to 'News'") and replay them.
-   **Content Graph**: Visualize the relationships between bookmarks using a force-directed graph based on semantic similarity.

## 4. Pivots & Expansions
-   **Browser Extension**: The ultimate goal. A userscript has limitations (CORS, permissions). A full extension could intercept network requests more cleanly and offer a persistent sidebar.
-   **Standalone Electron App**: "Raindrop Manager". A desktop app that connects to the API. This bypasses browser limitations entirely and allows for local vector database storage (ChromaDB) for instant semantic search.
-   **"The Librarian" Bot**: Instead of a UI tool, build a Telegram/Discord bot that you share links with, and it silently organizes them into your Raindrop account in the background.

## 5. Crazy Ideas
-   **Voice Control**: "Hey Raindrop, file this under Recipes and tag it Vegan." (Using Web Speech API).
-   **Auto-Archive**: Integrated `single-file-cli` execution via a local companion server to save full offline HTML copies of every bookmark.
-   **Social curation**: "Collaborative sorting" where multiple users can vote on tags for a shared collection.
