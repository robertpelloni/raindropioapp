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

function build() {
    console.log('Building userscript...');
    let output = '';

    try {
        FILES.forEach(file => {
            const filePath = path.join(SRC_DIR, file);
            if (fs.existsSync(filePath)) {
                // console.log(`+ ${file}`);
                output += fs.readFileSync(filePath, 'utf8') + '\n\n';
            } else {
                throw new Error(`File not found: ${file}`);
            }
        });

        fs.writeFileSync(OUT_FILE, output);
        console.log(`[${new Date().toLocaleTimeString()}] Build complete: ${OUT_FILE} (${(output.length / 1024).toFixed(2)} KB)`);
    } catch (e) {
        console.error('Build failed:', e.message);
    }
}

// Initial Build
build();

// Watch Mode
if (process.argv.includes('--watch')) {
    console.log(`Watching ${SRC_DIR} for changes...`);
    let debounceTimer;

    fs.watch(SRC_DIR, (eventType, filename) => {
        if (!filename) return;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            console.log(`Change detected in ${filename}. Rebuilding...`);
            build();
        }, 100);
    });
}
