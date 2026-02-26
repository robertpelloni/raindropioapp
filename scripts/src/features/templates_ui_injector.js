// Templates UI Injector
// Needs to be called after the main UI is created

window.initTemplatesUI = function() {
    // 1. Add Tab Button if not present
    const tabsContainer = document.getElementById('ras-tabs');
    if (tabsContainer && !document.querySelector('[data-tab="templates"]')) {
        const btn = document.createElement('button');
        btn.className = 'ras-tab-btn';
        btn.setAttribute('data-tab', 'templates');
        btn.textContent = 'Templates'; // I18N later if needed

        // Insert before Help or Rules
        const helpBtn = tabsContainer.querySelector('[data-tab="help"]');
        tabsContainer.insertBefore(btn, helpBtn);

        btn.addEventListener('click', () => {
            // Standard tab switching logic
            document.querySelectorAll('.ras-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.ras-tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');

            const tabContent = document.getElementById('ras-tab-templates');
            if(tabContent) {
                tabContent.classList.add('active');
                window.renderTemplatesTab(); // Refresh content
            }
        });
    }

    // 2. Add Tab Content Container if not present
    const bodyContainer = document.getElementById('ras-body');
    if(bodyContainer && !document.getElementById('ras-tab-templates')) {
        const div = document.createElement('div');
        div.id = 'ras-tab-templates';
        div.className = 'ras-tab-content';
        bodyContainer.appendChild(div);

        // Initial Render
        window.renderTemplatesTab();
    }
};

window.renderTemplatesTab = function() {
    const container = document.getElementById('ras-tab-templates');
    if(!container) return;

    // Check if innerHTML needs initialization
    if(container.innerHTML.trim() === '') {
         container.innerHTML = `
            <div style="margin-bottom:10px;">
                <label>Structural Schema</label>
                <select id="ras-template-select" style="width:100%; margin-bottom:5px;">
                    <option value="">None (Free form / Existing)</option>
                </select>
                <p style="font-size:11px; color:#666;" id="ras-template-desc"></p>
            </div>

            <div class="ras-field">
                <label>Preview Structure</label>
                <textarea id="ras-template-preview" rows="8" readonly style="background:#f5f5f5; font-family:monospace; font-size:11px;"></textarea>
            </div>

            <div style="border-top:1px solid #eee; padding-top:10px; margin-top:10px;">
                <label>Create Custom Schema</label>
                <input type="text" id="ras-custom-template-name" placeholder="Name (e.g. My System)" style="margin-bottom:5px;">
                <textarea id="ras-custom-template-body" rows="5" placeholder="Line 1\nLine 2..."></textarea>
                <button id="ras-save-template-btn" class="ras-btn" style="width:auto; margin-top:5px;">Save Template</button>
            </div>
         `;

         // Bind Events
         const sel = document.getElementById('ras-template-select');
         sel.addEventListener('change', () => {
             const val = sel.value;
             if(!val) {
                 document.getElementById('ras-template-desc').textContent = '';
                 document.getElementById('ras-template-preview').value = '';
                 return;
             }

             if(window.TemplateManager) {
                 const builtIn = window.TemplateManager.getTemplates();
                 const custom = window.TemplateManager.getCustomTemplates();

                 let t = builtIn[val] || custom[val];
                 if(t) {
                     document.getElementById('ras-template-desc').textContent = t.description;
                     document.getElementById('ras-template-preview').value = t.structure.join('\n');
                 }
             }
         });

         document.getElementById('ras-save-template-btn').addEventListener('click', () => {
             const name = document.getElementById('ras-custom-template-name').value;
             const body = document.getElementById('ras-custom-template-body').value;
             if(name && body && window.TemplateManager) {
                 window.TemplateManager.saveCustomTemplate(name, body);
                 alert('Template saved.');
                 window.refreshTemplateSelect();
                 // Select it
                 document.getElementById('ras-template-select').value = name;
                 document.getElementById('ras-template-select').dispatchEvent(new Event('change'));
             }
         });

         window.refreshTemplateSelect();
    }
};

window.refreshTemplateSelect = function() {
    const sel = document.getElementById('ras-template-select');
    if(!sel || !window.TemplateManager) return;

    // Save current selection
    const current = sel.value;

    sel.innerHTML = '<option value="">None (Free form / Existing)</option>';

    const builtIn = window.TemplateManager.getTemplates();
    const custom = window.TemplateManager.getCustomTemplates();

    const grp1 = document.createElement('optgroup');
    grp1.label = "Standard";
    Object.keys(builtIn).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.innerText = k;
        grp1.appendChild(opt);
    });
    sel.appendChild(grp1);

    if(Object.keys(custom).length > 0) {
        const grp2 = document.createElement('optgroup');
        grp2.label = "Custom";
        Object.keys(custom).forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.innerText = k;
            grp2.appendChild(opt);
        });
        sel.appendChild(grp2);
    }

    // Restore selection if possible
    if(current) sel.value = current;
};
