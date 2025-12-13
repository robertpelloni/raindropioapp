
const fs = require('fs');
const path = require('path');

// Mock browser environment globals
global.GM_xmlhttpRequest = () => {};
global.GM_setValue = () => {};
global.GM_getValue = (key, def) => def;
global.GM_registerMenuCommand = () => {};
global.GM_addStyle = () => {};
global.window = {
    addEventListener: () => {},
    location: { href: 'https://app.raindrop.io/' }
};
global.document = {
    body: { appendChild: () => {} },
    createElement: () => ({
        style: {},
        classList: { add: () => {} },
        addEventListener: () => {},
        appendChild: () => {}
    }),
    getElementById: () => ({
        value: '',
        checked: false,
        style: {},
        addEventListener: () => {}
    })
};

// We don't mock console so we can see output.
// If the script runs immediately, we'll see its logs.

try {
    const scriptPath = path.resolve(__dirname, '../scripts/raindrop_ai_sorter.user.js');
    console.log('Reading script from:', scriptPath);
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');

    console.log('Verifying syntax...');
    // We just eval the script content to check for syntax errors
    eval(scriptContent);
    console.log('✅ Syntax verification passed.');
} catch (e) {
    console.error('❌ Syntax verification failed:', e);
    process.exit(1);
}
