const fs = require('fs');
const path = require('path');
const assert = require('assert');

const scriptPath = path.resolve(__dirname, '../scripts/raindrop_ai_sorter.user.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log('--- Raindrop Vision Test ---');

// Mocks
const domElements = new Map();
function getOrCreateElement(id) {
    if (!domElements.has(id)) {
        domElements.set(id, {
            id,
            value: '',
            checked: false,
            style: {},
            textContent: '',
            classList: { add:()=>{}, remove:()=>{}, contains:()=>false },
            addEventListener: ()=>{},
            prepend: ()=>{},
            appendChild: ()=>{}
        });
    }
    return domElements.get(id);
}

global.document = {
    getElementById: (id) => getOrCreateElement(id),
    createElement: () => ({ className: '', style: {} }),
    body: { appendChild: ()=>{} },
    querySelectorAll: () => []
};
global.window = { addEventListener: ()=>{}, location: { href: '' } };
global.confirm = () => true;
global.alert = () => {};
global.GM_setValue = () => {};
global.GM_getValue = (k, v) => v;
global.GM_registerMenuCommand = () => {};
global.GM_addStyle = () => {};

// Mock DOMParser
global.DOMParser = class {
    parseFromString() {
        return {
            querySelectorAll: () => [],
            querySelector: () => null,
            body: { innerText: "Scraped Text Content" },
            title: "Page Title"
        };
    }
};

const apiRequests = [];
const apiResponses = [];

global.GM_xmlhttpRequest = (details) => {
    apiRequests.push({ method: details.method, url: details.url, data: details.data ? JSON.parse(details.data) : null });
    const next = apiResponses.shift();
    if (next) {
        if (details.onload) details.onload({
            status: next.status || 200,
            responseText: typeof next.body === 'string' ? next.body : JSON.stringify(next.body || {}),
            responseHeaders: ''
        });
    } else {
        // console.warn('No response queued for', details.url);
        if (details.onload) details.onload({ status: 404, responseText: '{}' });
    }
    return { abort: ()=>{} };
};

// Inject
const exportHook = `
    global.LLMClient = LLMClient;
    global.RaindropAPI = RaindropAPI;
    global.runMainProcess = runMainProcess;
    global.STATE = STATE;
`;
const hookPoint = "window.addEventListener('load'";
const modifiedContent = scriptContent.replace(hookPoint, `${exportHook}\n${hookPoint}`);
eval(modifiedContent);

async function testVision() {
    console.log('[Test] Vision Support');
    apiRequests.length = 0;
    apiResponses.length = 0;

    global.STATE.config.useVision = true;
    global.STATE.config.provider = 'openai';
    global.STATE.config.openaiKey = 'sk-test';

    // UI Mock
    getOrCreateElement('ras-action-mode').value = 'tag_only';
    getOrCreateElement('ras-collection-select').value = '0';

    // 0. Initial Count Check
    apiResponses.push({ body: { count: 1 } });

    // 1. getBookmarks (Page 0)
    apiResponses.push({
        body: { items: [{ _id: 100, title: "Photo", link: "http://site.com", cover: "http://site.com/img.jpg", tags: [] }] }
    });

    // 2. scrapeUrl
    apiResponses.push({
        status: 200,
        body: "<html><body><p>Some text</p></body></html>"
    });

    // 3. LLM Call
    apiResponses.push({
        body: { choices: [{ message: { content: JSON.stringify({ tags: ["vision-tag"] }) } }] }
    });

    // 4. updateBookmark
    apiResponses.push({ body: {} });

    // 5. getBookmarks (next page)
    apiResponses.push({ body: { items: [] } });

    await global.runMainProcess();

    // Verify
    const llmReq = apiRequests.find(r => r.url && r.url.includes('api.openai.com'));
    assert(llmReq, 'Should call OpenAI');

    const messages = llmReq.data.messages;
    const userMsg = messages.find(m => m.role === 'user');
    assert(Array.isArray(userMsg.content), 'Content should be array for vision');

    const imgPart = userMsg.content.find(c => c.type === 'image_url');
    assert(imgPart, 'Should have image_url part');
    assert.strictEqual(imgPart.image_url.url, "http://site.com/img.jpg");

    console.log('✅ Vision Test Passed');
}

testVision().catch(e => {
    console.error(e);
    process.exit(1);
});
