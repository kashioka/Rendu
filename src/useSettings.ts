import { useState, useEffect, useCallback } from "react";
import { appConfigDir } from "@tauri-apps/api/path";
import { readTextFile, mkdir, exists } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Locale } from "./i18n";

export interface ThemeSettings {
  locale: Locale;
  preset: "dark" | "light";
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

export const presets = { dark: darkPreset, light: lightPreset };

const CONFIG_FILE = "settings.json";

async function loadFromFile(): Promise<ThemeSettings | null> {
  try {
    const dir = await appConfigDir();
    if (!(await exists(dir))) return null;
    const path = `${dir.replace(/\/+$/, "")}/${CONFIG_FILE}`;
    if (!(await exists(path))) return null;
    const text = await readTextFile(path);
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    if (obj.preset !== undefined && obj.preset !== "dark" && obj.preset !== "light") {
      obj.preset = "dark";
    }
    return { ...darkPreset, ...obj };
  } catch {
    return null;
  }
}

async function saveToFile(settings: ThemeSettings): Promise<void> {
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

/** Apply all theme settings as CSS custom properties on <html> + window theme */
function applyThemeToDOM(s: ThemeSettings) {
  try { getCurrentWindow().setTheme(s.preset === "dark" ? "dark" : "light").catch(() => {}); } catch { /* outside Tauri runtime */ }
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
  const [settings, setSettingsState] = useState<ThemeSettings>(darkPreset);
  const [loaded, setLoaded] = useState(false);

  // Load from file on mount
  useEffect(() => {
    loadFromFile().then((saved) => {
      const initial = saved ?? darkPreset;
      setSettingsState(initial);
      applyThemeToDOM(initial);
      setLoaded(true);
    });
  }, []);

  // Apply CSS vars + save whenever settings change
  useEffect(() => {
    applyThemeToDOM(settings);
    if (loaded) saveToFile(settings);
  }, [settings, loaded]);

  const setSettings = useCallback(
    (patch: Partial<ThemeSettings>) => {
      setSettingsState((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const applyPreset = useCallback((name: "dark" | "light") => {
    setSettingsState((prev) => ({ ...presets[name], locale: prev.locale }));
  }, []);

  return { settings, setSettings, applyPreset, loaded };
}
