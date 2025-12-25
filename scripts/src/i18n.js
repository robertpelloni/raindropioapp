const I18N = {
    en: {
        title: "Raindrop AI Sorter",
        dashboard: "Dashboard",
        settings: "Settings",
        prompts: "Prompts",
        help: "Help",
        collection: "Collection",
        mode: "Mode",
        search: "Search Filter",
        start: "Start",
        stop: "Stop",
        tokens: "Tokens",
        cost: "Est",
        tag_only: "Tag Bookmarks Only",
        organize: "Organize (Recursive Clusters)",
        full: "Full (Tag + Organize)",
        org_existing: "Organize (Existing Folders)",
        org_freq: "Organize (Tag Frequency)",
        cleanup: "Cleanup Tags (Deduplicate)",
        prune: "Prune Infrequent Tags",
        flatten: "Flatten Library (Reset)",
        delete_all: "Delete ALL Tags",
        dry_run: "Dry Run",
        safe_mode: "Safe Mode",
        // ... more strings
    },
    current: 'en',

    get(key) {
        return this.en[key] || key;
    }
};
