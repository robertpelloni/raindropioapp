# Model Weights Directory

To make the extension fully offline capable, download the `onnx` files for `Xenova/all-MiniLM-L6-v2` from HuggingFace and place them here.
Required files:
1. `config.json`
2. `tokenizer_config.json`
3. `tokenizer.json`
4. `vocab.txt`
5. `model.onnx`
6. `model_quantized.onnx`

Alternatively, set `env.allowRemoteModels = true` in `local_embeddings.js` to auto-download on first use.
