import { useState, useEffect, useCallback } from "react";
import { appConfigDir } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, mkdir, exists } from "@tauri-apps/plugin-fs";

export interface RecentEntry {
  path: string;
  type: "file" | "folder";
  timestamp: number;
}

const CONFIG_FILE = "recent.json";
const MAX_ENTRIES = 10;

async function getConfigPath(): Promise<string> {
  const dir = await appConfigDir();
  return `${dir.replace(/\/+$/, "")}/${CONFIG_FILE}`;
}

async function loadRecent(): Promise<RecentEntry[]> {
  try {
    const dir = await appConfigDir();
    if (!(await exists(dir))) return [];
    const path = await getConfigPath();
    if (!(await exists(path))) return [];
    const text = await readTextFile(path);
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as RecentEntry).path === "string" &&
        ((e as RecentEntry).type === "file" || (e as RecentEntry).type === "folder") &&
        typeof (e as RecentEntry).timestamp === "number"
    );
  } catch {
    return [];
  }
}

async function saveRecent(entries: RecentEntry[]): Promise<void> {
  try {
    const dir = await appConfigDir();
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
    const path = await getConfigPath();
    await writeTextFile(path, JSON.stringify(entries, null, 2));
  } catch (e) {
    console.error("Failed to save recent files:", e);
  }
}

export function useRecentFiles() {
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadRecent().then((saved) => {
      setEntries(saved);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) saveRecent(entries);
  }, [entries, loaded]);

  const addRecent = useCallback((path: string, type: "file" | "folder") => {
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.path !== path);
      const next = [{ path, type, timestamp: Date.now() }, ...filtered];
      return next.slice(0, MAX_ENTRIES);
    });
  }, []);

  const removeRecent = useCallback((path: string) => {
    setEntries((prev) => prev.filter((e) => e.path !== path));
  }, []);

  return { entries, addRecent, removeRecent, loaded };
}
