# Changelog

All notable changes to the Raindrop AI Sorter userscript will be documented in this file.

## [0.7.4] - Current
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
