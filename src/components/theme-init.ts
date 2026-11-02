export const themeStorageKey = "recoveryos-theme";

/** Start in light mode unless the visitor explicitly saved a theme choice. */
export const themeInitScript = `(function(){var root=document.documentElement;var preference='light';try{var saved=localStorage.getItem('${themeStorageKey}');if(saved==='light'||saved==='dark')preference=saved;}catch(e){}root.dataset.themePreference=preference;root.dataset.theme=preference;})();`;
