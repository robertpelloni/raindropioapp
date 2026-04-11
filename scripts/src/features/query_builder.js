
class QueryBuilder {
    constructor() {
        this.conditions = [];
    }

    addCondition(field, operator, value) {
        this.conditions.push({ field, operator, value });
    }

    removeCondition(index) {
        if (index >= 0 && index < this.conditions.length) {
            this.conditions.splice(index, 1);
        }
    }

    buildQuery() {
        let queryParts = [];
        for (const cond of this.conditions) {
            let part = '';
            // Basic Raindrop search syntax mapping
            if (cond.field === 'tag') {
                part = cond.operator === 'NOT' ? `-tag:"${cond.value}"` : `#"${cond.value}"`;
            } else if (cond.field === 'domain') {
                part = cond.operator === 'NOT' ? `-link:"${cond.value}"` : `link:"${cond.value}"`;
            } else if (cond.field === 'title') {
                part = cond.operator === 'NOT' ? `-"${cond.value}"` : `"${cond.value}"`;
            }
            if (part) queryParts.push(part);
        }
        return queryParts.join(' ');
    }

    getConditions() {
        return this.conditions;
    }
}
// module.exports = QueryBuilder; // Removed for userscript concat
