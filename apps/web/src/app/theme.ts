import { useSyncExternalStore } from "react";

// Light/dark theming that follows the OS by default and can be overridden.
// A single module-level store keeps every <ThemeToggle> instance in sync (the
// mobile top bar and the desktop rail each render one).

export type ThemePref = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "doomscrollr.theme";
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#fbfbfd",
  dark: "#0f1014",
};

const listeners = new Set<() => void>();
let pref: ThemePref = readInitial();

function readInitial(): ThemePref {
  if (typeof localStorage === "undefined") return "auto";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
}

function systemPrefersDark(): boolean {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolve(value: ThemePref): ResolvedTheme {
  return value === "auto" ? (systemPrefersDark() ? "dark" : "light") : value;
}

function apply(value: ThemePref): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved = resolve(value);

  if (value === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", value);

  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[resolved]);
}

export function getThemePref(): ThemePref {
  return pref;
}

export function getResolvedTheme(): ResolvedTheme {
  return resolve(pref);
}

export function setThemePref(value: ThemePref): void {
  pref = value;
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, value);
  apply(value);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, getThemePref, () => "auto");
}

// Keep the document in sync and react to OS changes while in "auto".
if (typeof document !== "undefined") {
  apply(pref);
  globalThis.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (pref !== "auto") return;
    apply("auto");
    for (const listener of listeners) listener();
  });
}
