# Deployment Instructions

## Overview
The Raindrop AI Sorter is currently deployed as a **Tampermonkey Userscript**. It runs directly in the user's browser when they visit `app.raindrop.io`.

Because this is a client-side script, deployment means providing the user with the final, compiled `raindrop_ai_sorter.user.js` file.

## Prerequisites
- Node.js (v16+)
- npm (for running the test suite)

## Build Process
Whenever you modify source code in the `scripts/src/` directory, you **must** recompile the artifact.

1.  **Update Version**: Update the `VERSION` text file in the root directory (e.g., from `1.5.0` to `1.6.0`). This is the single source of truth.
2.  **Compile**: Run the build script from the root directory:
    ```bash
    node scripts/build.js
    ```
    *This script concatenates all the modular files in `src/` and injects the `VERSION` string into the Tampermonkey header.*
3.  **Test**: Ensure you haven't broken the logic loop or introduced syntax errors:
    ```bash
    cd scripts && npm test
    ```

## Watch Mode (Development)
If you are actively developing and want the artifact to rebuild automatically on every save, run:
```bash
node scripts/build.js --watch
```

## User Installation
1.  The user must install the [Tampermonkey](https://www.tampermonkey.net/) extension for their browser (Chrome, Firefox, Safari, Edge).
2.  They create a new script in the Tampermonkey dashboard.
3.  They copy the entire contents of the newly built `scripts/raindrop_ai_sorter.user.js` and paste it into the editor.
4.  Save the script.
5.  Navigate to `https://app.raindrop.io`. The script will automatically inject the control panel in the bottom right corner (the 🤖 robot icon).

## Future Migrations (Web Extension)
If this project is ever migrated to a native Chrome/Firefox Web Extension (Phase 5), the deployment process will change significantly:
1.  The `scripts/` directory will become the root of the extension.
2.  A `manifest.json` will replace the Tampermonkey header (`// ==UserScript==`).
3.  The project will need a bundler (Webpack/Vite) to package the React/Preact components, background service workers, and content scripts into a `dist/` folder.
4.  Deployment will involve zipping the `dist/` folder and uploading it to the Chrome Web Store / Firefox Add-ons portal.
