import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import webExtension from 'vite-plugin-web-extension';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    preact(),
    webExtension({
      manifest: 'public/manifest.json'
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'EVAL' || warning.message.includes('Use of eval')) return;
        // Suppress ONNX runtime eval() warnings since we can't easily change their pre-compiled dependency
        if (warning.message.includes('Use of eval in') && warning.message.includes('onnxruntime-web')) return;
        warn(warning);
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development'
  }
});
