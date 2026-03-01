# Deployment Instructions

## Userscript Deployment (Current)

The primary deliverable is a Tampermonkey/Greasemonkey userscript.

### Build Process
1. Navigate to the `scripts/` directory:
   ```bash
   cd scripts
   ```
2. Install dependencies (if any):
   ```bash
   npm install
   ```
3. Run the build script to compile `src/` modules into the final artifact:
   ```bash
   node build.js
   ```
   *Note: Use `node build.js --watch` during active development.*

### Versioning & Release
1. Update the `VERSION` file in the root directory.
2. Update `CHANGELOG.md` with detailed release notes.
3. Run the build script (`node build.js`). The script automatically injects the version into the artifact.
4. Commit the changes, including the built `raindrop_ai_sorter.user.js` file.

### Installation for Users
Users can install the script by navigating to the raw URL of `scripts/raindrop_ai_sorter.user.js` on GitHub (or equivalent host). Tampermonkey will automatically detect and prompt for installation.

## Future Deployment (Web Extension)
*(Instructions to be added when Web Extension migration is complete)*
