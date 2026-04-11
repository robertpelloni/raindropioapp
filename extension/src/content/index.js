// Content Script Entry Point
import { NetworkClient } from './network.js';

console.log("Raindrop AI Sorter (Web Extension) Content Script Loaded");

// Initialize test network client to ensure messaging works
const network = new NetworkClient();
network.fetch('https://api.github.com/zen', { method: 'GET' })
    .then(res => res.text())
    .then(text => console.log("[RAS] Background fetch test:", text))
    .catch(e => console.error("[RAS] Background fetch failed:", e));

// Further porting of logic.js, ui.js, llm.js will happen here
