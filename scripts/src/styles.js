const STYLES = `
    #ras-toggle-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: #007aff;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        z-index: 10000;
        font-size: 24px;
        transition: transform 0.2s;
    }
    #ras-toggle-btn:hover { transform: scale(1.1); }

    #ras-container {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 350px;
        max-height: 80vh;
        background: white;
        border-radius: 12px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        border: 1px solid #e0e0e0;
        overflow: hidden;
    }

    #ras-header {
        background: #f5f5f5;
        padding: 10px 15px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e0e0e0;
    }

    #ras-tabs {
        display: flex;
        background: #fff;
        border-bottom: 1px solid #e0e0e0;
    }
    .ras-tab-btn {
        flex: 1;
        padding: 8px;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 12px;
        color: #666;
        border-bottom: 2px solid transparent;
    }
    .ras-tab-btn.active {
        color: #007aff;
        border-bottom: 2px solid #007aff;
        font-weight: 500;
    }

    #ras-body {
        padding: 15px;
        overflow-y: auto;
        flex: 1;
    }

    .ras-tab-content { display: none; }
    .ras-tab-content.active { display: block; }

    .ras-field { margin-bottom: 12px; }
    .ras-field label { display: block; margin-bottom: 4px; color: #333; font-weight: 500; }
    .ras-field input[type="text"],
    .ras-field input[type="password"],
    .ras-field input[type="number"],
    .ras-field select,
    .ras-field textarea {
        width: 100%;
        padding: 6px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 12px;
        box-sizing: border-box;
    }
    .ras-field textarea { resize: vertical; }

    .ras-btn {
        width: 100%;
        padding: 8px;
        background: #007aff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
    }
    .ras-btn:hover { opacity: 0.9; }
    .ras-btn.stop { background: #dc3545; }

    #ras-log {
        margin-top: 10px;
        max-height: 150px;
        overflow-y: auto;
        background: #f9f9f9;
        padding: 5px;
        border: 1px solid #eee;
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
    }
    .ras-log-entry { margin-bottom: 2px; }
    .ras-log-error { color: #d32f2f; }
    .ras-log-success { color: #28a745; }
    .ras-log-warn { color: #f57f17; }

    #ras-tooltip-overlay {
        position: fixed;
        background: #333;
        color: white;
        padding: 5px 8px;
        border-radius: 4px;
        font-size: 11px;
        z-index: 10001;
        display: none;
        max-width: 200px;
        pointer-events: none;
    }
    .ras-tooltip-icon {
        display: inline-block;
        width: 14px;
        height: 14px;
        background: #ddd;
        color: #666;
        border-radius: 50%;
        text-align: center;
        line-height: 14px;
        font-size: 10px;
        cursor: help;
        margin-left: 4px;
    }

    #ras-stats-bar {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #666;
        margin-bottom: 8px;
        padding: 0 2px;
    }

    /* Review Panel */
    #ras-review-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        max-height: 80vh;
        background: white;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        border-radius: 8px;
        z-index: 10002;
        display: flex;
        flex-direction: column;
        border: 1px solid #ccc;
    }
    #ras-review-header {
        padding: 10px 15px;
        background: #f5f5f5;
        font-weight: bold;
        border-bottom: 1px solid #ddd;
        display: flex;
        justify-content: space-between;
    }
    #ras-review-body {
        padding: 10px;
        overflow-y: auto;
        flex: 1;
        background: #fff;
    }
    #ras-review-footer {
        padding: 10px;
        border-top: 1px solid #ddd;
        text-align: right;
        background: #f5f5f5;
    }
    .ras-review-item {
        display: flex;
        align-items: center;
        padding: 5px;
        border-bottom: 1px solid #eee;
        font-size: 12px;
    }
    .ras-review-item:last-child { border-bottom: none; }
    .ras-review-item input { margin-right: 8px; }

    /* Toast */
    #ras-toast-container {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10005;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .ras-toast {
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        transition: opacity 0.3s;
    }
    .ras-toast.error { background: #d32f2f; }
    .ras-toast.success { background: #28a745; }
`;

if (typeof window !== 'undefined') {
    window.RAS_STYLES = STYLES;
}
