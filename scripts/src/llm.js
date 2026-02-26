    class LLMClient {
        constructor(config, network) {
            this.config = config;
            this.network = network;
        }

        async generateTags(content, existingTags = [], imageUrl = null) {
            let prompt = this.config.taggingPrompt;
            if (!prompt.includes('{{CONTENT}}')) {
                prompt += '\n\nContent:\n{{CONTENT}}';
            }
            prompt = prompt.replace('{{CONTENT}}', content.substring(0, 8000)); // Limit context

            if (existingTags && existingTags.length > 0) {
                prompt += `\n\nExisting Tags: ${existingTags.join(', ')}`;
            }

            // Add Max Tags instruction if not present
            if (!prompt.includes('max tags')) {
                prompt += `\n\nLimit to ${this.config.maxTags} relevant tags.`;
            }

            if (this.config.autoDescribe) {
                 prompt += `\n\nAlso provide a short description (max 200 chars) in the JSON field "description".`;
            }

            prompt += `\n\nOutput ONLY valid JSON: { "tags": ["tag1", "tag2"], "description": "..." }`;

            // Vision
            if (imageUrl && this.config.useVision && (this.config.provider === 'openai' || this.config.provider === 'anthropic')) {
                 // Vision logic requires different payload structure
                 // For now, simplify to text-only if complex
                 // Or implement vision payload construction here
            }

            return await this.callLLM(prompt, true);
        }

        async clusterTags(tags) {
            let prompt = this.config.clusteringPrompt;
            if (!prompt.includes('{{TAGS}}')) {
                prompt += '\n\nTags:\n{{TAGS}}';
            }
            prompt = prompt.replace('{{TAGS}}', JSON.stringify(tags));
            prompt += `\n\nGroup these tags into semantic categories. Output ONLY valid JSON: { "Category Name": ["tag1", "tag2"] }`;

            return await this.callLLM(prompt, true);
        }

        async analyzeTagConsolidation(tags) {
             let prompt = `
                Analyze the following list of tags and identify duplicates, synonyms, or very similar tags that should be merged.
                Tags: ${JSON.stringify(tags)}

                Return a JSON object where the key is the "bad" tag (to be removed) and the value is the "good" tag (to keep).
                Example: { "js": "javascript", "reactjs": "react" }
                Strictly avoid identity mappings (e.g. "tag": "tag").
                Output ONLY valid JSON.
             `;
             return await this.callLLM(prompt, true);
        }

        async classifyBookmarkSemantic(bookmark, existingPaths) {
            let prompt = `
                Classify the bookmark into a folder structure based on its content.
                Bookmark:
                Title: ${bookmark.title}
                Excerpt: ${bookmark.excerpt}
                URL: ${bookmark.link}
                Tags: ${bookmark.tags.join(', ')}

                Existing Folder Paths:
                ${existingPaths.join('\n')}

                Choose the best existing path or suggest a new one.
                Output ONLY valid JSON: { "path": "Folder > Subfolder" }
            `;
            return await this.callLLM(prompt, true);
        }

        async classifyBookmarkIntoExisting(bookmark, collectionNames, smartContext = false) {
            let prompt = this.config.classificationPrompt || "";

            // Build Smart Context
            let contextExamples = "";
            if (smartContext && typeof RuleEngine !== 'undefined') {
                const rules = RuleEngine.getRules();
                // Filter for move rules or similar?
                // Logic.js passes 'items' which are { bm, category }.
                // RuleEngine usually maps Source -> Target.
                // For semantic move, source might be unclear.
                // But if we are in Organize Mode, maybe we rule by URL domain? Or just ignore?
                // Let's assume this is mostly for Tag Merges (waitForTagCleanupReview).
                // For Folder moves, maybe we don't save rules yet?
                // Actually, RuleEngine could store "move_bookmark" rules?
                // For now, let's just use tag rules if they help? No.
                // Let's skip smart context for folders for now if RuleEngine doesn't support it robustly.
            }

            if (!prompt || prompt.trim() === '') {
                prompt = `
                    Classify the following bookmark into exactly ONE of the provided categories.

                    Bookmark:
                    {{BOOKMARK}}

                    Categories:
                    {{CATEGORIES}}
                    ${contextExamples}

                    Output ONLY a JSON object: { "category": "Exact Category Name" }
                    If no category fits well, return null for category.
                `;
            }

            const bookmarkDetails = `Title: ${bookmark.title}\nExcerpt: ${bookmark.excerpt}\nURL: ${bookmark.link}\nTags: ${bookmark.tags ? bookmark.tags.join(', ') : 'none'}`;
            prompt = prompt.replace('{{BOOKMARK}}', bookmarkDetails);
            prompt = prompt.replace('{{CATEGORIES}}', JSON.stringify(collectionNames));

            if (contextExamples && !prompt.includes(contextExamples.trim())) {
                prompt += `\n\n${contextExamples}`;
            }

            return await this.callLLM(prompt, true);
        }

        async summarizeContent(title, content) {
            let prompt = `
                Summarize the following content into a concise paragraph (max 3 sentences).
                Title: ${title}
                Content: ${content.substring(0, 10000)}

                Output ONLY the summary text.
            `;
            return await this.callLLM(prompt, false); // Expect string
        }

        async callLLM(prompt, expectJson = false) {
            if (this.config.provider === 'openai') return await this.callOpenAI(prompt, expectJson);
            if (this.config.provider === 'anthropic') return await this.callAnthropic(prompt, expectJson);
            if (this.config.provider === 'groq') return await this.callGroq(prompt, expectJson);
            if (this.config.provider === 'deepseek') return await this.callDeepSeek(prompt, expectJson);
            if (this.config.provider === 'custom') return await this.callCustom(prompt, expectJson);
            throw new Error('Unknown provider');
        }

        // Provider Implementations (Simplified for recovery)
        async callOpenAI(prompt, expectJson, isCustom = false) {
             const baseUrl = isCustom ? this.config.customBaseUrl : 'https://api.openai.com/v1';
             const key = isCustom ? null : this.config.openaiKey;
             const model = isCustom ? this.config.customModel : 'gpt-4o-mini'; // Default to mini for cost

             return this.callOpenAICompatible(prompt, expectJson, baseUrl, key, model);
        }

        async callGroq(prompt, expectJson) {
            return this.callOpenAICompatible(prompt, expectJson, 'https://api.groq.com/openai/v1', this.config.groqKey, 'llama3-70b-8192');
        }

        async callDeepSeek(prompt, expectJson) {
            return this.callOpenAICompatible(prompt, expectJson, 'https://api.deepseek.com', this.config.deepseekKey, 'deepseek-chat');
        }

        async callCustom(prompt, expectJson) {
            return this.callOpenAICompatible(prompt, expectJson, this.config.customBaseUrl, null, this.config.customModel);
        }

        async callAnthropic(prompt, expectJson) {
             updateTokenStats(prompt.length, 0);
             return new Promise((resolve, reject) => {
                const options = {
                    method: 'POST',
                    headers: {
                        'x-api-key': this.config.anthropicKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({
                        model: 'claude-3-haiku-20240307',
                        max_tokens: 1024,
                        messages: [{role: 'user', content: prompt}]
                    }),
                    signal: STATE.abortController ? STATE.abortController.signal : null
                };

                this.network.request('https://api.anthropic.com/v1/messages', options).then(response => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.error) throw new Error(data.error.message);
                            const text = data.content[0].text.trim();
                            updateTokenStats(0, text.length);

                            if (this.config.debugMode) {
                                console.log('[LLM Raw Response]', text);
                            }

                            if (expectJson) {
                                const cleanText = this.extractJSON(text);
                                try {
                                    resolve(JSON.parse(cleanText));
                                } catch (e) {
                                    console.warn('JSON Parse failed. Attempting repair...');
                                    const repaired = this.repairJSON(cleanText);
                                    resolve(JSON.parse(repaired));
                                }
                            } else {
                                resolve(text);
                            }
                        } catch (e) {
                             console.error('Anthropic Error', e, response.responseText);
                             reject(e);
                        }
                    }).catch(reject);
            });
        }

        async callOpenAICompatible(prompt, expectJson, baseUrl, key, model) {
             const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
             const headers = { 'Content-Type': 'application/json' };

             if (key) {
                 headers['Authorization'] = `Bearer ${key}`;
             }

             updateTokenStats(prompt.length, 0);

             return new Promise((resolve, reject) => {
                 this.network.request(url, {
                    method: 'POST',
                    headers: headers,
                    data: JSON.stringify({
                        model: model || 'gpt-3.5-turbo',
                        messages: [{role: 'user', content: prompt}],
                        temperature: 0.3,
                        stream: false
                    }),
                    signal: STATE.abortController ? STATE.abortController.signal : null
                 }).then(data => {
                     try {
                         const response = JSON.parse(data.responseText);
                         if (response.error) throw new Error(response.error.message || JSON.stringify(response.error));
                         if (!response.choices || !response.choices[0]) throw new Error('Invalid API response');

                         const text = response.choices[0].message.content.trim();
                         updateTokenStats(0, text.length);

                         if (this.config.debugMode) {
                             console.log('[LLM Raw Response]', text);
                         }

                         if (expectJson) {
                             const cleanText = this.extractJSON(text);
                             try {
                                 resolve(JSON.parse(cleanText));
                             } catch(e) {
                                 console.warn('JSON Parse failed. Attempting repair...');
                                 const repaired = this.repairJSON(cleanText);
                                 resolve(JSON.parse(repaired));
                             }
                         } else {
                             resolve(text);
                         }
                     } catch(e) {
                         reject(e);
                     }
                 }).catch(reject);
             });
        }

        extractJSON(text) {
             let cleanText = text.replace(/```json/g, '').replace(/```/g, '');
             const firstBrace = cleanText.indexOf('{');
             if (firstBrace !== -1) {
                 cleanText = cleanText.substring(firstBrace);
             }
             const lastBrace = cleanText.lastIndexOf('}');
             if (lastBrace !== -1) {
                 cleanText = cleanText.substring(0, lastBrace + 1);
             }
             return cleanText;
        }

        repairJSON(jsonStr) {
            let cleaned = jsonStr.trim();
            // Remove trailing commas before closing braces
            // Regex to remove , followed by whitespace and } or ]
            cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

            // Try parse first
            try {
                JSON.parse(cleaned);
                return cleaned;
            } catch(e) {}

            // Stack-based repair
            let stack = [];
            let inString = false;
            let escape = false;

            for (let i = 0; i < cleaned.length; i++) {
                const char = cleaned[i];
                if (escape) { escape = false; continue; }
                if (char === '\\') { escape = true; continue; }
                if (char === '"') { inString = !inString; continue; }
                if (!inString) {
                    if (char === '{') stack.push('}');
                    else if (char === '[') stack.push(']');
                    else if (char === '}') stack.pop();
                    else if (char === ']') stack.pop();
                }
            }

            // Close open strings
            if (inString) cleaned += '"';

            // Remove trailing comma if present at the end of the partial string
            // (e.g. `{"a":1,`)
            if (cleaned.trim().endsWith(',')) {
                cleaned = cleaned.trim().slice(0, -1);
            }

            // Close open structures in reverse order
            while (stack.length > 0) {
                cleaned += stack.pop();
            }

            return cleaned;
        }
    }
