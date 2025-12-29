# Project Dashboard

## Overview
This repository contains the source code for the Raindrop.io Web App and the **AI Sorter Userscript**.

## Components

### 1. Raindrop.io App (Root)
*   **Location:** `src/`, `package.json`
*   **Version:** 5.6.96 (from package.json)
*   **Status:** Base application.

### 2. AI Sorter Userscript
*   **Location:** `scripts/`
*   **Artifact:** `raindrop_ai_sorter.user.js` (Root)
*   **Version:** v1.0.0
*   **Date:** 2025-12-18 (Current)
*   **Features:**
    *   AI Tagging (OpenAI, Anthropic, Groq, DeepSeek, Vision)
    *   Advanced Sorting (Cluster, Classify, Semantic)
    *   Library Management (Flatten, Prune)
    *   UI: Tabbed Settings, Dark Mode, Config Sync.

## Directory Structure
*   `scripts/`: Userscript development environment.
    *   `src/`: Modular source files (`logic.js`, `ui.js`, `llm.js`).
    *   `build.js`: Build script.
    *   `raindrop_ai_sorter.user.js`: Built artifact.
*   `src/`: Main application source (React).

## Submodules
### 3. Bobcoin
*   **Location:** `submodules/bobcoin`
*   **Status:** Initial integration.
*   **Vision:** Privacy-focused, high-volume token mined via physical activity (Dancing). See `BOBCOIN_VISION.md`.
