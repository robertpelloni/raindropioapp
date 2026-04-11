# DEPLOY.md

## Userscript Deployment
1.  Make sure all logic is correctly modularized in `scripts/src/`.
2.  Run `node scripts/build.js` from the `scripts/` directory to generate `raindrop_ai_sorter.user.js`.
3.  The version is controlled by the root `VERSION` file. The build script automatically injects this.
4.  Copy the contents of `scripts/raindrop_ai_sorter.user.js` to Tampermonkey/Violentmonkey.

## Future Web Extension Deployment (Phase 5)
1.  Navigate to `extension/`.
2.  Run `npm install`.
3.  Run `npm run build` using Vite.
4.  Load the `extension/dist/` directory as an unpacked extension in Chrome/Firefox.
