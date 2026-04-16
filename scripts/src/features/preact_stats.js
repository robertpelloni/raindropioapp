// Modern Preact Component using HTM (Hyperscript Tagged Markup)
// This serves as the first step towards a full React/Preact rewrite (Roadmap Phase 4).

const PreactStats = {
    loaded: false,

    async init() {
        if (this.loaded) return;

        try {
            await this.loadPreact();
            this.mountComponent();
            this.loaded = true;
        } catch(e) {
            console.error('[PreactStats] Failed to load Preact:', e);
        }
    },

    loadPreact() {
        return new Promise((resolve, reject) => {
            if (typeof preact !== 'undefined' && typeof htm !== 'undefined') {
                resolve();
                return;
            }
            // Use dynamic import for modern modules
            import('https://unpkg.com/htm/preact/standalone.module.js').then(module => {
                window.preact = module.preact || module;
                window.html = module.html;
                window.render = module.render;
                window.useState = module.useState;
                window.useEffect = module.useEffect;
                resolve();
            }).catch(e => reject(e));
        });
    },

    mountComponent() {
        const { html, render, useState, useEffect } = window;
        const I18N = window.I18N; // Global reference

        const StatsBar = () => {
            const [stats, setStats] = useState({ tokens: 0, cost: 0, progress: 0, isRunning: false });

            // Subscribe to state changes from StateManager via CustomEvents (or polling for this PoC)
            useEffect(() => {
                const checkState = () => {
                    if (window.STATE) {
                        let t = 0; let c = 0; let p = 0;
                        if (window.STATE.stats && window.STATE.stats.tokens) {
                            t = window.STATE.stats.tokens.input + window.STATE.stats.tokens.output;
                            c = (window.STATE.stats.tokens.input * 0.0000005) + (window.STATE.stats.tokens.output * 0.0000015);
                        }

                        // Parse progress from the DOM width since we don't have a state var for it yet
                        const pBar = document.getElementById('ras-progress-bar');
                        if (pBar) {
                            p = parseFloat(pBar.style.width) || 0;
                        }

                        setStats({
                            tokens: t,
                            cost: c,
                            progress: p,
                            isRunning: window.STATE.isRunning || false
                        });
                    }
                };

                const interval = setInterval(checkState, 500);
                return () => clearInterval(interval);
            }, []);

            return html`
                <div style="display:flex; flex-direction:column; width:100%; gap: 5px;">
                    ${stats.isRunning || stats.progress > 0 ? html`
                        <div style="background: var(--ras-border); height: 10px; border-radius: 5px; overflow: hidden; width: 100%;">
                            <div style="width: ${stats.progress}%; height: 100%; background: #28a745; transition: width 0.3s;"></div>
                        </div>
                    ` : null}

                    <div id="ras-stats-bar" style="display:flex; justify-content:space-between; font-size:11px; color:var(--ras-text-muted); background:var(--ras-header-bg); padding:5px; border-radius:4px; border: 1px solid var(--ras-border);">
                        <span>${I18N.get('tokens')}: ${(stats.tokens/1000).toFixed(1)}k</span>
                        <span style="font-weight:bold; color: ${stats.cost > 0 ? '#d32f2f' : 'inherit'}">${I18N.get('cost')}: $${stats.cost.toFixed(4)}</span>
                    </div>
                </div>
            `;
        };

        const target = document.getElementById('ras-preact-stats-mount');
        if (target) {
            render(html`<${StatsBar} />`, target);
        }
    }
};

if (typeof window !== 'undefined') {
    window.PreactStats = PreactStats;
}
