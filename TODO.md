# TODO.md

## Immediate Tasks
1.  **Optimize Web Extension Assets**:
    *   ONNX Runtime warns about `eval()`. Configure Vite to handle WebAssembly files properly if needed for the `transformers.js` library to pass Chrome Web Store review.
2.  **Phase 6: The Librarian Agent**:
    *   Transition the main processing loop to the Background Service Worker so sorting can continue even if the Raindrop.io tab is closed.
    *   Implement "Smart Triggers" via `chrome.alarms` to automatically poll the "Unsorted" folder in the background.
