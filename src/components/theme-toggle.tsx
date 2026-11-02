"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./ui-primitives";
import { themeStorageKey as storageKey } from "./theme-init";

const changeEvent = "recoveryos-theme-change";
type Theme = "light" | "dark";

function subscribe(onChange: () => void) {
  const syncTabs = (event: StorageEvent) => {
    if (event.key !== storageKey && event.key !== null) return;
    const preference: Theme = event.newValue === "dark" ? "dark" : "light";
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.dataset.theme = preference;
    onChange();
  };
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", syncTabs);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", syncTabs);
  };
}

const getSnapshot = (): Theme => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const getServerSnapshot = (): Theme => "light";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dark = theme === "dark";

  function toggle() {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.dataset.themePreference = next;
    try { window.localStorage.setItem(storageKey, next); } catch { /* The in-memory choice still works when storage is unavailable. */ }
    window.dispatchEvent(new Event(changeEvent));
  }

  return <button className="theme-toggle" type="button" onClick={toggle} aria-label="Dark mode" aria-pressed={dark} title={dark ? "Switch to light mode" : "Switch to dark mode"}><Icon name="moon" className="theme-moon" /><Icon name="sun" className="theme-sun" /><span className="sr-only">{dark ? "Switch to light mode" : "Switch to dark mode"}</span></button>;
}
