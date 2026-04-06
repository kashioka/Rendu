import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { FileTree } from "./components/FileTree";
import { MarkdownViewer } from "./components/MarkdownViewer";
import { OutlinePanel, type HeadingItem } from "./components/OutlinePanel";
import { Settings } from "./components/Settings";
import { useSettings } from "./useSettings";
import { LocaleProvider } from "./LocaleContext";
import { useTranslation } from "./LocaleContext";

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
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const { t } = useTranslation();

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
    ];
    return () => { unlisteners.forEach((p) => p.then((fn) => fn()).catch(() => {})); };
  }, []);

  const handleOpenFolder = async () => {
    const dir = await open({ directory: true });
    if (dir) {
      setRootDir(dir);
      setSelectedFile(null);
      setHeadings([]);
    }
  };

  const handleOpenFile = async () => {
    const file = await open({
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (file) {
      setSelectedFile(file);
    }
  };

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
        <span className="titlebar-text" data-tauri-drag-region>Rendu</span>
        {rootDir && (
          <span className="titlebar-path" data-tauri-drag-region title={rootDir}>
            {" — "}{rootDir}
          </span>
        )}
      </div>

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
              onSelectFile={setSelectedFile}
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
      <div className="flex-1 min-h-0 flex flex-col">
        {selectedFile ? (
          <MarkdownViewer filePath={selectedFile} settings={settings} onHeadingsChange={setHeadings} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted">
            {t("app.selectFile")}
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
      </div>
    </div>
  );
}

export default App;
