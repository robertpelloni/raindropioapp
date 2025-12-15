# Raindrop.io AI Sorter Userscript

A powerful Tampermonkey userscript to automate organizing your Raindrop.io bookmarks using AI (OpenAI, Anthropic, or Local LLMs).

## Features

-   **Auto-Tagging**: Scrapes bookmark content and uses LLM to generate relevant tags.
-   **Auto-Clustering**: Groups bookmarks into collections based on tag clusters using AI.
-   **Tag Cleanup**: Identifies and merges synonymous or misspelled tags (e.g., "js" -> "javascript").
-   **Search Filtering**: Process only bookmarks matching a specific Raindrop search query (e.g., `#unread`).
-   **Safety First**:
    -   **Dry Run Mode**: Simulate actions without modifying data.
    -   **Audit Log**: Tracks all changes with JSON export capability.
    -   **Cost Tracking**: Estimates token usage and API cost.
    -   **Review Mode**: Manually approve tag merges and cluster moves.

## Installation

1.  Install [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2.  Create a new script in Tampermonkey.
3.  Copy the content of `raindrop_ai_sorter.user.js` into the editor.
4.  Save the script.
5.  Navigate to [app.raindrop.io](https://app.raindrop.io).
6.  Click the 🤖 robot icon in the bottom-right corner to open the panel.

## Configuration

-   **Raindrop Test Token**: Required for API access. Get it from Raindrop Settings > Integrations > For Developers > "Create New App" > "Create test token".
-   **AI Provider**:
    -   **OpenAI**: Requires an API Key (`sk-...`).
    -   **Anthropic**: Requires an API Key (`sk-ant-...`).
    -   **Custom (Ollama)**: Point to your local LLM (default: `http://localhost:11434/v1`).
-   **Concurrency**: Number of parallel requests (Default: 20).
-   **Max Tags**: Limit tags per bookmark (Default: 5).

## Usage Modes

1.  **Tag Bookmarks Only**: Scrapes and tags bookmarks that don't have tags (or all, if "Skip tagged" is unchecked).
2.  **Organize (Cluster Tags)**: Analyzes existing tags and moves bookmarks into hierarchical collections (e.g., "Dev > Web").
3.  **Cleanup Tags**: Finds duplicates/synonyms and merges them (e.g., "ai tools" -> "AI"). Requires Review.

## Troubleshooting

-   **API Error 401**: Invalid API Key. Check your OpenAI/Anthropic/Raindrop token.
-   **API Error 400**: Bad Request. Often caused by invalid tag names. The script handles this by sanitizing tags, but check the log for details.
-   **Nothing Happening?**: Check the "Dry Run" setting. If enabled, changes are only logged, not executed.
-   **"Network Error"**: Check your internet connection or Cross-Origin restrictions (though Tampermonkey handles most).

## Logs

-   View the on-screen log for real-time progress.
-   Click the **Save** (disk) icon to download a full Audit Log JSON of all operations performed in the session.
