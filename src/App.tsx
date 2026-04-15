import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen, TauriEvent } from "@tauri-apps/api/event";
import { FileTree } from "./components/FileTree";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { OutlinePanel, type HeadingItem } from "./components/OutlinePanel";
import { Settings } from "./components/Settings";
import { useSettings } from "./useSettings";
import { LocaleProvider } from "./LocaleContext";
import { useTranslation } from "./LocaleContext";
import { useUpdateCheck } from "./useUpdateCheck";
import { SyntaxReference } from "./components/SyntaxReference";

const MARKDOWN_FILE_REGEX = /\.(md|markdown)$/i;

function isMarkdownFile(path: string): boolean {
  return MARKDOWN_FILE_REGEX.test(path);
}

function getParentDir(path: string): string | null {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return null;
  if (normalized === "/") return "/";

  const idx = normalized.lastIndexOf("/");
  if (idx < 0) return null;
  if (idx === 0) return "/";

  const parent = normalized.slice(0, idx);
  // Keep Windows drive roots normalized as "C:/" instead of "C:"
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}/`;
  return parent;
}

function findDroppedMarkdownPath(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const paths = (payload as { paths?: unknown }).paths;
  if (!Array.isArray(paths)) return null;
  for (const path of paths) {
    if (typeof path === "string" && isMarkdownFile(path)) return path;
  }
  return null;
}

function App() {
  const { settings, setSettings, applyPreset } = useSettings();

  return (
    <LocaleProvider locale={settings.locale}>
      <AppInner
        settings={settings}
        setSettings={setSettings}
        applyPreset={applyPreset}
      />
    </LocaleProvider>
  );
}

function AppInner({
  settings,
  setSettings,
  applyPreset,
}: {
  settings: ReturnType<typeof useSettings>["settings"];
  setSettings: ReturnType<typeof useSettings>["setSettings"];
  applyPreset: ReturnType<typeof useSettings>["applyPreset"];
}) {
  const [rootDir, setRootDir] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSyntaxHelp, setShowSyntaxHelp] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [showDropHint, setShowDropHint] = useState(false);
  const { t } = useTranslation();
  const { info: updateInfo, dismiss: dismissUpdate } = useUpdateCheck();

  // Navigation history
  type HistoryEntry = { rootDir: string | null; selectedFile: string | null };
  const historyRef = useRef<HistoryEntry[]>([{ rootDir: null, selectedFile: null }]);
  const historyIndexRef = useRef(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const navigatingRef = useRef(false);

  const pushHistory = useCallback((entry: HistoryEntry) => {
    if (navigatingRef.current) return;
    const h = historyRef.current;
    const i = historyIndexRef.current;
    // Don't push duplicate entries
    const current = h[i];
    if (current && current.rootDir === entry.rootDir && current.selectedFile === entry.selectedFile) return;
    historyRef.current = [...h.slice(0, i + 1), entry];
    historyIndexRef.current = historyRef.current.length - 1;
    setCanGoBack(historyIndexRef.current > 0);
    setCanGoForward(false);
  }, []);

  const goBack = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    navigatingRef.current = true;
    historyIndexRef.current -= 1;
    const entry = historyRef.current[historyIndexRef.current];
    setRootDir(entry.rootDir);
    setSelectedFile(entry.selectedFile);
    if (!entry.selectedFile) setHeadings([]);
    setCanGoBack(historyIndexRef.current > 0);
    setCanGoForward(true);
    navigatingRef.current = false;
  }, []);

  const goForward = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    navigatingRef.current = true;
    historyIndexRef.current += 1;
    const entry = historyRef.current[historyIndexRef.current];
    setRootDir(entry.rootDir);
    setSelectedFile(entry.selectedFile);
    if (!entry.selectedFile) setHeadings([]);
    setCanGoBack(true);
    setCanGoForward(historyIndexRef.current < historyRef.current.length - 1);
    navigatingRef.current = false;
  }, []);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Scroll folder path to the right end so the folder name is visible
  useEffect(() => {
    if (pathRef.current) {
      pathRef.current.scrollLeft = pathRef.current.scrollWidth;
    }
  }, [rootDir]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !sidebarRef.current) return;
      const rect = sidebarRef.current.getBoundingClientRect();
      // Subtract the header height (~49px) from calculation
      const headerHeight = 49;
      const availableHeight = rect.height - headerHeight;
      const y = ev.clientY - rect.top - headerHeight;
      const ratio = Math.max(0.15, Math.min(0.85, y / availableHeight));
      setSplitRatio(ratio);
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  // Listen for native menu events
  const handleOpenFolderRef = useRef<(() => void) | undefined>(undefined);
  const handleOpenFileRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const unlisteners = [
      listen("menu-open-folder", () => handleOpenFolderRef.current?.()),
      listen("menu-open-file", () => handleOpenFileRef.current?.()),
      listen("menu-print", () => window.print()),
      listen("menu-supported-syntax", () => setShowSyntaxHelp(true)),
    ];
    return () => { unlisteners.forEach((p) => p.then((fn) => fn()).catch(() => {})); };
  }, []);

  const handleOpenFolder = async () => {
    const dir = await open({ directory: true });
    if (dir) {
      setRootDir(dir);
      setSelectedFile(null);
      setHeadings([]);
      pushHistory({ rootDir: dir, selectedFile: null });
    }
  };

  const handleOpenFile = async () => {
    const file = await open({
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (file) {
      setSelectedFile(file);
      pushHistory({ rootDir, selectedFile: file });
    }
  };

  const handleSelectFile = useCallback((file: string) => {
    setSelectedFile(file);
    pushHistory({ rootDir, selectedFile: file });
  }, [rootDir, pushHistory]);

  const handleDropFile = useCallback((file: string) => {
    const nextRootDir = getParentDir(file) ?? rootDir;
    setRootDir(nextRootDir);
    setSelectedFile(file);
    pushHistory({ rootDir: nextRootDir, selectedFile: file });
  }, [rootDir, pushHistory]);

  useEffect(() => {
    const unlisteners = [
      listen(TauriEvent.DRAG_ENTER, (event) => {
        const droppedPath = findDroppedMarkdownPath(event.payload);
        setShowDropHint(Boolean(droppedPath));
      }),
      listen(TauriEvent.DRAG_LEAVE, () => setShowDropHint(false)),
      listen(TauriEvent.DRAG_DROP, (event) => {
        setShowDropHint(false);
        const droppedPath = findDroppedMarkdownPath(event.payload);
        if (droppedPath) handleDropFile(droppedPath);
      }),
    ];
    return () => { unlisteners.forEach((p) => p.then((fn) => fn()).catch(() => {})); };
  }, [handleDropFile]);

  handleOpenFolderRef.current = handleOpenFolder;
  handleOpenFileRef.current = handleOpenFile;

  return (
    <div className="flex flex-col h-full">
      {/* Title bar */}
      <div className="titlebar" data-tauri-drag-region>
        <button
          onClick={() => setSidebarVisible((v) => !v)}
          className="titlebar-toggle"
          title={sidebarVisible ? t("sidebar.toggle.hide") : t("sidebar.toggle.show")}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11zM5 3.5v9H3v-9h2z"/>
          </svg>
        </button>
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className="titlebar-nav"
          title={t("nav.back")}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
          </svg>
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          className="titlebar-nav"
          title={t("nav.forward")}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </button>
        <span className="titlebar-text" data-tauri-drag-region>Rendu</span>
      </div>

      {updateInfo && (
        <div className="update-banner">
          <div className="update-banner-text">
            <span>{t("update.available", { version: updateInfo.latestVersion })}</span>
            <span>—</span>
            <a href={updateInfo.releaseUrl} target="_blank" rel="noopener noreferrer">{t("update.download")}</a>
            <span style={{ color: "var(--text-muted, #71717a)" }}>{t("update.homebrew")}</span>
          </div>
          <button className="update-banner-close" onClick={dismissUpdate} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
            </svg>
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      {sidebarVisible && (
      <div ref={sidebarRef} className="sidebar w-72 flex-shrink-0 flex flex-col">
        <div className="sidebar-header p-3 flex gap-1.5">
          <button onClick={handleOpenFolder} className="btn flex-1 px-2 py-1.5 rounded text-xs" title={t("sidebar.folder.title")}>
            {t("sidebar.folder")}
          </button>
          <button onClick={handleOpenFile} className="btn flex-1 px-2 py-1.5 rounded text-xs" title={t("sidebar.file.title")}>
            {t("sidebar.file")}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="btn px-2.5 py-1.5 rounded text-sm"
            title={t("sidebar.settings.title")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492ZM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0Z"/>
              <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319Zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.116l.094-.318Z"/>
            </svg>
          </button>
        </div>

        {/* Folder path */}
        {rootDir && (
          <div
            ref={pathRef}
            className="px-3 pb-2 text-xs flex-shrink-0 whitespace-nowrap overflow-x-auto"
            style={{ color: "var(--text-muted, #71717a)" }}
            title={rootDir}
          >
            {rootDir}
          </div>
        )}

        {/* File tree pane */}
        <div className="overflow-y-auto" style={{ flex: `0 0 ${splitRatio * 100}%` }}>
          {rootDir ? (
            <FileTree
              rootDir={rootDir}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
            />
          ) : (
            <div className="p-4 text-sm text-muted">
              {t("sidebar.emptyFolder")}
            </div>
          )}
        </div>

        {/* Resizable divider */}
        <div className="sidebar-divider" onMouseDown={handleMouseDown}>
          <span className="sidebar-divider-label">{t("sidebar.outline")}</span>
        </div>

        {/* Outline pane */}
        <div className="overflow-y-auto" style={{ flex: `0 0 ${(1 - splitRatio) * 100}%` }}>
          <OutlinePanel headings={headings} />
        </div>
      </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        {showDropHint && (
          <div className="drop-overlay">
            <div className="drop-overlay-label">{t("drop.openMarkdown")}</div>
          </div>
        )}
        {selectedFile ? (
          <MarkdownViewer filePath={selectedFile} settings={settings} onHeadingsChange={setHeadings} />
        ) : rootDir ? (
          <div className="empty-state">
            <svg
              className="empty-state-icon"
              width="96"
              height="96"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
              <path d="M14 3v5h5" />
              <path d="M9 13h6" />
              <path d="M9 17h6" />
            </svg>
            <h2 className="empty-state-heading">{t("empty.selectFile")}</h2>
            <p className="empty-state-subheading">{t("empty.selectFile.sub")}</p>
          </div>
        ) : (
          <div className="empty-state">
            <svg
              className="empty-state-icon"
              width="96"
              height="96"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
              <path d="M14 3v5h5" />
              <path d="M9 13h6" />
              <path d="M9 17h6" />
            </svg>
            <h2 className="empty-state-heading">{t("empty.heading")}</h2>
            <p className="empty-state-subheading">{t("empty.subheading")}</p>
            <div className="empty-state-actions">
              <button className="btn" onClick={handleOpenFolder}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M.54 3.87L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181L15.546 8H14.54l.265-2.91A1 1 0 0 0 13.81 4H2.19a1 1 0 0 0-.996 1.09l.637 7A1 1 0 0 0 2.826 13h9.174v1H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31z"/>
                </svg>
                {t("empty.openFolder")}
              </button>
              <button className="btn" onClick={handleOpenFile}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0H4zm5.5 1.5v2a1 1 0 0 0 1 1h2l.5.5V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>
                </svg>
                {t("empty.openFile")}
              </button>
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <Settings
          settings={settings}
          onChange={setSettings}
          onApplyPreset={applyPreset}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showSyntaxHelp && (
        <div className="syntax-modal-overlay" onClick={() => setShowSyntaxHelp(false)}>
          <div className="syntax-modal" onClick={(e) => e.stopPropagation()}>
            <div className="syntax-modal-header">
              <h2>{t("help.syntaxTitle")}</h2>
              <button className="syntax-modal-close" onClick={() => setShowSyntaxHelp(false)} aria-label={t("viewer.lightbox.close")}>✕</button>
            </div>
            <p className="syntax-modal-description">{t("help.description")}</p>
            <SyntaxReference />
            <div className="syntax-modal-footer">
              <button className="btn" onClick={() => setShowSyntaxHelp(false)}>{t("viewer.lightbox.close")}</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default App;
