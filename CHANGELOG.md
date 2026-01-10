# Changelog

All notable changes to the Raindrop AI Sorter userscript will be documented in this file.

<<<<<<< HEAD
## [1.0.1] - Current
### Fixed
- **UI**: Added missing checkboxes for "Allow Nested Folders" and "Tag Broken Links".
- **Persistence**: Fixed settings not saving for `skipTagged`, `dryRun`, `autoDescribe`, `debugMode`, `nestedCollections`, and `tagBrokenLinks`.
- **Documentation**: Updated `AGENTS.md` to reflect completed features.

## [1.0.0] - Previous
=======
## [1.0.0] - Current
>>>>>>> origin/feature/raindrop-ai-sorter-userscript-7272302230095877234
### Added
- **Release**: First major release (v1.0.0). Feature complete.

## [0.9.0] - Previous
### Added
- **Vision Support**: Tag bookmarks using cover images (GPT-4o/Vision).
- **UI**: Added "Use Vision" checkbox.

## [0.8.0] - Previous
### Added
- **Semantic Sorting**: New `organize_semantic` mode that uses LLM to determine folder paths based on content.
- **Documentation**: Added `LLM_INSTRUCTIONS.md` and updated agent docs.

## [0.7.13] - Previous
### Added
- **UX**: Added "Open AI Sorter" to Userscript Menu.

## [0.7.12] - Previous
### Added
- **Robustness**: Improved scraper to skip binary files.

## [0.7.11] - Previous
### Added
- **Review Panel**: Implemented interactive UI for reviewing tag merges and bookmark moves.

## [0.7.10] - Previous
### Added
- **Localization**: Added Spanish translation and Language selector.

## [0.7.9] - Previous
### Added
- **Localization**: Added `I18N` module for easy translation. UI now uses dynamic strings.

## [0.7.8] - Previous
### Added
- **UX**: Added "Help" tab with usage instructions and links.

## [0.7.7] - Previous
### Added
- **UX**: Added Keyboard Shortcut (`Alt+Shift+S`) to toggle the panel.

## [0.7.6] - Previous
### Added
- **Dark Mode**: Added support for Raindrop's dark theme (auto-detected).

## [0.7.5] - Previous
### Added
- **Auto-Update**: Added `@updateURL` headers for seamless updates via Tampermonkey.

## [0.7.4] - Previous
### Added
- **Config Management**: Added Export/Import Settings buttons to easily migrate configurations.

## [0.7.3] - Previous
### Added
- **Custom Prompts**: Added ability to customize the Classification prompt.
- **UI**: Added "Classification Prompt" field to Prompts tab.

## [0.7.2] - Previous
### Added
- **Providers**: Added native support for Groq and DeepSeek.
- **Scraping**: Improved cleanup logic for web pages (Readability-lite).

## [0.7.1] - Previous
### Added
- **Flatten Library**: New mode to move all bookmarks to "Unsorted" and optionally delete empty collections.
- **Prune Tags**: New mode to remove tags with fewer than `minTagCount` occurrences.
- **Delete All Tags**: New mode to bulk remove all tags from the library.
- **Organize (Existing Folders)**: Classifies bookmarks into current folders without creating new ones.
- **Organize (Tag Frequency)**: Generates folder structure based on most frequent tags.
- **UI**:
    - **Tabbed Interface**: Organized settings into "Dashboard", "Settings", and "Prompts" tabs for better usability.
    - Added inputs for "Min Tag Count" and "Delete Empty Folders".
    - Added `optgroup` to Action dropdown.
- **UI**: Added inputs for "Min Tag Count" and "Delete Empty Folders". Added `optgroup` to Action dropdown.
- **API**: Added `deleteCollection` and `removeTagsBatch` methods.

## [0.6.1] - Previous
### Fixed
- **Syntax Error**: Removed invalid escape sequences (`\${`, `` \` ``) that prevented script execution.
- **JSON Repair**: Fixed logic for handling escaped characters in `repairJSON`.

## [0.6.0] - Previous
### Added
- **Granular Review**: Checkboxes for approving specific tag merges or bookmark moves.
- **Session Resumability**: Saves progress (page number) to local storage to recover from interruptions.
- **Audit Logging**: Tracks all actions to an in-memory log with JSON export.
- **Cost Tracking**: Visual display of estimated API costs and token usage.
### Fixed
- **API Robustness**: Sanitized tag payloads to prevent 400 Bad Request errors.
- **Error Visibility**: Propagated errors from `LLMClient` to the UI log.
