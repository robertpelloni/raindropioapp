# Changelog

All notable changes to the Raindrop AI Sorter userscript will be documented in this file.

## [1.0.6] - Current
### Added
- **Smart Rules Engine**: "The Memory" feature allows the script to remember your manual review decisions.
    - Saves "Always Merge" rules when you confirm tag cleanups.
    - Saves "Always Move" rules (future-proofing) when you confirm clustering moves.
- **UI**: Added a **Rules** tab to view, delete, and manage saved automation rules.
- **UI**: Added checkbox "Save Rule" to Review Panel items.

### Fixed
- **Testing**: Fixed integration tests to mock `RuleEngine` properly.

## [1.0.5] - Previous
### Added
- **Newsletter Mode**: New `summarize` mode that generates a Markdown digest of selected bookmarks.
- **Advanced Cost Tracking**: Updated pricing logic to support specific models (GPT-4o, Claude 3.5, etc.).
- **UI**: Added Newsletter option to Mode dropdown.

## [1.0.4] - Previous
### Added
- **Archival**: "The Archivist" feature now automatically checks the Internet Archive (Wayback Machine) for broken links.
- **Scraping**: "Readability-lite v2" engine.
- **Prompts**: Refined default prompts ("The Librarian" persona).

## [1.0.3] - Previous
### Infrastructure
- **Versioning**: Implemented centralized versioning.
- **Documentation**: Unified documentation strategy.

## [1.0.2] - Previous
### Added
- **UI**: Added tooltips and comprehensive I18N.
- **UI**: Added specific Model fields.

## [1.0.0] - Previous
### Added
- **Release**: First major release.
