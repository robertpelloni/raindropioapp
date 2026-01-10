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
        org_semantic: "Organize (Semantic)",
        org_freq: "Organize (Tag Frequency)",
        cleanup: "Cleanup Tags (Deduplicate)",
        prune: "Prune Infrequent Tags",
        flatten: "Flatten Library (Reset)",
        delete_all: "Delete ALL Tags",
        dry_run: "Dry Run",
        safe_mode: "Safe Mode",
<<<<<<< HEAD
        // ... more strings
=======
        preset_name: "Enter preset name:",
        delete_preset: "Delete preset",
        confirm_delete_preset: "Delete preset \"{{name}}\"?"
>>>>>>> origin/feature/raindrop-ai-sorter-userscript-7272302230095877234
    },
    current: 'en',

    es: {
        title: "Clasificador IA de Raindrop",
        dashboard: "Tablero",
        settings: "Ajustes",
        prompts: "Prompts",
        help: "Ayuda",
        collection: "Colección",
        mode: "Modo",
        search: "Filtro de Búsqueda",
        start: "Iniciar",
        stop: "Detener",
        tag_only: "Solo Etiquetar",
        organize: "Organizar (Clusters)",
        full: "Completo (Etiquetar + Organizar)",
        org_existing: "Organizar (Carpetas Existentes)",
        org_semantic: "Organizar (Semántico)",
        cleanup: "Limpiar Etiquetas",
        prune: "Podar Etiquetas",
        flatten: "Aplanar Librería",
        delete_all: "Borrar TODAS las Etiquetas",
        dry_run: "Simulacro",
<<<<<<< HEAD
        safe_mode: "Modo Seguro"
    },
    current: 'en',
=======
        safe_mode: "Modo Seguro",
        preset_name: "Introduce el nombre del preset:",
        delete_preset: "Borrar preset",
        confirm_delete_preset: "¿Borrar preset \"{{name}}\"?"
    },
>>>>>>> origin/feature/raindrop-ai-sorter-userscript-7272302230095877234

    get(key) {
        const lang = this[this.current] || this.en;
        return lang[key] || this.en[key] || key;
    }
};
