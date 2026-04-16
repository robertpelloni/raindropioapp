const LocalEmbeddings = {
    pipeline: null,
    extractor: null,
    statusEl: null,

    async init() {
        if (!STATE.config.localEmbeddings) return false;
        if (this.extractor) return true; // already loaded

        // Create a status toast or utilize existing UI
        if(typeof log === 'function') log('Downloading Local AI Model (~22MB). This only happens once...', 'info');

        try {
            // Load Transformers.js from CDN
            await this.loadScript();

            // Configure env to use WASM backend and cache models
            env.allowLocalModels = false;
            env.useBrowserCache = true;

            // Load the feature extraction pipeline (all-MiniLM-L6-v2 is small and fast)
            this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

            if(typeof log === 'function') log('Local AI Model ready.', 'success');
            return true;
        } catch (e) {
            console.error('[LocalEmbeddings] Error loading model:', e);
            if(typeof log === 'function') log('Failed to load Local AI Model.', 'error');
            return false;
        }
    },

    loadScript() {
        return new Promise((resolve, reject) => {
            if (typeof pipeline !== 'undefined') {
                resolve();
                return;
            }
            // Use module import for modern browsers
            import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1').then(module => {
                window.pipeline = module.pipeline;
                window.env = module.env;
                resolve();
            }).catch(e => {
                // Fallback to script tag if module import fails
                const script = document.createElement('script');
                script.type = 'module';
                script.innerHTML = `
                    import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';
                    window.pipeline = pipeline;
                    window.env = env;
                    window.transformersLoaded = true;
                `;
                document.head.appendChild(script);

                // Poll until loaded
                let attempts = 0;
                const check = setInterval(() => {
                    if (typeof pipeline !== 'undefined') {
                        clearInterval(check);
                        resolve();
                    }
                    if (++attempts > 50) {
                        clearInterval(check);
                        reject(new Error('Timeout loading transformers.js'));
                    }
                }, 100);
            });
        });
    },

    async getEmbedding(text) {
        if (!this.extractor) await this.init();
        if (!this.extractor) return null;

        try {
            // Generate embedding (returns a tensor)
            const output = await this.extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);
        } catch(e) {
            console.error('[LocalEmbeddings] Error extracting feature:', e);
            return null;
        }
    },

    // Cosine similarity between two vectors
    similarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
};

if (typeof window !== 'undefined') {
    window.LocalEmbeddings = LocalEmbeddings;
}
