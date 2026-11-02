"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./ui-primitives";
import { themeStorageKey as storageKey } from "./theme-init";

const changeEvent = "recoveryos-theme-change";
type Theme = "light" | "dark";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const followSystem = () => {
    if (document.documentElement.dataset.themePreference === "system") {
      document.documentElement.dataset.theme = systemTheme();
      onChange();
    }
  };
  const syncTabs = (event: StorageEvent) => {
    if (event.key !== storageKey && event.key !== null) return;
    const preference = event.newValue === "dark" || event.newValue === "light" ? event.newValue : "system";
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.dataset.theme = preference === "system" ? systemTheme() : preference;
    onChange();
  };
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", syncTabs);
  window.addEventListener("focus", followSystem);
  document.addEventListener("visibilitychange", followSystem);
  media.addEventListener("change", followSystem);
  // A system preference may change while the server-rendered page is hydrating.
  followSystem();
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", syncTabs);
    window.removeEventListener("focus", followSystem);
    document.removeEventListener("visibilitychange", followSystem);
    media.removeEventListener("change", followSystem);
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
