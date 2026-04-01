# Project Dashboard & Directory Structure

This document provides a high-level overview of the project architecture, including active modules, external dependencies, and directory structures.

## Active Modules (The Userscript)

The primary build artifact is a Tampermonkey userscript.

*   **Location:** `scripts/src/` (Source Code) -> `scripts/raindrop_ai_sorter.user.js` (Compiled Artifact)
*   **Version:** v1.5.0
*   **Goal:** Inject an AI-powered control panel into the Raindrop.io web app to automate bookmark tagging, clustering, deduplication (via local ONNX vectors), and rule-based automation.
*   **Key Source Files:**
    *   `api.js`: Wraps Raindrop.io REST endpoints.
    *   `llm.js`: Wraps OpenAI/Anthropic/Groq/DeepSeek APIs with rate-limit handling.
    *   `logic.js`: The core execution loops (Tagging, Organizing, Cleaning).
    *   `ui.js`: Main DOM injection logic.
    *   `features/`: Modular UI plugins (e.g., `preact_stats.js`, `smart_triggers.js`, `query_builder.js`, `semantic_graph.js`, `local_embeddings.js`).

## Submodules
*Currently, there are no Git submodules installed in this project (`.gitmodules` is empty). All external dependencies are loaded dynamically via CDNs at runtime to avoid bloating the userscript.*

### External Dynamic Dependencies (Loaded via CDN)
1.  **Transformers.js (`@xenova/transformers`)**
    *   **Version:** v2.17.1 (Targeted via jsdelivr)
    *   **Usage:** Loaded by `scripts/src/features/local_embeddings.js` when "Local Vector Embeddings" is enabled. Executes the `all-MiniLM-L6-v2` ONNX model in the browser via WebAssembly for zero-cost semantic deduplication.
2.  **Vis-Network (`vis-network`)**
    *   **Version:** Standalone UMD Minified (Targeted via unpkg)
    *   **Usage:** Loaded by `scripts/src/features/semantic_graph.js`. Renders the interactive, force-directed topological map of tag co-occurrences and folder connections in the Dashboard "Graph" tab.
3.  **Preact & HTM (`htm/preact`)**
    *   **Version:** Standalone Module (Targeted via unpkg)
    *   **Usage:** Loaded by `scripts/src/features/preact_stats.js`. Used to build reactive UI components (like the stats and progress bar) without requiring a complex Webpack/Babel bundler for the userscript.

## Directory Structure

```text
/
├── .github/                # GitHub Actions and workflows
├── build/                  # Legacy build artifacts (deprecated)
├── docs/                   # Project documentation
├── functions/              # Serverless functions (if applicable)
├── scripts/                # **CORE USERSCRIPT DIRECTORY**
│   ├── src/                # Modular JavaScript source files
│   │   ├── features/       # Isolated feature modules (UI, Embeddings, Graphs)
│   │   ├── api.js          # Raindrop API wrapper
│   │   ├── llm.js          # LLM Provider abstraction
│   │   ├── logic.js        # Main execution loop
│   │   ├── state.js        # Global StateManager
│   │   ├── styles.js       # CSS injection strings
│   │   ├── ui.js           # Main UI container rendering
│   │   └── utils.js        # Scraper, Network, formatting tools
│   ├── build.js            # Node.js concatenator script (Run this to compile)
│   ├── package.json        # Development dependencies (NPM)
│   └── raindrop_ai_sorter.user.js # **THE COMPILED ARTIFACT (Deploy this)**
├── src/                    # (Unused/Legacy frontend code)
├── tests/                  # Node.js integration testing suite
│   ├── test_logic.js
│   ├── test_features.js
│   └── test_userscript_node.js
├── *.md                    # Global Documentation (ROADMAP, CHANGELOG, AGENTS, etc.)
└── VERSION                 # Global Single Source of Truth for versions (e.g., 1.5.0)
```
