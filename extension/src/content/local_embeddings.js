import { pipeline, env } from '@xenova/transformers';

// Explicitly enable browser cache (IndexedDB) for the models so they aren't re-downloaded
env.useBrowserCache = true;

// Configure Transformers.js to load models from the extension's bundled local directory
// This guarantees offline-first functionality without needing to reach out to HuggingFace
env.allowLocalModels = true;
env.localModelPath = chrome.runtime.getURL('models/');

// Since we're packaging the model, we don't strictly need to fallback to remote
env.allowRemoteModels = false;


export class LocalEmbeddingEngine {
    constructor() {
        this.extractor = null;
        this.loadingPromise = null;
    }

    async init() {
        if (this.extractor) return;
        if (this.loadingPromise) return this.loadingPromise;

        console.log("[RAS] Initializing Local Embeddings model (all-MiniLM-L6-v2) from local extension bundle...");
        this.loadingPromise = new Promise(async (resolve, reject) => {
            try {
                // Feature extraction pipeline
                this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                    progress_callback: (info) => {
                        console.log('[RAS] Downloading model: ' + info.status + ' ' + (info.progress || 0) + '%');
                    }
                });
                console.log("[RAS] Local Embeddings model loaded successfully.");
                resolve();
            } catch (e) {
                console.error("[RAS] Failed to load embeddings model:", e);
                reject(e);
            }
        });

        return this.loadingPromise;
    }

    async getEmbedding(text) {
        await this.init();
        // Generate embedding tensor
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        // Return as a standard float array
        return Array.from(output.data);
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0.0;
        let normA = 0.0;
        let normB = 0.0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
