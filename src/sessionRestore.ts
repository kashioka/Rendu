// Persists the last opened file / folder in sessionStorage so that a
// webview reload (right-click → Reload) restores the document. sessionStorage
// is wiped on full app exit, so a fresh launch still shows the home screen.
// See Issue #59.

const FILE_KEY = "rendu:lastFile";
const ROOT_KEY = "rendu:lastRootDir";

export interface SessionState {
  rootDir: string | null;
  selectedFile: string | null;
}

function safeGetStorage(): Storage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

function writeKey(storage: Storage, key: string, value: string | null): void {
  if (value) {
    storage.setItem(key, value);
  } else {
    storage.removeItem(key);
  }
}

export function saveSession(state: SessionState): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    writeKey(storage, FILE_KEY, state.selectedFile);
    writeKey(storage, ROOT_KEY, state.rootDir);
  } catch {
    // Quota / disabled storage — ignore; reload restore is a nice-to-have.
  }
}

export function loadSession(): SessionState {
  const storage = safeGetStorage();
  if (!storage) return { rootDir: null, selectedFile: null };
  try {
    return {
      rootDir: storage.getItem(ROOT_KEY) || null,
      selectedFile: storage.getItem(FILE_KEY) || null,
    };
  } catch {
    return { rootDir: null, selectedFile: null };
  }
}

// Orchestrates startup restore: CLI / file association (get_initial_file)
// always wins; otherwise fall back to the previous session. Exported so the
// behavior can be exercised by tests without mounting the full App.
export async function restoreOnStartup(deps: {
  getInitialFile: () => Promise<string | null>;
  openFile: (path: string) => void;
  openFolder: (path: string) => void;
}): Promise<void> {
  let initial: string | null = null;
  try {
    initial = await deps.getInitialFile();
  } catch {
    initial = null;
  }
  if (initial) {
    deps.openFile(initial);
    return;
  }
  const { selectedFile, rootDir } = loadSession();
  if (selectedFile) {
    deps.openFile(selectedFile);
  } else if (rootDir) {
    deps.openFolder(rootDir);
  }
}
