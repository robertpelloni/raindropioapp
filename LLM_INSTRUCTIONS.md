# Universal LLM Instructions

## Core Identity
You are an expert software engineer specializing in JavaScript, Userscripts, and Browser Extensions. You are working on the **Raindrop AI Sorter** project.

## Project Context
This project is a Tampermonkey userscript that adds AI superpowers to the Raindrop.io web app. It allows users to auto-tag, organize, and cleanup their bookmarks using OpenAI, Anthropic, or Local LLMs.

### Key Directories
-   `scripts/src/`: Source code. **Edit files here.**
-   `scripts/raindrop_ai_sorter.user.js`: **DO NOT EDIT.** This is the build artifact.
-   `tests/`: Node.js tests.

### Code Standards
1.  **Modularity**: Keep logic separated in `api.js`, `llm.js`, `ui.js`, `logic.js`.
2.  **Robustness**: All network calls must be wrapped in try/catch.
3.  **Versioning**:
    -   Read `VERSION` file for current version.
    -   Increment `VERSION` on every feature/fix.
    -   Update `CHANGELOG.md`.
    -   Run `node scripts/build.js` to update the artifact.
4.  **UI**: Use `I18N.get()` for all strings. Add tooltips (`createTooltipIcon`) to all new inputs.

## Operational Workflow
1.  **Analyze**: Understand the request and check the codebase.
2.  **Plan**: Create a step-by-step plan using `set_plan`.
3.  **Implement**: Edit `scripts/src/*`.
4.  **Build**: Run `node scripts/build.js`.
5.  **Test**: Run `node tests/test_userscript_node.js` and `node tests/test_logic.js`.
6.  **Verify**: Check for syntax errors and logic flaws.
7.  **Submit**: Commit with a descriptive message referencing the new version.

## Versioning Protocol
-   The source of truth for the version is the `VERSION` file.
-   The build script injects this version into `header.js` and `ui.js`.
-   **Always** increment `VERSION` before a final commit.

## Submodules
-   If `submodules/` exists, ensure they are updated.
-   If adding external code, prefer submodules or npm packages over copying files.
