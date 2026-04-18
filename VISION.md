# Raindrop AI Sorter - Project Vision

## The Ultimate Goal
Raindrop AI Sorter ("The Sentinel") aims to be the definitive autonomous organization layer for personal knowledge management (PKM). It transforms a chaotic, unsorted collection of bookmarks into a beautifully structured, semantically linked, and effortlessly accessible library.

## Core Philosophy
1. **Zero-Friction Ingestion:** Users should be able to save anything, anytime, without worrying about categorization. "The Sentinel" handles the cognitive load of filing.
2. **Offline-First Privacy:** By leveraging local embeddings (`all-MiniLM-L6-v2`) and client-side processing, the system respects user privacy while maintaining powerful AI capabilities. External LLMs are strictly optional and fallback mechanisms.
3. **Transparent Automation:** AI should assist, not override. The system uses "Safe Mode" and requires review for destructive actions or large-scale restructuring.
4. **Continuous Operation:** Through background polling (`chrome.alarms`), the library remains pristine even when the user is not actively managing it.
5. **Universal Portability:** Rules, macros, and configurations must be easily exportable and robust, preventing lock-in and ensuring data safety.

## Architectural Pillars
- **Web Extension (Manifest V3):** Replaces legacy userscripts for deeper integration, background processing, and modern web standards.
- **Componentized UI:** Built with Vite and Preact for a snappy, modular, and maintainable user interface.
- **Intelligent Fallbacks:** Graceful degradation from local models to remote APIs (OpenAI, Anthropic, DeepSeek) ensuring continuous functionality regardless of network state or API limits.
