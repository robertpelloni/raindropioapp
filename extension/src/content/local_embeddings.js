import { pipeline, env } from '@xenova/transformers';

// We disable local model loading for web extensions by default to avoid CORS
// issues on file:// protocol, letting it pull from HF hub, but caching heavily.
env.allowLocalModels = false;

export class LocalEmbeddingEngine {
    constructor() {
        this.extractor = null;
        this.loadingPromise = null;
    }

    async init() {
        if (this.extractor) return;
        if (this.loadingPromise) return this.loadingPromise;

        console.log("[RAS] Initializing Local Embeddings model (all-MiniLM-L6-v2)...");
        this.loadingPromise = new Promise(async (resolve, reject) => {
            try {
                // Feature extraction pipeline
                this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
                    progress_callback: (info) => {
                        console.log(\`[RAS] Downloading model: \${info.status} \${info.progress || 0}%\`);
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
