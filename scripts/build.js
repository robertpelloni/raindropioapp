const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const OUT_FILE = path.join(__dirname, 'raindrop_ai_sorter.user.js');

const FILES = [
    'header.js',
    'state.js',
    'utils.js',
    'network.js',
    'api.js',
    'llm.js',
    'ui.js',
    'logic.js',
    'index.js'
];

console.log('Building userscript...');

let output = '';

FILES.forEach(file => {
    const filePath = path.join(SRC_DIR, file);
    if (fs.existsSync(filePath)) {
        console.log(`+ ${file}`);
        output += fs.readFileSync(filePath, 'utf8') + '\n\n';
    } else {
        console.error(`Error: File not found: ${file}`);
        process.exit(1);
    }
});

fs.writeFileSync(OUT_FILE, output);
console.log(`Build complete: ${OUT_FILE}`);
console.log(`Total size: ${(output.length / 1024).toFixed(2)} KB`);
