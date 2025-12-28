# Universal LLM Instructions

## Core Directives
1.  **Code Integrity**: Never break existing functionality. Verify before submitting.
2.  **Versioning**: Every build must increment the version number in `scripts/src/header.js` and `CHANGELOG.md`.
3.  **Documentation**: Keep `CHANGELOG.md`, `DASHBOARD.md` and `HANDOFF.md` up to date.
4.  **Testing**: Run tests (`npm test` or `node tests/test_logic.js`) before submission.
5.  **Git Hygiene**: Use descriptive commit messages. Feature branches preferred.

## Project Structure
*   `src/`: Main Raindrop App (React).
*   `scripts/`: AI Sorter Userscript.
    *   `src/`: Modular source (`logic.js`, `ui.js`, etc).
    *   `build.js`: Concatenation script.
    *   `raindrop_ai_sorter.user.js`: Artifact.

## Userscript Development
*   Edit files in `scripts/src/`.
*   Run `node scripts/build.js` to compile.
*   Update `@version` in `scripts/src/header.js`.
