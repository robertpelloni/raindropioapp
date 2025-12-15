# Agent Instructions & Memory (Raindrop AI Sorter)

This file serves as the context memory and operational guide for autonomous agents working on this project.

## 🧠 Project Context
**Goal**: Build a robust, feature-rich userscript to automate Raindrop.io bookmark organization.
**Current State**: v0.7.0 (Robust, with Flatten/Prune/Frequency tools).
**Location**: `scripts/raindrop_ai_sorter.user.js`.

## 🤖 Operational Directives

### 1. Code Generation & Safety
*   **NO Invalid Escapes**: When writing JavaScript files, ensure you do not insert backslashes before template literal backticks or variable interpolations (e.g., `\${`). This causes immediate syntax errors in the browser.
*   **JSON Resilience**: LLMs (especially smaller local ones) often return broken JSON when asked to process large lists. Ensure `LLMClient.repairJSON` is robust and used.
*   **Audit First**: Any feature that modifies user data (Move, Delete, Update) **must** have a corresponding entry in the `ActionLogger`.

### 2. Required Features for Every Update
*   **Version Bump**: You **MUST** increment the `@version` in the userscript header.
*   **Changelog**: You **MUST** append the changes to `CHANGELOG.md`.
*   **Dry Run Support**: Ensure new write operations respect the global `STATE.config.dryRun` flag.

### 3. Known Pitfalls (Do Not Repeat)
*   **Silent Failures**: Do not catch errors in low-level clients without re-throwing them. The UI needs to know if an API call failed (401/429).
*   **API 400 Loops**: Tag cleanup loops crashed because `removeTag` was called on tags that were already merged/deleted. Wrap these in `try/catch`.
*   **Escaping Characters in `repairJSON`**: The logic `char === '\\'` requires careful escaping in the source code string (`\\\\`).

## 📚 Feature Memory

| Feature | Status | Notes |
| :--- | :--- | :--- |
| **Auto-Tagging** | ✅ Active | Scrapes URL, sends to LLM. |
| **Clustering** | ✅ Active | Hierarchical, Recursive. |
| **Tag Cleanup** | ✅ Active | Batch processing, JSON search fallback. |
| **Review Mode** | ✅ Active | Granular checkboxes, Select All. |
| **Session Resume** | ✅ Active | Persists page/state to `GM_storage`. |
| **Flatten Library** | ✅ Active | Moves to -1, deletes empty cols. |
| **Prune Tags** | ✅ Active | Removes tags < N count. |
| **Delete All Tags** | ✅ Active | "Nuclear" option. |
| **Organize Freq** | ✅ Active | Top N tags -> Hierarchy -> Move. |

## 🔄 Handoff Procedures
1.  **Read** `HANDOFF.md` (if present) for session-specific context.
2.  **Verify** the last userscript version in the file header.
3.  **Check** `CHANGELOG.md` to understand the trajectory.
