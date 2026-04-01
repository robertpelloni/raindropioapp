# 🧠 Brainstorming & Radical Ideas

This document tracks radical improvements, architectural pivots, and moonshot features for the Raindrop AI Sorter project. These ideas are intended to push the boundaries of what a simple userscript can do, transforming it into a full-fledged intelligent system.

## 1. "The Sentinel" (Web Extension Migration)
**Concept:** Move away from Tampermonkey userscripts to a fully-fledged Chrome/Firefox Web Extension.
**Why:**
- Background processing: A Web Extension can use `chrome.alarms` to run a nightly cleanup worker (e.g., at 3 AM, prune tags, auto-tag new bookmarks, deduplicate). This makes "Smart Triggers" truly autonomous.
- Better UI: We can use a native popup menu or a dedicated options page instead of injecting a fixed, draggable DIV over the Raindrop UI, which occasionally conflicts with their z-index.
- Secure API Key Storage: Using `chrome.storage.local` is much more robust than `GM_getValue`.
- SPA Scraping: A background worker can potentially spin up off-screen tabs to fully hydrate SPAs without needing the external Jina Reader API.
**Action Plan:**
- Port `NetworkClient` to use native `fetch` with Web Extension CORS configurations.
- Scaffold a React/Vite popup UI.

## 2. "The Cartographer" (Local Vector DB & Semantic Search)
**Concept:** We currently use local embeddings (Transformers.js) for deduplication. We should expand this into a full semantic search index.
**How:**
- Embed `Transformers.js` (or similar WebAssembly ONNX runtimes) into the extension.
- When a bookmark is fetched, generate an embedding for its `excerpt` + `title`.
- Store embeddings in IndexedDB via a library like Dexie.js or a client-side vector store.
- **Use Cases:**
  - *Instant Duplicates:* (Already implemented in v1.4.0)
  - *Semantic Search:* "Find me that article about AI sorting algorithms" matches bookmarks even if those exact words aren't used.
  - *Smart Folders:* Instead of static folder names, folders are defined by a prompt ("Things related to finance"), and new bookmarks are auto-routed based on cosine similarity to the folder's concept vector.

## 3. "The Archivist v2" (Full Page Snapshotting)
**Concept:** Currently, we check the Wayback Machine for broken links. We should *actively* archive pages to prevent link rot before it happens.
**How:**
- Use SingleFile (or a similar library) to generate a complete, self-contained HTML snapshot of the page upon bookmarking.
- Save the snapshot directly into a cloud storage provider (Google Drive/Dropbox) or as an attachment in Raindrop (if the API supports file uploads).

## 4. UI Modernization (React/Preact Complete Rewrite)
**Concept:** The `ui.js` file is still largely a massive template literal string, despite the initial port of the `PreactStats` component using HTM. It's time to componentize the entire application.
**How:**
- Introduce a build step (Vite/Rollup) that compiles JSX into the final userscript.
- Allows for complex state management (Context/Redux) instead of manually querying the DOM for input values and managing complex event listeners for the Kanban drag-and-drop board.

## 5. Context-Aware "Agentic" Sorting (Function Calling)
**Concept:** Right now, the LLM is given a static list of tags or folders. It should act more like an autonomous agent.
**How:**
- Give the LLM access to the `search` and `getCollections` tools directly (via OpenAI/Anthropic function calling/tool use).
- **Prompt:** "Organize this bookmark."
- **LLM Action:**
  1. Calls `search("similar topic")` to see where the user usually puts these items.
  2. Calls `getCollections()` to view the existing hierarchy.
  3. Creates a new subfolder if necessary, then moves the item.
- This creates a truly autonomous sorting system that evolves with the user's habits.

## 6. Multi-Modal Vision Expansion
**Concept:** We currently use Vision to analyze the bookmark's cover image. We should allow users to upload their own screenshots or images for categorization.
**How:**
- Add a drag-and-drop file upload zone to the dashboard.
- The system uses OCR or Vision LLMs to extract text, summarize the image, and automatically create a new bookmark in Raindrop with the image attached (or linked via a hosting service).

## 7. Desktop App Wrapper (Electron/Tauri)
**Concept:** If the user wants complete privacy and power, turn the Sorter into a standalone desktop application.
**Why:**
- Direct file system access.
- Ability to run much larger local LLMs (e.g., Llama 3 8B via Ollama/llama.cpp) without browser memory limits.
- True offline capabilities.
