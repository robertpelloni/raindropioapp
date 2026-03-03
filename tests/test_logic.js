const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Path to the compiled userscript
const scriptPath = path.resolve(__dirname, '../scripts/raindrop_ai_sorter.user.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log('--- Raindrop Logic Test (Integration) ---');

// --- Mocks ---

// Mock DOM
const domElements = new Map();
function getOrCreateElement(id) {
    if (!domElements.has(id)) {
        domElements.set(id, {
            id,
            value: '',
            checked: false,
            style: {},
            textContent: '',
            classList: {
                add: () => {},
                remove: () => {},
                contains: () => false
            },
            addEventListener: () => {},
            prepend: () => {},
            appendChild: () => {}
        });
    }
    return domElements.get(id);
}

global.document = {
    getElementById: (id) => getOrCreateElement(id),
    createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        className: '',
        textContent: '',
        style: {}
    }),
    querySelectorAll: () => [],
    body: { appendChild: () => {} }
};

global.window = {
    addEventListener: () => {},
    location: { href: 'test' }
};

global.confirm = () => true; // Always say yes
global.alert = (msg) => console.log('[ALERT]', msg);
global.prompt = () => '';

// Mock GM
global.GM_setValue = () => {};
global.GM_getValue = (k, v) => v;
global.GM_registerMenuCommand = () => {};
global.GM_addStyle = () => {};

// API Mocking Helper
const apiRequests = [];
const apiResponses = [];

global.GM_xmlhttpRequest = (details) => {
    apiRequests.push({
        method: details.method,
        url: details.url,
        data: details.data ? JSON.parse(details.data) : null
    });

    // Find matching response or default
    const nextResponse = apiResponses.shift();
    if (nextResponse) {
        if (details.onload) details.onload({
            status: nextResponse.status || 200,
            statusText: 'OK',
            responseText: JSON.stringify(nextResponse.body || {}),
            responseHeaders: ''
        });
    } else {
        console.warn(`[MockNetwork] No response queued for ${details.method} ${details.url}`);
        if (details.onload) details.onload({ status: 404, statusText: 'Not Found', responseText: '{}' });
    }

    return { abort: () => {} };
};

// --- Execute Script ---

// Inject hook to export internals
const exportHook = `
    global.LLMClient = LLMClient;
    global.RaindropAPI = RaindropAPI;
    global.runMainProcess = runMainProcess;
    global.STATE = STATE;
    global.RuleEngine = typeof RuleEngine !== 'undefined' ? RuleEngine : { findRule: () => null };
`;

const hookPoint = "window.addEventListener('load'";
if (!scriptContent.includes(hookPoint)) throw new Error("Hook point not found");
const modifiedContent = scriptContent.replace(hookPoint, `${exportHook}\n${hookPoint}`);

try {
    eval(modifiedContent);
} catch (e) {
    console.error("Script Eval Failed:", e);
    process.exit(1);
}

// Initialize STATE for mock env
global.STATE.init();
global.STATE.config.provider = 'openai'; // Explicitly set provider for tests

// --- Tests ---

async function testFlattenMode() {
    console.log('\n[Test] Flatten Mode');
    apiRequests.length = 0;
    apiResponses.length = 0;

    // Setup State & DOM
    global.STATE.config.dryRun = false;
    global.STATE.config.deleteEmptyCols = true;
    global.STATE.config.raindropToken = 'mock-token';

    getOrCreateElement('ras-action-mode').value = 'flatten';
    getOrCreateElement('ras-collection-select').value = '0'; // Irrelevant for flatten but required

    // Queue Responses
    apiResponses.push({
        // 1. loadCollectionCache -> /collections
        body: { items: [{ _id: 123, title: 'FolderToDelete' }] }
    });
    apiResponses.push({
        // 2. getBookmarks(123, 0)
        body: { items: [{ _id: 10, title: 'Bookmark1' }] }
    });
    apiResponses.push({
        // 3. moveBookmark(10, -1) -> PUT /raindrop/10
        body: { item: { _id: 10 } }
    });
    apiResponses.push({
        // 4. getBookmarks(123, 0) (check for more) -> empty
        body: { items: [] }
    });
    apiResponses.push({
        // 5. deleteCollection(123) -> DELETE /collection/123
        body: {}
    });

    // Run
    await global.runMainProcess();

    // Verify
    const calls = apiRequests.map(r => `${r.method} ${r.url.replace('https://api.raindrop.io/rest/v1', '')}`);

    // Check calls
    try {
        assert(calls.includes('GET /collections'), 'Should fetch collections');
        assert(calls.includes('GET /raindrops/123?page=0&perpage=50'), 'Should fetch items in folder');
        assert(calls.includes('PUT /raindrop/10'), 'Should move bookmark');
        assert(calls.includes('DELETE /collection/123'), 'Should delete empty folder');

        // Verify Move Payload
        const moveReq = apiRequests.find(r => r.method === 'PUT' && r.url.includes('/raindrop/10'));
        assert.deepStrictEqual(moveReq.data, { collection: { $id: -1 } });

        console.log('✅ Flatten Mode logic verified');
    } catch (e) {
        console.error('❌ Flatten Mode Failed:', e.message);
        console.log('Actual Calls:', calls);
        process.exit(1);
    }
}

async function testPruneTags() {
    console.log('\n[Test] Prune Tags');
    apiRequests.length = 0; // Clear
    apiResponses.length = 0;

    getOrCreateElement('ras-action-mode').value = 'prune_tags';
    global.STATE.config.minTagCount = 5;

    // Queue
    apiResponses.push({
        // 1. getAllTags
        body: { items: [
            { _id: 'keep_me', count: 10 },
            { _id: 'delete_me', count: 2 }
        ]}
    });
    apiResponses.push({
        // 2. removeTagsBatch -> DELETE /tags
        body: {}
    });

    await global.runMainProcess();

    try {
        const deleteReq = apiRequests.find(r => r.method === 'DELETE' && r.url.includes('/tags'));
        assert(deleteReq, 'Should make DELETE request');
        // Updated expectation: use 'tags' instead of 'ids'
        assert.deepStrictEqual(deleteReq.data, { tags: ['delete_me'] });
        console.log('✅ Prune Tags logic verified');
    } catch (e) {
        console.error('❌ Prune Tags Failed:', e.message);
        console.log('Requests:', apiRequests);
        process.exit(1);
    }
}

async function testCleanupTags() {
    console.log('\n[Test] Cleanup Tags (Merge)');
    apiRequests.length = 0;
    apiResponses.length = 0;

    getOrCreateElement('ras-action-mode').value = 'cleanup_tags';
    global.STATE.config.openaiKey = 'mock-key';

    // 1. getAllTags
    apiResponses.push({
        body: { items: [
            { _id: 'bad', count: 1 },
            { _id: 'good', count: 10 }
        ]}
    });

    // 2. LLM Call (analyzeTagConsolidation)
    apiResponses.push({
        body: {
            choices: [{
                message: { content: JSON.stringify({ "bad": "good" }) }
            }]
        }
    });

    // 3. mergeTags(['bad'], 'good') -> PUT /tags/0
    apiResponses.push({ body: {} });

    await global.runMainProcess();

    try {
        const mergeReq = apiRequests.find(r => r.method === 'PUT' && r.url.includes('/tags/0'));
        assert(mergeReq, 'Should call merge tags endpoint');
        assert.deepStrictEqual(mergeReq.data, { tags: ['bad'], replace: 'good' });
        console.log('✅ Cleanup Tags logic verified');
    } catch (e) {
        console.error('❌ Cleanup Tags Failed:', e.message);
        console.log('Requests:', apiRequests.map(r => `${r.method} ${r.url}`));
        process.exit(1);
    }
}

async function testOrganizeExisting() {
    console.log('\n[Test] Organize (Existing Folders)');
    apiRequests.length = 0;
    apiResponses.length = 0;

    // Config
    getOrCreateElement('ras-action-mode').value = 'organize_existing';
    getOrCreateElement('ras-collection-select').value = '0'; // All/Unsorted
    global.STATE.config.openaiKey = 'mock-key';

    // Sequence of Requests:
    // 1. loadCollectionCache -> GET /collections
    apiResponses.push({
        body: { items: [
            { _id: 100, title: 'Programming' },
            { _id: 200, title: 'Cooking' }
        ]}
    });

    // 2. getBookmarks(0, 0) -> GET /raindrops/0
    apiResponses.push({
        body: { items: [
            { _id: 50, title: 'Learn React', excerpt: 'JS Lib', link: 'http://react.dev', collection: { $id: -1 } }
        ]}
    });

    // 3. LLM Call -> POST OpenAI
    apiResponses.push({
        body: {
            choices: [{
                message: { content: JSON.stringify({ category: 'Programming' }) }
            }]
        }
    });

    // 4. moveBookmark(50, 100) -> PUT /raindrop/50
    apiResponses.push({ body: { item: { _id: 50 } } });

    // 5. getBookmarks(0, 1) -> GET /raindrops/0 (Next page)
    apiResponses.push({ body: { items: [] } });

    await global.runMainProcess();

    try {
        const calls = apiRequests.map(r => `${r.method} ${r.url}`);

        // Verify Move
        const moveReq = apiRequests.find(r => r.method === 'PUT' && r.url.includes('/raindrop/50'));
        assert(moveReq, 'Should move bookmark 50');
        assert.deepStrictEqual(moveReq.data, { collection: { $id: 100 } });

        // Verify LLM Call
        const llmReq = apiRequests.find(r => r.url.includes('api.openai.com'));
        assert(llmReq, 'Should call OpenAI');

        console.log('✅ Organize Existing logic verified');
    } catch (e) {
        console.error('❌ Organize Existing Failed:', e.message);
        console.log('Requests:', apiRequests.map(r => r.url));
        process.exit(1);
    }
}

async function testDeduplicate() {
    console.log('\n[Test] Deduplicate');
    apiRequests.length = 0;
    apiResponses.length = 0;

    getOrCreateElement('ras-action-mode').value = 'deduplicate';
    global.STATE.config.reviewClusters = false; // Auto-delete for test
    global.STATE.config.dryRun = false;
    global.STATE.config.semanticDedupe = false; // Just test exact URL

    // 1. getBookmarks
    apiResponses.push({
        body: { items: [
            { _id: 1, title: 'Doc A', link: 'https://example.com/doc' },
            { _id: 2, title: 'Doc A Copy', link: 'https://example.com/doc#' },
            { _id: 3, title: 'Doc A Copy 2', link: 'https://example.com/doc/' }
        ]}
    });
    // 2. getBookmarks (empty page)
    apiResponses.push({ body: { items: [] } });

    // 3 & 4. deletes for item 2 and 3
    apiResponses.push({ body: {} });
    apiResponses.push({ body: {} });

    await global.runMainProcess();

    try {
        const deletes = apiRequests.filter(r => r.method === 'DELETE');
        assert.strictEqual(deletes.length, 2, 'Should delete two duplicates');
        assert(deletes.find(r => r.url.includes('/raindrop/2')), 'Should delete ID 2');
        assert(deletes.find(r => r.url.includes('/raindrop/3')), 'Should delete ID 3');
        console.log('✅ Deduplicate logic verified');
    } catch (e) {
        console.error('❌ Deduplicate Failed:', e.message);
        process.exit(1);
    }
}

async function testApplyMacros() {
    console.log('\n[Test] Apply Macros');
    apiRequests.length = 0;
    apiResponses.length = 0;

    getOrCreateElement('ras-action-mode').value = 'apply_macros';
    global.STATE.config.dryRun = false;

    // Setup Macro
    global.GM_getValue = (k, def) => {
        if (k === 'macros') return [{
            id: 'm1', condition: 'domain_is', conditionValue: 'github.com',
            action: 'add_tag', actionValue: 'code'
        }];
        return def;
    };

    // 1. loadCollectionCache (skipped because no move_to action)

    // 2. getBookmarks
    apiResponses.push({
        body: { items: [
            { _id: 10, title: 'Repo', link: 'https://github.com/user/repo', tags: [] },
            { _id: 20, title: 'Video', link: 'https://youtube.com/video', tags: [] }
        ]}
    });
    // 3. getBookmarks empty
    apiResponses.push({ body: { items: [] } });

    // 4. Update Bookmark
    apiResponses.push({ body: {} });

    await global.runMainProcess();

    try {
        const updates = apiRequests.filter(r => r.method === 'PUT');
        assert.strictEqual(updates.length, 1, 'Should update exactly one item');
        assert(updates[0].url.includes('/raindrop/10'), 'Should update ID 10');
        assert.deepStrictEqual(updates[0].data.tags, ['code'], 'Should add "code" tag');
        console.log('✅ Apply Macros logic verified');
    } catch (e) {
        console.error('❌ Apply Macros Failed:', e.message);
        process.exit(1);
    } finally {
        global.GM_getValue = (k, v) => v; // reset mock
    }
}

(async () => {
    try {
        await testFlattenMode();
        await testPruneTags();
        await testCleanupTags();
        await testOrganizeExisting();
        await testDeduplicate();
        await testApplyMacros();
        console.log('\n🎉 All Logic Tests Passed');
    } catch (e) {
        console.error('Test Suite Failed:', e);
        process.exit(1);
    }
})();
