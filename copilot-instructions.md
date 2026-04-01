See `LLM_INSTRUCTIONS.md` for the global, universal instructions that govern this project.

## GitHub Copilot-Specific Directives
- Provide concise, highly relevant autocomplete suggestions for vanilla JavaScript and Preact/HTM components.
- Respect the existing project style, specifically the requirement to use `I18N.get('key')` for all user-facing strings.
- Automatically suggest `try/catch` blocks around all `NetworkClient` or `LLMClient` API calls.
