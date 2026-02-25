const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const ROOT_DIR = path.join(__dirname, '..');
const OUT_FILE = path.join(__dirname, 'raindrop_ai_sorter.user.js');
const VERSION_FILE = path.join(ROOT_DIR, 'VERSION');

const FILES = [
    'header.js',
    'state.js',
    'utils.js',
    'network.js',
    'api.js',
    'llm.js',
    'i18n.js',
    'ui.js',
    'logic.js',
    'index.js'
];

function getVersion() {
    try {
        if (fs.existsSync(VERSION_FILE)) {
            return fs.readFileSync(VERSION_FILE, 'utf8').trim();
        }
    } catch(e) {
        console.warn('Could not read VERSION file');
    }
    return '1.0.0';
}

function build() {
    console.log('Building userscript...');
    const version = getVersion();
    console.log(`Version: ${version}`);

    let output = '';

    try {
        FILES.forEach(file => {
            const filePath = path.join(SRC_DIR, file);
            if (fs.existsSync(filePath)) {
                let content = fs.readFileSync(filePath, 'utf8');

                // Replacements
                content = content.replace(/{{VERSION}}/g, version);

                output += content + '\n\n';
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
