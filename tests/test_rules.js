const fs = require('fs');
const assert = require('assert');

// Mock Global Environment
global.GM_getValue = (key, def) => def;
global.GM_setValue = (key, val) => {};
global.window = {};
global.console = console;

// Load Rules
require('../scripts/src/features/rules.js');

console.log('Testing Rules...');
const engine = window.RuleEngine;
assert.ok(engine, 'RuleEngine should be defined');
assert.strictEqual(engine.getRules().length, 0, 'Should start empty');

// Test Add
engine.addRule('move', 'source', 'target');
// Since mock GM_getValue always returns default [], we can't test persistence this way without stateful mock.
// Let's improve the mock for this test.
let store = {};
global.GM_getValue = (k, d) => store[k] || d;
global.GM_setValue = (k, v) => store[k] = v;

engine.addRule('move', 'github.com', 'Dev');
assert.strictEqual(store['automationRules'].length, 1);
assert.strictEqual(store['automationRules'][0].target, 'Dev');

// Test Find
const rule = engine.findRule('move', 'github.com');
assert.ok(rule);
assert.strictEqual(rule.target, 'Dev');

console.log('Rules: PASS');
