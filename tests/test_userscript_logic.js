
const fs = require('fs');
const path = require('path');

// Mock browser environment globals
global.GM_xmlhttpRequest = jest.fn();
global.GM_setValue = jest.fn();
global.GM_getValue = jest.fn((key, def) => def);
global.GM_registerMenuCommand = jest.fn();
global.GM_addStyle = jest.fn();
global.window = {
    addEventListener: jest.fn(),
    location: { href: 'https://app.raindrop.io/' }
};
global.document = {
    body: { appendChild: jest.fn() },
    createElement: jest.fn(() => ({
        style: {},
        classList: { add: jest.fn() },
        addEventListener: jest.fn(),
        appendChild: jest.fn()
    })),
    getElementById: jest.fn(() => ({
        value: '',
        checked: false,
        style: {},
        addEventListener: jest.fn()
    }))
};
global.console = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    group: jest.fn(),
    groupEnd: jest.fn()
};

test('Userscript syntax verification', () => {
    const scriptPath = path.resolve(__dirname, '../scripts/raindrop_ai_sorter.user.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    // Wrap in function to avoid immediate execution issues during require if not handled
    // But evaluating it is the best check for syntax
    expect(() => {
        // We just eval the script content to check for syntax errors
        // and see if it throws immediately
        // Note: The script has an IIFE, so it will run.
        // We mocked the globals so it should be fine.
        eval(scriptContent);
    }).not.toThrow();
});
