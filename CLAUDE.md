# Claude's Guide to Raindrop AI Sorter

This repository contains the Raindrop.io monorepo, but this guide focuses on the **AI Sorter Userscript** located in `scripts/raindrop_ai_sorter.user.js`.

## 🛠 Project Overview
*   **Core Component**: A Tampermonkey/Greasemonkey userscript for organizing bookmarks.
*   **Stack**: Vanilla JavaScript (ES6+), `GM_xmlhttpRequest` for cross-origin calls.
*   **Key APIs**: Raindrop.io REST API, OpenAI/Anthropic/Ollama APIs.

## 📂 Source Structure
The userscript is developed as modules in `scripts/src/` and compiled into a single file.

```
scripts/
├── src/
│   ├── header.js      # Metadata block & IIFE start
│   ├── state.js       # Global STATE definition
│   ├── utils.js       # Logging, UI helpers
│   ├── network.js     # NetworkClient wrapper
│   ├── api.js         # RaindropAPI class
│   ├── llm.js         # LLMClient class
│   ├── ui.js          # UI construction
│   ├── logic.js       # Core algorithms (runMainProcess)
│   └── index.js       # Initialization & IIFE end
├── build.js           # Build script (Node.js)
└── raindrop_ai_sorter.user.js  # Compiled artifact
```

## 🏗 Development Workflow

1.  **Edit**: Modify files in `scripts/src/`.
2.  **Build**: Run `node scripts/build.js` to regenerate `raindrop_ai_sorter.user.js`.
3.  **Test**: Run `node tests/test_userscript_node.js` to verify logic and syntax.

**Note**: Do NOT edit `raindrop_ai_sorter.user.js` directly anymore. It will be overwritten by the build process.

## 📝 Coding Guidelines

### JavaScript / Userscript
*   **Template Literals**: Do **NOT** escape backticks or `${}` inside template literals unless absolutely necessary for the string content itself.
    *   ❌ Bad: `\`Result: \${value}\`` -> causes `SyntaxError: invalid escape sequence`.
    *   ✅ Good: `` `Result: ${value}` ``
*   **Async/Await**: Use `async/await` for all network and IO operations.
*   **Error Handling**:
    *   **Never swallow errors** silently in helper classes (`LLMClient`, `RaindropAPI`). Propagate them or log them explicitly to the UI.
    *   Use `try/catch` blocks inside loops (like batch processing) to prevent a single item failure from halting the entire process.
*   **Sanitization**: Always sanitize data sent to APIs.
    *   Tags: Remove empty strings, duplicates, and nulls.
    *   JSON: Use `repairJSON` heuristics for LLM outputs.

### User Interface
*   **Native DOM**: Use standard DOM APIs (`document.createElement`, etc.) or simple template strings. No React/Vue/frameworks inside the userscript.
*   **Styles**: Inject CSS via `GM_addStyle`.
*   **Feedback**: Always provide visual feedback (Log panel, Progress bar, Status icons).

## 📦 Versioning & Release Workflow

**Every build/submission involving code changes must update the version number.**

1.  **Update Version Header**:
    *   Edit `scripts/src/header.js`.
    *   Increment the `// @version x.y.z` line.
    *   Follow Semantic Versioning (Major.Minor.Patch).
2.  **Update Changelog**:
    *   Add a new entry to `CHANGELOG.md` describing the changes.
    *   Format: `## [Version] - Date` followed by bullet points.

## ⚠️ Critical Constraints (Memory)
*   **Rate Limits**: Raindrop API creates 429s aggressively. Respect `Retry-After`.
*   **Tag Hygiene**: The API returns 400 Bad Request if you send tags like `["", null]`. Filter these out!
*   **LLM Truncation**: Large tag lists (>200 items) often result in cut-off JSON from LLMs. Use the `repairJSON` utility.
*   **Backslash Escaping**: Be extremely careful when generating code that writes code. Python/Agent layers often double-escape. Verify the output.

## 🧪 Testing
*   **Manual**: Load the script in Tampermonkey and run against a Test Collection (using a Test Token).
*   **Dry Run**: Always verify logic changes using the script's built-in "Dry Run" mode first.
*   **Unit Tests**: Use `node tests/test_userscript_node.js` to verify core classes in isolation.
