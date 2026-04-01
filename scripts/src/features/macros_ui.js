const MacrosUI = {
    render() {
        return `
            <div id="ras-tab-macros" class="ras-tab-content">
                <p style="font-size:12px; color:var(--ras-text-muted);">
                    Define IF/THEN automation recipes to process bookmarks without AI.
                </p>

                <div id="ras-macros-list" style="margin-bottom: 10px; max-height: 200px; overflow-y: auto; border: 1px solid var(--ras-border); padding: 5px; border-radius: 4px; background: var(--ras-input-bg);">
                    <!-- Macro Items Injected Here -->
                </div>

                <div style="border-top: 1px solid var(--ras-border); padding-top: 10px;">
                    <div style="font-weight:bold; margin-bottom:5px; font-size:12px;">Create New Recipe</div>

                    <div style="display:flex; gap:5px; margin-bottom:5px; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; width:30px;">IF</span>
                        <select id="ras-macro-condition" style="width:100px;">
                            <option value="has_tag">Has Tag</option>
                            <option value="no_tags">Has No Tags</option>
                            <option value="domain_is">Domain Is</option>
                            <option value="title_contains">Title Contains</option>
                        </select>
                        <input type="text" id="ras-macro-cond-val" placeholder="Value..." style="flex:1;">
                    </div>

                    <div style="display:flex; gap:5px; margin-bottom:5px; align-items:center;">
                        <span style="font-size:11px; font-weight:bold; width:30px;">THEN</span>
                        <select id="ras-macro-action" style="width:100px;">
                            <option value="add_tag">Add Tag</option>
                            <option value="remove_tag">Remove Tag</option>
                            <option value="move_to">Move to Folder</option>
                        </select>
                        <input type="text" id="ras-macro-action-val" placeholder="Value (e.g. 'Finance' or '#receipt')..." style="flex:1;">
                    </div>

                    <button id="ras-save-macro-btn" class="ras-btn" style="width:auto; padding:4px 10px; font-size:11px;">Save Recipe</button>
                </div>
            </div>
        `;
    },

    init() {
        this.refreshList();

        document.getElementById('ras-save-macro-btn').addEventListener('click', () => {
            const cond = document.getElementById('ras-macro-condition').value;
            const condVal = document.getElementById('ras-macro-cond-val').value.trim();
            const action = document.getElementById('ras-macro-action').value;
            const actionVal = document.getElementById('ras-macro-action-val').value.trim();

            if (cond !== 'no_tags' && !condVal) {
                alert("Condition value required.");
                return;
            }
            if (!actionVal) {
                alert("Action value required.");
                return;
            }

            const macros = GM_getValue('macros', []);
            macros.push({
                id: Date.now().toString(),
                condition: cond,
                conditionValue: condVal,
                action: action,
                actionValue: actionVal
            });
            GM_setValue('macros', macros);

            // Reset inputs
            document.getElementById('ras-macro-cond-val').value = '';
            document.getElementById('ras-macro-action-val').value = '';

            this.refreshList();
            if(typeof log === 'function') log('Recipe saved.', 'success');
        });
    },

    refreshList() {
        const list = document.getElementById('ras-macros-list');
        if (!list) return;

        const macros = GM_getValue('macros', []);
        list.innerHTML = '';

        if (macros.length === 0) {
            list.innerHTML = '<div style="font-size:11px; color:var(--ras-text-muted); text-align:center; padding:10px;">No recipes defined.</div>';
            return;
        }

        macros.forEach(m => {
            const div = document.createElement('div');
            div.style = "display:flex; justify-content:space-between; align-items:center; padding: 5px; border-bottom: 1px solid var(--ras-border); font-size: 11px;";

            const condText = m.condition === 'no_tags' ? 'Has No Tags' : `${m.condition.replace('_', ' ')} "${m.conditionValue}"`;
            const actText = `${m.action.replace('_', ' ')} "${m.actionValue}"`;

            div.innerHTML = `
                <div style="flex:1;">
                    <span style="font-weight:bold; color:#007aff;">IF</span> ${condText}
                    <span style="font-weight:bold; color:#28a745; margin-left:5px;">THEN</span> ${actText}
                </div>
                <button class="ras-del-macro-btn" data-id="${m.id}" style="background:none; border:none; color:#d32f2f; cursor:pointer;">✖</button>
            `;
            list.appendChild(div);
        });

        document.querySelectorAll('.ras-del-macro-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                let macros = GM_getValue('macros', []);
                macros = macros.filter(m => m.id !== id);
                GM_setValue('macros', macros);
                this.refreshList();
            });
        });
    }
};

if (typeof window !== 'undefined') {
    window.MacrosUI = MacrosUI;
}
