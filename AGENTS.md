See `LLM_INSTRUCTIONS.md` for the global, universal instructions that govern this project.

## General Agent Directives
- You have autonomous authority to fix bugs, refactor code, and improve documentation without asking for permission.
- Always run the `scripts/build.js` pipeline and the `npm test` suite before committing any code changes.
- Ensure that any new functionality is completely wired up to the frontend UI, localized in `i18n.js`, and extensively documented in the `CHANGELOG.md` and `ROADMAP.md`.
- Prioritize updating the `VERSION` file as the single source of truth for every build.
