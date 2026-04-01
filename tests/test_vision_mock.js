const fs = require('fs');
const path = require('path');
const assert = require('assert');

const scriptPath = path.resolve(__dirname, '../scripts/raindrop_ai_sorter.user.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

console.log('--- Raindrop Vision Test (Mock) ---');

// Mock Globals
global.window = { addEventListener: () => {} };
global.document = { body: { appendChild: () => {} }, getElementById: () => null, createElement: () => ({ style: {} }) };
global.GM_setValue = () => {};
global.GM_getValue = () => {};
global.GM_addStyle = () => {};
global.GM_xmlhttpRequest = () => {};
global.FileReader = class {
    readAsDataURL() { this.onloadend(); }
    get result() { return "data:image/jpeg;base64,mockdata"; }
};

// Spy on Network
const networkRequests = [];
global.GM_xmlhttpRequest = (details) => {
    networkRequests.push(details);
    if (details.url.includes('image')) {
        // Mock Image Response
        if (details.onload) details.onload({ status: 200, response: new ArrayBuffer(8) });
    } else {
        // Mock LLM Response
        if (details.onload) details.onload({
            responseText: JSON.stringify({
                choices: [{ message: { content: JSON.stringify({ tags: ["vision_tag"] }) } }], // OpenAI
                content: [{ text: JSON.stringify({ tags: ["vision_tag"] }) }] // Anthropic
            })
        });
    }
    return { abort: () => {} };
};

// Inject export hook
const exportHook = `
    global.LLMClient = LLMClient;
    global.NetworkClient = NetworkClient;
    global.fetchImageAsBase64 = fetchImageAsBase64;
`;
const hookPoint = "window.addEventListener('load'";
const modifiedContent = scriptContent.replace(hookPoint, `${exportHook}\n${hookPoint}`);
eval(modifiedContent);

async function testVisionPayloads() {
    const config = {
        openaiKey: 'sk-mock',
        anthropicKey: 'sk-ant-mock',
        taggingPrompt: 'Tags',
        maxTags: 5,
        useVision: true,
        debugMode: true
    };
    const network = new global.NetworkClient();
    const llm = new global.LLMClient(config, network);

    // Test OpenAI Vision
    console.log('[Test] OpenAI Vision Payload');
    config.provider = 'openai';
    networkRequests.length = 0;

    await llm.generateTags("Content", [], "http://example.com/image.jpg");

    const openAIRequest = networkRequests.find(r => r.url.includes('api.openai.com'));
    assert(openAIRequest, "Should call OpenAI");
    const bodyOpenAI = JSON.parse(openAIRequest.data);
    const msgOpenAI = bodyOpenAI.messages[0].content;

    assert(Array.isArray(msgOpenAI), "OpenAI content should be array");
    assert(msgOpenAI.find(m => m.type === 'image_url'), "Should have image_url type");
    assert(msgOpenAI.find(m => m.image_url && m.image_url.url && m.image_url.url.startsWith('data:image')), "Should have base64 data");

    // Test Anthropic Vision
    console.log('[Test] Anthropic Vision Payload');
    config.provider = 'anthropic';
    networkRequests.length = 0;

    await llm.generateTags("Content", [], "http://example.com/image.jpg");

    const antRequest = networkRequests.find(r => r.url.includes('api.anthropic.com'));
    assert(antRequest, "Should call Anthropic");
    const bodyAnt = JSON.parse(antRequest.data);
    const msgAnt = bodyAnt.messages[0].content;

    assert(Array.isArray(msgAnt), "Anthropic content should be array");
    assert(msgAnt.find(m => m.type === 'image'), "Should have image type");
    assert(msgAnt.find(m => m.source && m.source.type === 'base64'), "Should use base64 source");

    console.log('✅ Vision payloads verified');
}

testVisionPayloads().catch(e => {
    console.error('❌ Test Failed:', e);
    process.exit(1);
});
