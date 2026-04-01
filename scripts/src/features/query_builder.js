// The Curator: Advanced Query Builder for Raindrop.io

class QueryBuilder {
    constructor() {
        this.query = [];
    }

    addTerm(key, value, operator = 'AND') {
        this.query.push({ key, value, operator });
    }

    render() {
        return `
            <div id="ras-query-builder" style="border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: #f9f9f9; margin-bottom: 10px;">
                <div style="font-weight:bold; margin-bottom:5px;">Query Builder</div>
                <div id="ras-query-rows">
                    <!-- Rows will be injected here -->
                </div>
                <div style="margin-top:10px;">
                    <button class="ras-btn" style="width:auto; padding: 4px 8px; font-size: 11px;" onclick="window.addQueryRow()">+ Add Condition</button>
                </div>
                <div style="margin-top:10px; border-top: 1px solid #eee; padding-top: 5px;">
                    <span style="font-size:11px; color:#666;">Preview:</span>
                    <code id="ras-query-preview" style="display:block; padding: 5px; background: #fff; border: 1px solid #eee; margin-top: 2px;"></code>
                </div>
            </div>
        `;
    }

    static generateQueryString(rows) {
        // Raindrop Search Syntax:
        // #tag
        // 'phrase'
        // key:val

        let parts = [];
        rows.forEach(row => {
            let part = "";
            const { type, value, operator } = row;

            if (type === 'tag') part = `#${value}`;
            else if (type === 'domain') part = `site:${value}`;
            else if (type === 'title') part = `title:${value}`;
            else if (type === 'content') part = `${value}`; // content search is default
            else if (type === 'status') part = `${value}`; // e.g. match:link

            if (operator === 'NOT') part = `-${part}`;

            parts.push(part);
        });

        return parts.join(' ');
    }
}

// Export for global usage if needed, mostly logic will be in ui.js integration
if (typeof window !== 'undefined') {
    window.QueryBuilder = QueryBuilder;
}
