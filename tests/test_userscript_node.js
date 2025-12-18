const fs = require('fs');
const path = require('path');
const assert = require('assert');

const scriptPath = path.resolve(__dirname, '../scripts/raindrop_ai_sorter.user.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log('--- Raindrop Userscript Logic Test ---');

try {
    // Mock Globals
    global.GM_xmlhttpRequest = () => {};
    global.GM_setValue = () => {};
    global.GM_getValue = () => {};
    global.GM_registerMenuCommand = () => {};
    global.GM_addStyle = () => {};
    global.window = {
        addEventListener: () => {},
        location: { href: 'test' }
    };
    global.document = {
        body: { appendChild: () => {} },
        createElement: () => ({
            style: {},
            addEventListener: () => {},
            appendChild: () => {}
        }),
        getElementById: () => null,
        querySelector: () => null
    };

    // Inject hook to export classes from IIFE
    const exportHook = `
        global.LLMClient = LLMClient;
        global.RaindropAPI = RaindropAPI;
    `;

    // Insert before the end of the IIFE
    // The script ends with "})();"
    // We can insert before "window.addEventListener('load'"
    const hookPoint = "window.addEventListener('load'";
    if (!scriptContent.includes(hookPoint)) {
        throw new Error("Could not find hook point in script");
    }

    const modifiedContent = scriptContent.replace(hookPoint, `${exportHook}\n${hookPoint}`);

    // Execute
    eval(modifiedContent);
    console.log('✅ Full Script Syntax: Valid');

    // Test LLMClient.repairJSON
    if (global.LLMClient) {
        console.log('Testing LLMClient.repairJSON...');
        const llm = new global.LLMClient({ debugMode: true }, {});

        const testCases = [
            { input: '{"tags": ["a", "b"]}', expected: '{"tags": ["a", "b"]}', desc: "Valid JSON" },
            { input: '{"tags": ["a", "b"', expected: '{"tags": ["a", "b"]}', desc: "Missing closing braces" },
            { input: '{"tags": ["a", "b",', expected: '{"tags": ["a", "b"]}', desc: "Trailing comma" },
            { input: '{"desc": "Title: \\"Hello\\""', expected: '{"desc": "Title: \\"Hello\\""}', desc: "Escaped quotes" },
            { input: '{"tags": ["a"], "nested": {"k": "v"', expected: '{"tags": ["a"], "nested": {"k": "v"}}', desc: "Nested object" }
        ];

        let passed = 0;
        testCases.forEach(tc => {
            try {
                const repaired = llm.repairJSON(tc.input);
                const parsed = JSON.parse(repaired);
                assert.deepStrictEqual(parsed, JSON.parse(tc.expected));
                passed++;
            } catch(e) {
                console.error(`[FAIL] ${tc.desc}`);
                console.error(`Input:    ${tc.input}`);
                console.error(`Repaired: ${llm.repairJSON(tc.input)}`);
            }
        });

        if (passed === testCases.length) {
            console.log(`✅ LLMClient.repairJSON: ${passed}/${testCases.length} Passed`);
        } else {
            console.error(`❌ LLMClient.repairJSON: ${passed}/${testCases.length} Passed`);
            process.exit(1);
        }
    } else {
        throw new Error("LLMClient not exported from script");
    }

} catch(e) {
    console.error('❌ Test Failed:', e);
    process.exit(1);
}
