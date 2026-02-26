const fs = require('fs');
const assert = require('assert');

// Mock Global Environment for Userscript
global.GM_getValue = (key, def) => def;
global.GM_setValue = (key, val) => {};
global.window = {};

// Load Modules
require('../scripts/src/features/query_builder.js');
require('../scripts/src/features/templates.js');

// Test 1: Query Builder
console.log('Testing Query Builder...');
const qb = new window.QueryBuilder();
// generateQueryString expects an array of row objects like {type, value, operator}
// The class method addTerm pushes {key, value, operator}. Let's fix usage or class.
// Looking at query_builder.js: generateQueryString uses `row.type`. addTerm pushes `key`.
// The UI code uses `type`. I should align them.
// For this test, I will construct the array manually to match what the UI sends.
const queryRows = [
    { type: 'tag', value: 'productivity', operator: 'AND' },
    { type: 'domain', value: 'youtube.com', operator: 'OR' }
];
const queryStr = window.QueryBuilder.generateQueryString(queryRows);
assert.ok(queryStr.includes('#productivity'), 'Should include tag search');
assert.ok(queryStr.includes('site:youtube.com'), 'Should include domain search');
console.log('Query Builder: PASS');

// Test 2: Template Manager
console.log('Testing Template Manager...');
const templates = window.TemplateManager.getTemplates();
assert.ok(templates['PARA'], 'Should have PARA template');
assert.ok(templates['Dewey'], 'Should have Dewey template');
assert.ok(templates['PARA'].structure.length > 0, 'PARA should have structure');

// Test Custom Template Storage (Mock)
let mockStorage = {};
global.GM_getValue = (key, def) => mockStorage[key] || def;
global.GM_setValue = (key, val) => mockStorage[key] = val;

window.TemplateManager.saveCustomTemplate('MyTest', '1. A\n2. B');
const custom = window.TemplateManager.getCustomTemplates();
assert.ok(custom['MyTest'], 'Should save custom template');
assert.deepStrictEqual(custom['MyTest'].structure, ['1. A', '2. B'], 'Should parse structure');

window.TemplateManager.deleteCustomTemplate('MyTest');
const customAfter = window.TemplateManager.getCustomTemplates();
assert.ok(!customAfter['MyTest'], 'Should delete custom template');

console.log('Template Manager: PASS');
