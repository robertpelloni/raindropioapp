# 🧠 Brainstorming & Ideas

This document tracks radical improvements, architectural pivots, and moonshot features for the Raindrop AI Sorter project.

## 1. The Sentinel (Web Extension Migration)
**Concept:** Move away from Tampermonkey userscripts to a fully-fledged Chrome/Firefox Web Extension.
**Why:**
- Background processing: A Web Extension can use `chrome.alarms` to run a nightly cleanup worker (e.g. at 3 AM, prune tags, auto-tag new bookmarks, deduplicate).
- Better UI: We can use a popup menu or a dedicated options page instead of injecting a fixed DIV over the Raindrop UI.
- Secure API Key Storage: Using `chrome.storage.local` is more robust.
**Action Plan:**
- Port `NetworkClient` to use native `fetch` with Web Extension CORS configurations.
- Scaffold a React/Vite popup UI.

## 2. "The Cartographer" (Local Vector DB & Semantic Search)
**Concept:** Instead of relying entirely on Raindrop's lexical search or calling an LLM every time we organize, build a local semantic index.
**How:**
- Embed `Transformers.js` (or similar WebAssembly ONNX runtimes) into the extension.
- When a bookmark is fetched, generate an embedding for its `excerpt` + `title`.
- Store embeddings in IndexedDB.
- **Use Cases:**
  - *Instant Duplicates:* Find content duplicates with 99% accuracy locally, without token costs.
  - *Semantic Search:* "Find me that article about AI sorting algorithms" matches bookmarks even if those exact words aren't used.
  - *Smart Folders:* Instead of static folder names, folders are defined by a prompt ("Things related to finance"), and new bookmarks are auto-routed based on cosine similarity to the folder's concept vector.

## 3. "The Archivist v2" (Full Page Snapshotting)
**Concept:** Currently, we check Wayback Machine for broken links. We should *actively* archive pages.
**How:**
- Use SingleFile (or similar library) to generate a complete HTML snapshot of the page upon bookmarking.
- Save the snapshot directly into a cloud storage provider (Google Drive/Dropbox) or as an attachment in Raindrop (if API supports file uploads).

## 4. UI Modernization (React/Preact)
**Concept:** The `ui.js` file is becoming a massive template literal string. It's time to componentize.
**How:**
- Introduce a build step (Vite/Rollup) that compiles JSX into the final userscript.
- Allows for complex state management (Context/Redux) instead of manually querying the DOM for input values.

## 5. Context-Aware "Agentic" Sorting
**Concept:** Right now, the LLM is given a static list of tags or folders. It should act more like an agent.
**How:**
- Give the LLM access to the `search` and `getCollections` tools directly (via function calling/tool use).
- **Prompt:** "Organize this bookmark."
- **LLM Action:**
  1. Calls `search("similar topic")` to see where the user usually puts these.
  2. Calls `getCollections()` to view structure.
  3. Creates a new subfolder if necessary, then moves the item.
- This creates a truly autonomous sorting system.