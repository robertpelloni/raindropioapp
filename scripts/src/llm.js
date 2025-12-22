    // LLM Client
    class LLMClient {
        constructor(config, network) {
            this.config = config;
            this.network = network || new NetworkClient();
        }

        async generateTags(content, existingTags = []) {
            let prompt = this.config.taggingPrompt;
            const ignoredTags = this.config.ignoredTags || "";
            const autoDescribe = this.config.autoDescribe;
            const descriptionPrompt = this.config.descriptionPrompt || "Summarize the content in 1-2 concise sentences.";
            const maxTags = this.config.maxTags || 5;

            if (!prompt || prompt.trim() === '') {
                 prompt = `
                    Analyze the following web page content.

                    Task 1: Suggest ${maxTags} broad, high-level tags.
                    ${autoDescribe ? 'Task 2: ' + descriptionPrompt : ''}

                    Rules:
                    - Tags should be broad categories (e.g. "Technology", "Health", "Finance") rather than ultra-specific keywords.
                    - Limit to exactly ${maxTags} tags.
                    - Avoid using these tags: {{IGNORED_TAGS}}

                    Output ONLY a JSON object with the following structure:
                    {
                        "tags": ["tag1", "tag2"],
                        ${autoDescribe ? '"description": "The summary string"' : ''}
                    }

                    No markdown, no explanation.

                    Content:
                    {{CONTENT}}
                `;
            }

            // Replace placeholder
            prompt = prompt.replace('{{CONTENT}}', content.substring(0, 4000));
            prompt = prompt.replace('{{IGNORED_TAGS}}', ignoredTags);

            // Fallback if user didn't include {{CONTENT}}
            if (!prompt.includes(content.substring(0, 100))) {
                 prompt += `\n\nContent:\n${content.substring(0, 4000)}`;
            }

            let result = null;
            try {
                if (this.config.provider === 'openai') {
                    result = await this.callOpenAI(prompt, true);
                } else if (this.config.provider === 'anthropic') {
                    result = await this.callAnthropic(prompt, true);
                } else if (this.config.provider === 'groq') {
                    result = await this.callGroq(prompt, true);
                } else if (this.config.provider === 'deepseek') {
                    result = await this.callDeepSeek(prompt, true);
                } else if (this.config.provider === 'custom') {
                    result = await this.callOpenAI(prompt, true, true);
                }
            } catch (e) {
                console.error("LLM Generation Error:", e);
                return { tags: [], description: null };
            }

            // Normalize result
            if (Array.isArray(result)) {
                return { tags: result.slice(0, maxTags), description: null };
            } else if (result && result.tags) {
                result.tags = result.tags.slice(0, maxTags);
                return result;
            } else {
                return { tags: [], description: null };
            }
        }

        async clusterTags(allTags) {
             let prompt = this.config.clusteringPrompt;
             const allowNested = this.config.nestedCollections;

             // Safeguard: Limit tags to prevent context overflow if list is huge
             const MAX_TAGS_FOR_CLUSTERING = 200; // Reduced from 500 to prevent LLM output truncation
             let tagsToProcess = allTags;
             if (allTags.length > MAX_TAGS_FOR_CLUSTERING) {
                 console.warn(`[RAS] Too many tags (${allTags.length}). Truncating to ${MAX_TAGS_FOR_CLUSTERING} for clustering.`);
                 tagsToProcess = allTags.slice(0, MAX_TAGS_FOR_CLUSTERING);
             }

             if (!prompt || prompt.trim() === '') {
                 prompt = `
                    Analyze this list of tags and group them into 5-10 broad categories.
                    ${allowNested ? 'You may use nested categories separated by ">" (e.g. "Development > Web").' : ''}
                    Output ONLY a JSON object where keys are category names and values are arrays of tags.
                    Do not add any markdown formatting or explanation. Just the JSON.
                    e.g. { "Programming": ["python", "js"], "News": ["politics"] }

                    Tags:
                    {{TAGS}}
                `;
             }

             prompt = prompt.replace('{{TAGS}}', JSON.stringify(tagsToProcess));

             // Fallback
             if (!prompt.includes(tagsToProcess[0])) {
                  prompt += `\n\nTags:\n${JSON.stringify(tagsToProcess)}`;
             }

             if (this.config.provider === 'openai') return await this.callOpenAI(prompt, true);
             if (this.config.provider === 'anthropic') return await this.callAnthropic(prompt, true);
             if (this.config.provider === 'groq') return await this.callGroq(prompt, true);
             if (this.config.provider === 'deepseek') return await this.callDeepSeek(prompt, true);
             if (this.config.provider === 'custom') return await this.callOpenAI(prompt, true, true);
             return {};
        }

        async classifyBookmarkIntoExisting(bookmark, collectionNames) {
            const prompt = `
                Classify the following bookmark into exactly ONE of the provided categories.

                Bookmark:
                Title: ${bookmark.title}
                Excerpt: ${bookmark.excerpt}
                URL: ${bookmark.link}

                Categories:
                ${JSON.stringify(collectionNames)}

                Output ONLY a JSON object: { "category": "Exact Category Name" }
                If no category fits well, return null for category.
            `;

            if (this.config.provider === 'anthropic') return await this.callAnthropic(prompt, true);
            if (this.config.provider === 'groq') return await this.callGroq(prompt, true);
            if (this.config.provider === 'deepseek') return await this.callDeepSeek(prompt, true);
            return await this.callOpenAI(prompt, true, this.config.provider === 'custom');
        }

        async analyzeTagConsolidation(allTags) {
            const prompt = `
                Analyze this list of tags and identify synonyms, typos, or duplicates.
                Create a mapping where the key is the "Bad/Deprecated" tag and the value is the "Canonical/Good" tag.

                Rules:
                1. Only include pairs where a merge is necessary (synonyms, typos, plurals).
                2. Do NOT map a tag to itself (e.g. "AI": "AI" is forbidden).
                3. Do NOT merge distinct concepts (e.g. "Java" and "JavaScript" are different).
                4. Be conservative. If unsure, do not include it.

                Example: { "js": "javascript", "reactjs": "react", "machine-learning": "ai" }

                Tags:
                ${JSON.stringify(allTags.slice(0, 1000))}
            `;

            if (this.config.provider === 'anthropic') return await this.callAnthropic(prompt, true);
            if (this.config.provider === 'groq') return await this.callGroq(prompt, true);
            if (this.config.provider === 'deepseek') return await this.callDeepSeek(prompt, true);
            return await this.callOpenAI(prompt, true, this.config.provider === 'custom');
        }

        repairJSON(jsonStr) {
            let cleaned = jsonStr.trim();
            if (!cleaned) return "{}";

            const firstBrace = cleaned.indexOf('{');
            const firstBracket = cleaned.indexOf('[');

            if (firstBrace === -1 && firstBracket === -1) return "{}";

            let isObject = false;
            if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
                isObject = true;
                cleaned = cleaned.substring(firstBrace);
            } else {
                cleaned = cleaned.substring(firstBracket);
            }

            try {
                JSON.parse(cleaned);
                return cleaned;
            } catch(e) {}

            // Smart Repair
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

            let repaired = cleaned;
            if (inString) repaired += '"';
            while (stack.length > 0) {
                repaired += stack.pop();
            }

            try {
                JSON.parse(repaired);
                return repaired;
            } catch(e) {}

            // Fallback
            const lastComma = cleaned.lastIndexOf(',');
            if (lastComma > 0) {
                let truncated = cleaned.substring(0, lastComma);
                stack = [];
                inString = false;
                escape = false;

                for (let i = 0; i < truncated.length; i++) {
                    const char = truncated[i];
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

                while (stack.length > 0) {
                    truncated += stack.pop();
                }
                return truncated;
            }

            return isObject ? "{}" : "[]";
        }

        async callGroq(prompt, isObject = false) {
            return this.callOpenAICompatible(prompt, isObject, 'https://api.groq.com/openai/v1', this.config.groqKey, 'llama3-70b-8192');
        }

        async callDeepSeek(prompt, isObject = false) {
            return this.callOpenAICompatible(prompt, isObject, 'https://api.deepseek.com', this.config.deepseekKey, 'deepseek-chat');
        }

        async callOpenAI(prompt, isObject = false, isCustom = false) {
             if (isCustom) {
                 return this.callOpenAICompatible(prompt, isObject, this.config.customBaseUrl, null, this.config.customModel);
             }
             return this.callOpenAICompatible(prompt, isObject, 'https://api.openai.com/v1', this.config.openaiKey, 'gpt-3.5-turbo');
        }

        async callOpenAICompatible(prompt, isObject, baseUrl, key, model) {
             const url = baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`;
             const headers = { 'Content-Type': 'application/json' };

             if (key) {
                 headers['Authorization'] = `Bearer ${key}`;
             }

             updateTokenStats(prompt.length, 0); // Track input

             return this.fetchWithRetry(url, {
                method: 'POST',
                headers: headers,
                data: JSON.stringify({
                    model: model || 'gpt-3.5-turbo',
                    messages: [{role: 'user', content: prompt}],
                    temperature: 0.3,
                    stream: false,
                    max_tokens: 4096
                }),
                signal: STATE.abortController ? STATE.abortController.signal : null
             }).then(data => {
                 if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
                 if (!data.choices || !data.choices[0]) throw new Error('Invalid API response');

                 const text = data.choices[0].message.content.trim();
                 updateTokenStats(0, text.length); // Track output

                 if (STATE.config.debugMode) {
                     console.log('[LLM Raw Response]', text);
                 }

                 // Robust JSON extraction
                 let cleanText = text.replace(/```json/g, '').replace(/```/g, '');
                 const firstBrace = cleanText.indexOf('{');
                 if (firstBrace !== -1) {
                     cleanText = cleanText.substring(firstBrace);
                 }

                 try {
                     return JSON.parse(cleanText);
                 } catch(e) {
                     console.warn('JSON Parse failed. Attempting repair...');
                     const repaired = this.repairJSON(cleanText);
                     if (STATE.config.debugMode) console.log('[Repaired JSON]', repaired);
                     return JSON.parse(repaired);
                 }
             }).catch(e => {
                 console.error('LLM Error', e);
                 throw e;
             });
        }

        async fetchWithRetry(url, options, retries = 3, delay = 2000) {
            return new Promise((resolve, reject) => {
                const makeRequest = async (attempt) => {
                    if (options.signal && options.signal.aborted) return reject(new Error('Aborted'));

                    try {
                        const response = await this.network.request(url, options);

                        if (response.status === 429) {
                            const waitTime = 5000 * attempt;
                            console.warn(`[LLM API] Rate Limit 429. Waiting ${waitTime/1000}s...`);
                            if (attempt <= retries + 2) {
                                setTimeout(() => makeRequest(attempt + 1), waitTime);
                                return;
                            }
                        }

                        if (response.status >= 200 && response.status < 300) {
                            try {
                                resolve(JSON.parse(response.responseText));
                            } catch (e) {
                                reject(new Error('Failed to parse JSON response'));
                            }
                        } else if (response.status >= 500 && attempt <= retries) {
                            const backoff = delay * Math.pow(2, attempt - 1);
                            setTimeout(() => makeRequest(attempt + 1), backoff);
                        } else {
                            reject(new Error(`API Error ${response.status}: ${response.responseText}`));
                        }
                    } catch (error) {
                        if (error.message === 'Aborted') return reject(error);
                        if (attempt <= retries) {
                            setTimeout(() => makeRequest(attempt + 1), delay * attempt);
                        } else {
                            reject(error);
                        }
                    }
                };
                makeRequest(1);
            });
        }

        async callAnthropic(prompt, isObject = false) {
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

                            if (STATE.config.debugMode) {
                                console.log('[LLM Raw Response]', text);
                            }

                            let cleanText = text.replace(/```json/g, '').replace(/```/g, '');
                            const firstBrace = cleanText.indexOf('{');
                            if (firstBrace !== -1) {
                                cleanText = cleanText.substring(firstBrace);
                            }

                            try {
                                resolve(JSON.parse(cleanText));
                            } catch (e) {
                                console.warn('JSON Parse failed. Attempting repair...');
                                const repaired = this.repairJSON(cleanText);
                                resolve(JSON.parse(repaired));
                            }
                        } catch (e) {
                             console.error('Anthropic Error', e, response.responseText);
                             reject(e); // Propagate error
                        }
                    }).catch(reject);
            });
        }
    }
