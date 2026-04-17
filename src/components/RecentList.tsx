import { useCallback } from "react";
import { stat } from "@tauri-apps/plugin-fs";
import type { RecentEntry } from "../useRecentFiles";
import { useTranslation } from "../LocaleContext";

interface RecentListProps {
  entries: RecentEntry[];
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onRemove: (path: string) => void;
}

export function RecentList({ entries, onOpenFile, onOpenFolder, onRemove }: RecentListProps) {
  const { t } = useTranslation();

  const handleClick = useCallback(
    async (entry: RecentEntry) => {
      try {
        await stat(entry.path);
        if (entry.type === "file") {
          onOpenFile(entry.path);
        } else {
          onOpenFolder(entry.path);
        }
      } catch {
        onRemove(entry.path);
        alert(t("recent.openError"));
      }
    },
    [onOpenFile, onOpenFolder, onRemove, t]
  );

  if (entries.length === 0) return null;

  return (
    <div className="recent-list">
      <h3 className="recent-list-title">{t("recent.title")}</h3>
      {entries.map((entry) => {
        const name = entry.path.split("/").pop() || entry.path;
        const dir = entry.path.slice(0, entry.path.length - name.length - 1) || "/";
        return (
          <div key={entry.path} className="recent-item">
            <button
              className="recent-item-link"
              onClick={() => handleClick(entry)}
              title={entry.path}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="recent-item-icon">
                {entry.type === "folder" ? (
                  <path d="M.54 3.87L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181L15.546 8H14.54l.265-2.91A1 1 0 0 0 13.81 4H2.19a1 1 0 0 0-.996 1.09l.637 7A1 1 0 0 0 2.826 13h9.174v1H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31z"/>
                ) : (
                  <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0H4zm5.5 1.5v2a1 1 0 0 0 1 1h2l.5.5V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>
                )}
              </svg>
              <span className="recent-item-name">{name}</span>
              <span className="recent-item-dir">{dir}</span>
            </button>
            <button
              className="recent-item-remove"
              onClick={(e) => { e.stopPropagation(); onRemove(entry.path); }}
              title={t("recent.remove")}
              aria-label={t("recent.remove")}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
