# Raindrop.io AI Sorter Userscript

A powerful Tampermonkey userscript to automate organizing your Raindrop.io bookmarks using AI. It supports OpenAI, Anthropic, Groq, DeepSeek, and Local LLMs (via Ollama/LM Studio).

## 🚀 Features

### Core Functionality
-   **Auto-Tagging**: Scrapes bookmark content and uses LLM to generate relevant tags.
-   **Auto-Clustering**: Analyzes tags and moves bookmarks into hierarchical collections (e.g., `Dev > Web > React`).
-   **Tag Cleanup**: Identifies and merges synonymous or misspelled tags (e.g., `js` → `javascript`).
-   **Search Filtering**: Process only bookmarks matching a specific Raindrop search query (e.g., `#unread` or `created:2024`).
-   **Vision Support**: Uses the bookmark's cover image for multimodal analysis (supported by GPT-4o, Claude 3, Llama 3 Vision).

### Organization Modes
1.  **Tag Bookmarks Only**: Scrapes content and adds tags.
2.  **Organize (Recursive Clusters)**: Creates a new folder structure based on tag clusters.
3.  **Organize (Existing Folders)**: Classifies bookmarks into your *existing* folder hierarchy.
4.  **Organize (Semantic)**: Uses AI to determine the best folder path recursively based on content.
5.  **Organize (Tag Frequency)**: Simple mode that groups the most frequent tags into folders.
6.  **Cleanup Tags**: Deduplicates tags (e.g., merges singular/plural).
7.  **Prune Infrequent Tags**: Deletes tags used less than X times.
8.  **Flatten Library**: Moves all bookmarks to "Unsorted" and optionally deletes empty folders.
9.  **Delete ALL Tags**: Nuclear option to remove every tag.

### Safety & Control
-   **Dry Run Mode**: Simulate actions without modifying data.
-   **Safe Mode**: Requires multiple internal votes or high confidence before moving bookmarks.
-   **Review Actions**: Pauses execution to let you manually approve proposed changes via a UI panel.
-   **Audit Log**: Tracks all changes in memory with JSON export capability.
-   **Cost Tracking**: Real-time display of token usage and estimated API cost.

## 📦 Installation

1.  Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser.
2.  Create a new script in Tampermonkey.
3.  Copy the content of `raindrop_ai_sorter.user.js` (from this repository) into the editor.
4.  Save the script.
5.  Navigate to [app.raindrop.io](https://app.raindrop.io).
6.  Click the 🤖 robot icon in the bottom-right corner to open the control panel.

## ⚙️ Configuration

Open the **Settings** tab to configure the script.

### General
-   **Language**: Select English or Spanish interface.
-   **Raindrop Test Token**: **Required**. Get it from [Raindrop Settings > Integrations > For Developers](https://app.raindrop.io/settings/integrations). Click "Create New App", then "Create test token".

### AI Providers
Select your provider and enter the API Key.
-   **OpenAI**: Uses `gpt-4o-mini` by default. Good balance of speed/cost.
-   **Anthropic**: Uses `claude-3-haiku` by default. Excellent reasoning.
-   **Groq**: Extremely fast inference using Llama 3.
-   **DeepSeek**: Cost-effective coding/reasoning models.
-   **Custom / Local**: Connect to Ollama or LM Studio running locally (e.g., `http://localhost:11434/v1`).

### Performance & Limits
-   **Concurrency**: Number of bookmarks to process in parallel (Default: 20). Higher values are faster but may hit rate limits.
-   **Max Tags**: Maximum tags to generate per bookmark (Default: 5).
-   **Min Tag Count (Pruning)**: Threshold for the "Prune Infrequent Tags" mode.

### Behavior Flags
-   **Skip Tagged**: If checked, the script ignores bookmarks that already have tags.
-   **Dry Run**: **Highly Recommended** for first-time use. Logs actions but makes no API calls to modify data.
-   **Tag Broken Links**: Checks if the URL is accessible and adds a `broken-link` tag if not.
-   **Delete Empty Folders**: Removes collections that are empty after moving bookmarks (used in Flatten/Organize modes).
-   **Allow Nested Folders**: Enables the AI to create nested structures like `Technology > Programming > Python`.

### Safety
-   **Safe Mode**: Adds extra checks (internal voting/confidence scoring) to prevent misclassification.
-   **Review Actions**: If enabled, the script will pause and show a popup list of proposed moves/merges for you to approve.
-   **Debug Logs**: Prints raw LLM responses and detailed logic to the browser console (F12).

## 📝 Prompts & Presets

In the **Prompts** tab, you can customize the instructions sent to the AI.
-   **Tagging Prompt**: Instructions for generating tags. Must include `{{CONTENT}}`.
-   **Clustering Prompt**: Instructions for grouping tags into folders. Must include `{{TAGS}}`.
-   **Classification Prompt**: Instructions for sorting into existing folders. Must include `{{BOOKMARK}}` and `{{CATEGORIES}}`.
-   **Presets**: Save and load your favorite prompt configurations.

## 🛠️ Usage Guide

### Scenario 1: Tagging Untagged Bookmarks
1.  Go to **Dashboard**.
2.  Select **Collection**: "All Bookmarks" (or a specific one).
3.  Select **Mode**: "Tag Bookmarks Only".
4.  Check **Skip Tagged** in Settings.
5.  Click **Start**.

### Scenario 2: Organizing into Folders
1.  Ensure you have good tags first (run Scenario 1).
2.  Select **Mode**: "Organize (Recursive Clusters)".
3.  Enable **Dry Run** to test.
4.  Click **Start**. The AI will analyze your tags and move bookmarks into new folders.

### Scenario 3: Cleaning Up Tags
1.  Select **Mode**: "Cleanup Tags (Deduplicate)".
2.  Enable **Review Actions** in Settings.
3.  Click **Start**.
4.  A popup will appear asking you to confirm merges like `js` -> `javascript`.

## ❓ Troubleshooting

-   **Error 401 (Unauthorized)**: Check your API Keys (OpenAI/Anthropic) and Raindrop Test Token.
-   **Error 429 (Too Many Requests)**: You are hitting rate limits. Reduce **Concurrency** in Settings.
-   **"Network Error"**: Check your internet connection. If using Local LLM, ensure CORS is enabled or Tampermonkey has permissions.
-   **Script stops randomly**: Check the Browser Console (F12) for errors. The script saves state, so you can refresh and click Start to resume.

## 📄 License
MIT License.
