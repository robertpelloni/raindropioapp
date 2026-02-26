# CHANGELOG

## [1.0.8] - 2024-05-24
### Added
- **"The Architect" (Structural Templates):** New feature to organize bookmarks based on predefined or custom structural schemas.
  - Added "Templates" tab in the UI.
  - Built-in templates: PARA, Dewey Decimal, Johnny.Decimal, Simple.
  - Ability to create, save, and delete custom structural templates.
  - Integrated into "Organize (Semantic)" mode: if a template is selected, the LLM classifies bookmarks into the template's structure instead of existing folders.
- **"The Curator" (Visual Query Builder):** (Previously added in v1.0.7 dev) Visual interface for constructing complex Raindrop search queries (AND/OR/NOT logic for tags, domains, titles).
- **Refined Prompts:** Updated default prompts for better structural adherence.
- **Code Organization:** Modularized UI components (`templates_ui_injector.js`, `query_builder.js`) and updated build pipeline.

### Changed
- **UI:** Updated main panel with new tabs and improved layout.
- **Logic:** `organize_semantic` mode now prioritizes selected templates over existing folder structure if active.
- **Documentation:** Updated `LLM_INSTRUCTIONS.md`, `ROADMAP.md`, `VISION.md` to reflect new architecture.

## [1.0.7] - 2024-05-23
- Initial implementation of Visual Query Builder.
- Modularization of UI code.

## [1.0.6] - 2024-05-22
- Added token usage tracking and cost estimation.
- Improved "Prune Tags" mode with batch operations.
- Added "Newsletter" summary mode.

## [1.0.5] - 2024-05-21
- Added "Safe Mode" voting mechanism for clustering.
- Added "Search Filter" mode.
- Added "Review Clusters" UI for manual approval.

## [1.0.0] - 2024-05-20
- Initial Release.
