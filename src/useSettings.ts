import { useState, useEffect, useCallback, useMemo } from "react";
import { appConfigDir } from "@tauri-apps/api/path";
import { readTextFile, mkdir, exists } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Locale } from "./i18n";

export interface ThemeSettings {
  locale: Locale;
  preset: "dark" | "light" | "system";
  appBg: string;
  sidebarBg: string;
  textColor: string;
  textMuted: string;
  borderColor: string;
  buttonBg: string;
  buttonText: string;
  hoverBg: string;
  selectedBg: string;
  selectedText: string;
  mdHeadingColor: string;
  mdLinkColor: string;
  mdCodeBg: string;
  mdBorderColor: string;
  mermaidTheme: "default" | "dark" | "forest" | "neutral" | "base";
  mermaidBg: string;
  mermaidPrimaryColor: string;
  mermaidPrimaryTextColor: string;
  mermaidLineColor: string;
  mermaidSecondaryColor: string;
  mermaidNoteBg: string;
  mermaidNoteTextColor: string;
  mermaidActorBg: string;
  mermaidActorTextColor: string;
  mermaidSignalTextColor: string;
}

export const darkPreset: ThemeSettings = {
  locale: "en",
  preset: "dark",
  appBg: "#18181b",
  sidebarBg: "#18181b",
  textColor: "#e4e4e7",
  textMuted: "#71717a",
  borderColor: "#3f3f46",
  buttonBg: "#3f3f46",
  buttonText: "#e4e4e7",
  hoverBg: "#3f3f4680",
  selectedBg: "#1e3a5f",
  selectedText: "#93c5fd",
  mdHeadingColor: "#f4f4f5",
  mdLinkColor: "#60a5fa",
  mdCodeBg: "#27272a",
  mdBorderColor: "#3f3f46",
  mermaidTheme: "base",
  mermaidBg: "#1e1e2e",
  mermaidPrimaryColor: "#6366f1",
  mermaidPrimaryTextColor: "#f4f4f5",
  mermaidLineColor: "#a1a1aa",
  mermaidSecondaryColor: "#4f46e5",
  mermaidNoteBg: "#fef3c7",
  mermaidNoteTextColor: "#1c1917",
  mermaidActorBg: "#6366f1",
  mermaidActorTextColor: "#ffffff",
  mermaidSignalTextColor: "#e4e4e7",
};

export const lightPreset: ThemeSettings = {
  locale: "en",
  preset: "light",
  appBg: "#ffffff",
  sidebarBg: "#f4f4f5",
  textColor: "#27272a",
  textMuted: "#a1a1aa",
  borderColor: "#d4d4d8",
  buttonBg: "#e4e4e7",
  buttonText: "#27272a",
  hoverBg: "#e4e4e780",
  selectedBg: "#dbeafe",
  selectedText: "#1d4ed8",
  mdHeadingColor: "#18181b",
  mdLinkColor: "#2563eb",
  mdCodeBg: "#f4f4f5",
  mdBorderColor: "#d4d4d8",
  mermaidTheme: "base",
  mermaidBg: "#ffffff",
  mermaidPrimaryColor: "#6366f1",
  mermaidPrimaryTextColor: "#18181b",
  mermaidLineColor: "#71717a",
  mermaidSecondaryColor: "#c7d2fe",
  mermaidNoteBg: "#fef3c7",
  mermaidNoteTextColor: "#1c1917",
  mermaidActorBg: "#6366f1",
  mermaidActorTextColor: "#ffffff",
  mermaidSignalTextColor: "#27272a",
};

export const systemPreset: ThemeSettings = {
  ...lightPreset,
  locale: "en",
  preset: "system",
};

export const presets = { dark: darkPreset, light: lightPreset, system: systemPreset };

const CONFIG_FILE = "settings.json";

/** Per-theme color set — every field except locale/preset. */
type ColorSet = Omit<ThemeSettings, "locale" | "preset">;

/** Persisted shape: one customizable color set per concrete theme. */
interface StoredSettings {
  preset: "dark" | "light" | "system";
  locale: Locale;
  dark: ColorSet;
  light: ColorSet;
}

function colorsOf(p: ThemeSettings): ColorSet {
  const colors = { ...p } as Partial<ThemeSettings>;
  delete colors.locale;
  delete colors.preset;
  return colors as ColorSet;
}

const darkColors = colorsOf(darkPreset);
const lightColors = colorsOf(lightPreset);
const COLOR_KEYS = Object.keys(darkColors) as (keyof ColorSet)[];

const defaultStored: StoredSettings = {
  preset: "system",
  locale: "en",
  dark: { ...darkColors },
  light: { ...lightColors },
};

function pickColors(obj: Record<string, unknown>): Partial<ColorSet> {
  const out: Record<string, string> = {};
  for (const k of COLOR_KEYS) {
    const v = obj[k];
    if (typeof v === "string") out[k] = v;
  }
  return out as Partial<ColorSet>;
}

/** Parse persisted settings, migrating the legacy flat schema into per-preset buckets. */
export function migrateStored(parsed: unknown): StoredSettings | null {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const preset =
    obj.preset === "dark" || obj.preset === "light" || obj.preset === "system" ? obj.preset : "system";
  const locale =
    obj.locale === "ja" || obj.locale === "en" || obj.locale === "zh-CN" ? obj.locale : "en";

  // New bucketed schema
  if (obj.dark && obj.light && typeof obj.dark === "object" && typeof obj.light === "object") {
    return {
      preset,
      locale,
      dark: { ...darkColors, ...pickColors(obj.dark as Record<string, unknown>) },
      light: { ...lightColors, ...pickColors(obj.light as Record<string, unknown>) },
    };
  }

  // Legacy flat schema → seed the saved preset's bucket from the flat colors, leave the
  // other bucket at stock defaults. (For system, the flat colors were stock-resolved anyway.)
  const flat = pickColors(obj);
  const dark = { ...darkColors };
  const light = { ...lightColors };
  if (preset === "dark") Object.assign(dark, flat);
  else if (preset === "light") Object.assign(light, flat);
  return { preset, locale, dark, light };
}

async function loadFromFile(): Promise<StoredSettings | null> {
  try {
    const dir = await appConfigDir();
    if (!(await exists(dir))) return null;
    const path = `${dir.replace(/\/+$/, "")}/${CONFIG_FILE}`;
    if (!(await exists(path))) return null;
    const text = await readTextFile(path);
    return migrateStored(JSON.parse(text));
  } catch {
    return null;
  }
}

async function saveToFile(settings: StoredSettings): Promise<void> {
  try {
    const dir = await appConfigDir();
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
    const path = `${dir.replace(/\/+$/, "")}/${CONFIG_FILE}`;
    await invoke("atomic_write", { path, contents: JSON.stringify(settings, null, 2) });
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

function prefersDarkMode(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Which concrete palette is active right now (System resolves via the OS). */
function resolvedPreset(s: StoredSettings): "dark" | "light" {
  if (s.preset === "system") return prefersDarkMode() ? "dark" : "light";
  return s.preset;
}

/** Flatten stored buckets into the resolved, app-facing ThemeSettings. */
function flatten(s: StoredSettings): ThemeSettings {
  return { preset: s.preset, locale: s.locale, ...s[resolvedPreset(s)] };
}

/** Apply all theme settings as CSS custom properties on <html> + window theme */
function applyThemeToDOM(s: ThemeSettings) {
  const isDark = s.preset === "dark" || (s.preset === "system" && prefersDarkMode());
  try { getCurrentWindow().setTheme(isDark ? "dark" : "light").catch(() => {}); } catch { /* outside Tauri runtime */ }
  const root = document.documentElement;
  root.style.setProperty("--app-bg", s.appBg);
  root.style.setProperty("--sidebar-bg", s.sidebarBg);
  root.style.setProperty("--text-color", s.textColor);
  root.style.setProperty("--text-muted", s.textMuted);
  root.style.setProperty("--border-color", s.borderColor);
  root.style.setProperty("--button-bg", s.buttonBg);
  root.style.setProperty("--button-text", s.buttonText);
  root.style.setProperty("--hover-bg", s.hoverBg);
  root.style.setProperty("--selected-bg", s.selectedBg);
  root.style.setProperty("--selected-text", s.selectedText);
  root.style.setProperty("--md-heading", s.mdHeadingColor);
  root.style.setProperty("--md-link", s.mdLinkColor);
  root.style.setProperty("--md-code-bg", s.mdCodeBg);
  root.style.setProperty("--md-border", s.mdBorderColor);
}

export function useSettings() {
  const [stored, setStored] = useState<StoredSettings>(defaultStored);
  const [loaded, setLoaded] = useState(false);
  const [osTick, bumpOsTick] = useState(0);

  // osTick は OS の prefers-color-scheme 変化時に flatten() (内部で
  // matchMedia を参照) を再実行させる意図的な追加依存。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const settings = useMemo(() => flatten(stored), [stored, osTick]);

  // Load from file on mount
  useEffect(() => {
    loadFromFile().then((saved) => {
      const initial = saved ?? defaultStored;
      setStored(initial);
      applyThemeToDOM(flatten(initial));
      setLoaded(true);
    });
  }, []);

  // Apply CSS vars + save whenever settings change
  useEffect(() => {
    applyThemeToDOM(flatten(stored));
    if (loaded) saveToFile(stored);
  }, [stored, loaded]);

  // Follow the OS palette while System is selected
  useEffect(() => {
    if (stored.preset !== "system") return;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const listener = () => { applyThemeToDOM(flatten(stored)); bumpOsTick((t) => t + 1); };
    media.addEventListener?.("change", listener);
    return () => media.removeEventListener?.("change", listener);
  }, [stored]);

  // Colors land in the active palette's bucket; locale is top-level. Preset changes go
  // through applyPreset, so a patch here only ever carries locale and/or color fields.
  const setSettings = useCallback((patch: Partial<ThemeSettings>) => {
    setStored((prev) => {
      const next: StoredSettings = { ...prev };
      if (patch.locale !== undefined) next.locale = patch.locale;
      const colorPatch = pickColors(patch as Record<string, unknown>);
      if (Object.keys(colorPatch).length > 0) {
        const target = resolvedPreset(prev);
        next[target] = { ...prev[target], ...colorPatch };
      }
      return next;
    });
  }, []);

  const applyPreset = useCallback((name: "dark" | "light" | "system") => {
    setStored((prev) => ({ ...prev, preset: name }));
  }, []);

  // Reset the active (Dark/Light) palette back to its stock defaults
  const resetPreset = useCallback(() => {
    setStored((prev) => {
      if (prev.preset === "system") return prev;
      const defaults = prev.preset === "light" ? lightColors : darkColors;
      return { ...prev, [prev.preset]: { ...defaults } };
    });
  }, []);

  return { settings, setSettings, applyPreset, resetPreset, loaded };
}
