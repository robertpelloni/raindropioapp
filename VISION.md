# 🔮 Ultimate Vision: The Autonomous Librarian

## Overview
The Raindrop AI Sorter project is an advanced, client-side intelligence layer designed to seamlessly integrate with the Raindrop.io bookmarking platform. It transforms a static, manually curated list of web links into a self-organizing, self-healing, semantic knowledge base.

The ultimate goal of this project is to create a true "set and forget" system—The Autonomous Librarian—that perfectly understands a user's intent, organizes their data with zero friction, and surfaces relevant knowledge before they even search for it.

## Core Pillars of the Vision

### 1. Absolute Automation (Zero Friction)
Users should not have to spend hours sorting their bookmarks into folders or tagging them with synonyms.
- **Auto-Tagging:** Every incoming link is instantly analyzed (both textually and visually via multimodal LLMs) to extract precise, hierarchical tags (e.g., `Finance > Receipt > Software`).
- **Smart Triggers & Macros:** The system runs in the background, identifying new bookmarks in the 'Unsorted' queue, running user-defined IF/THEN recipes, and applying the AI sorting logic automatically.

### 2. Structural Intelligence (Deep Understanding)
The system goes beyond simple keyword matching. It understands the *meaning* of the content.
- **Semantic Classification:** The AI places bookmarks into existing folder structures by understanding the core topic of the article, not just matching words.
- **Local Vector Embeddings:** By running ONNX models (e.g., `Transformers.js`) directly in the browser, the system extracts high-dimensional vectors to find duplicate content (even across different URLs) and map relationships without incurring API costs or sending data to third parties.
- **Semantic Graphing:** The user can visually explore their knowledge base via interactive topological graphs, revealing hidden connections between seemingly disparate topics based on tag co-occurrences.

### 3. Data Safety & Privacy
The system acts as a steward of the user's data.
- **Dry Runs & Safe Mode:** Destructive actions are simulated first, or require high-confidence "votes" before proceeding.
- **Reviewable Actions:** Granular, drag-and-drop Kanban boards allow users to manually override AI decisions before they are committed to the server.
- **The Archivist:** The system automatically checks the Wayback Machine for broken links, ensuring knowledge is never lost to link rot.
- **Auto-Backups:** Complete configuration and rule states are exported automatically before dangerous operations (like flattening the library).

### 4. Extreme Polish & Modularity
The codebase must reflect the ambition of the product.
- **Modular Architecture:** The vanilla Tampermonkey userscript is split into highly focused feature modules (`preact_stats.js`, `query_builder.js`, `semantic_graph.js`) combined by a build script.
- **Modern UI:** The UI is transitioning to a reactive Preact/HTM architecture for state management, while retaining full I18N localization (English, Spanish, French, German, Japanese, Chinese) and dense, helpful tooltips for every single toggle.

## The Future: Phase 5 & Beyond
The ultimate endgame for The Autonomous Librarian is to break free from the constraints of a Tampermonkey userscript.
- **The Web Extension:** Migrating the core logic into a dedicated Chrome/Firefox Web Extension, allowing for true background processing (`chrome.alarms`), secure credential storage (`chrome.storage`), and a native popup UI.
- **Local-First RAG (Retrieval-Augmented Generation):** Expanding the local vector embeddings to power a chat interface where the user can ask questions like "What did I save last week about React performance?" and the system retrieves the answers entirely client-side.
- **TypeScript:** A full rewrite to enforce strict type safety across the massive, asynchronous logic loops.
