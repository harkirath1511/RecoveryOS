export const themeStorageKey = "recoveryos-theme";

/** Apply a saved preference (or the system theme) before the page paints. */
export const themeInitScript = `(function(){var root=document.documentElement;var preference='system';try{var saved=localStorage.getItem('${themeStorageKey}');if(saved==='light'||saved==='dark')preference=saved;}catch(e){}root.dataset.themePreference=preference;root.dataset.theme=preference==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):preference;})();`;
