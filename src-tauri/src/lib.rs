use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use parking_lot::Mutex;
use std::time::Duration;
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager, RunEvent};
use tauri_plugin_fs::FsExt;
use serde::Serialize;

#[derive(Serialize)]
pub struct UpdateInfo {
  has_update: bool,
  latest_version: String,
  current_version: String,
  release_url: String,
  /// OS-specific direct download URL for the latest release's installer.
  /// Falls back to the release page on platforms with multiple installer
  /// formats (Linux). Empty when there is no update.
  download_url: String,
}

/// Build the direct download URL for this OS's installer in the given release.
/// Returns `None` for platforms that ship multiple installer formats (Linux:
/// .deb / .rpm / .AppImage) where we can't pick one — callers fall back to the
/// release page so the user chooses. `tag` is the git tag (e.g. "v0.9.0"),
/// `version` is the tag without the leading "v" (e.g. "0.9.0").
fn os_download_url(os: &str, tag: &str, version: &str) -> Option<String> {
  let file = match os {
    "macos" => format!("Rendu_{version}_aarch64.dmg"),
    "windows" => format!("Rendu_{version}_x64-setup.exe"),
    _ => return None,
  };
  Some(format!(
    "https://github.com/kashioka/Rendu/releases/download/{tag}/{file}"
  ))
}

#[tauri::command]
async fn check_for_updates() -> UpdateInfo {
  let current = env!("CARGO_PKG_VERSION");
  let no_update = UpdateInfo {
    has_update: false,
    latest_version: current.to_string(),
    current_version: current.to_string(),
    release_url: String::new(),
    download_url: String::new(),
  };

  let client = match reqwest::Client::builder()
    .user_agent("Rendu-Update-Checker")
    .build()
  {
    Ok(c) => c,
    Err(_) => return no_update,
  };

  let resp = match client
    .get("https://api.github.com/repos/kashioka/Rendu/releases/latest")
    .send()
    .await
  {
    Ok(r) => r,
    Err(_) => return no_update,
  };

  let json: serde_json::Value = match resp.json().await {
    Ok(j) => j,
    Err(_) => return no_update,
  };

  let tag = match json["tag_name"].as_str() {
    Some(t) => t,
    None => return no_update,
  };

  let latest = tag.trim_start_matches('v');
  let release_url = json["html_url"]
    .as_str()
    .unwrap_or("https://github.com/kashioka/Rendu/releases/latest")
    .to_string();

  // Prefer a direct OS-specific installer link; fall back to the release page
  // on Linux (multiple formats) so the banner never sends users to a 404.
  let download_url =
    os_download_url(std::env::consts::OS, tag, latest).unwrap_or_else(|| release_url.clone());

  UpdateInfo {
    has_update: latest != current,
    latest_version: latest.to_string(),
    current_version: current.to_string(),
    release_url,
    download_url,
  }
}

/// Holds the initial file path opened via file association or CLI argument.
/// The frontend retrieves this once on startup.
#[derive(Default)]
struct InitialFile(Mutex<Option<String>>);

#[tauri::command]
fn get_initial_file(state: tauri::State<'_, InitialFile>) -> Option<String> {
  state.0.lock().take()
}

/// Only web and mail links may be handed to the OS. A compromised webview must
/// not be able to launch `file://` (local executables), `smb://` (NTLM
/// credential leak on Windows), or custom app schemes through this command.
fn is_allowed_external_url(url: &str) -> bool {
  let lower = url.trim_start().to_ascii_lowercase();
  lower.starts_with("http://") || lower.starts_with("https://") || lower.starts_with("mailto:")
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
  if !is_allowed_external_url(&url) {
    return Err("Refusing to open a non-web URL".into());
  }
  open::that(&url).map_err(|e| e.to_string())
}

/// File extensions the OS default handler would *execute* rather than display.
/// Handing any of these to `open` is arbitrary code execution, so `open_path`
/// refuses them outright even though the frontend also gates the call — this is
/// the backstop against a compromised webview invoking the command directly.
const EXECUTABLE_EXTENSIONS: &[&str] = &[
  // macOS (executables, scripts, and installer bundles)
  "app", "command", "tool", "terminal", "workflow", "action", "scpt", "scptd",
  "applescript", "osascript", "prefpane", "pkg", "mpkg",
  // Windows (executables, scripts, and installer formats)
  "exe", "bat", "cmd", "com", "scr", "msi", "msp", "ps1", "vbs", "vbe", "wsf",
  "wsh", "hta", "jar", "lnk", "reg", "cpl", "pif", "msc",
  "appinstaller", "msix", "msixbundle", "appx", "appxbundle", "msu",
  "application", "appref-ms",
];

fn is_executable_extension(path: &str) -> bool {
  std::path::Path::new(path)
    .extension()
    .and_then(|e| e.to_str())
    .map(|e| EXECUTABLE_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
    .unwrap_or(false)
}

/// Open a local (non-Markdown) file referenced from a document with the OS
/// default app. Executable types are rejected — a document viewer must never
/// turn a link click into code execution.
#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
  check_open_path(std::path::Path::new(&path))?;
  open::that(&path).map_err(|e| e.to_string())
}

/// Shortcut files: the OS opens whatever they point at, which may be a `.md`
/// (`file:///…/notes.md` in a `.url`) or an executable. Their target is not
/// visible from the path, so `open_path` refuses them like executables.
const SHORTCUT_EXTENSIONS: &[&str] = &["url", "website", "webloc", "inetloc", "fileloc", "desktop"];

fn has_extension_in(path: &str, list: &[&str]) -> bool {
  std::path::Path::new(path)
    .extension()
    .and_then(|e| e.to_str())
    .is_some_and(|e| list.contains(&e.to_ascii_lowercase().as_str()))
}

/// What `open_path` may hand to the OS: an existing local file or folder named
/// by an absolute path, that is not executable, a shortcut, or Markdown —
/// judged by the name given and by what it resolves to.
///
/// Markdown links open inside Rendu, never through the OS. Rendu is usually
/// the OS default for .md, so opening one externally comes straight back as a
/// file-association open, which grants that file and its folder: a
/// compromised webview could widen its own scope (issue #221 review). Hence:
/// - absolute paths only, so URLs (`file:///x%2Emd`, which the OS decodes to
///   `x.md`) and other schemes never reach the opener;
/// - no network paths (`\\host\share`, `//host/share`): resolving one already
///   connects over SMB, which can leak NTLM credentials, so they are refused
///   before touching the filesystem, as are names refused outright;
/// - the resolved path is checked too, since symlinks and, on Windows,
///   `x.md.` / `x.md ` / 8.3 names resolve to a real `.md` file.
fn check_open_path(path: &std::path::Path) -> Result<(), String> {
  let raw = path.to_string_lossy();
  // Windows treats any two leading separators, in any mix (`\\`, `//`, `/\`,
  // `\/`), as a UNC or device prefix (`\\?\UNC\…`, `\\.\…` included).
  let mut lead = raw.chars();
  let is_sep = |c: Option<char>| matches!(c, Some('/') | Some('\\'));
  if is_sep(lead.next()) && is_sep(lead.next()) {
    return Err("Refusing to open a network path".into());
  }
  if !path.is_absolute() {
    return Err("Refusing to open a non-absolute path".into());
  }
  let check_name = |name: &str| -> Result<(), String> {
    if is_executable_extension(name) || has_extension_in(name, SHORTCUT_EXTENSIONS) {
      return Err("Refusing to open an executable or shortcut file".into());
    }
    if is_markdown_path(name) {
      return Err("Refusing to open a Markdown file externally".into());
    }
    Ok(())
  };
  check_name(&raw)?;
  let resolved = path
    .canonicalize()
    .map_err(|e| format!("Cannot resolve path: {}", e))?;
  check_name(&resolved.to_string_lossy())
}

/// Write an exported PDF to a user-chosen location. The save dialog is shown
/// from Rust so the destination is picked by the user, never supplied by the
/// webview — this lets the fs plugin drop its blanket `$HOME/**` write grant.
///
/// `async` + `spawn_blocking` is required: a synchronous command runs on the
/// main thread, and `blocking_save_file` there deadlocks (the native dialog it
/// dispatches also needs the main thread). Running it on a blocking pool thread
/// leaves the main thread free to drive the dialog.
#[tauri::command]
async fn export_pdf(
  app: tauri::AppHandle,
  default_name: String,
  contents_base64: String,
) -> Result<bool, String> {
  use base64::Engine;
  use tauri_plugin_dialog::DialogExt;

  let bytes = base64::engine::general_purpose::STANDARD
    .decode(contents_base64.as_bytes())
    .map_err(|e| format!("Invalid PDF data: {}", e))?;

  tauri::async_runtime::spawn_blocking(move || {
    let picked = app
      .dialog()
      .file()
      .add_filter("PDF", &["pdf"])
      .set_file_name(&default_name)
      .blocking_save_file();

    let Some(file_path) = picked else {
      return Ok(false); // user cancelled
    };
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, &bytes).map_err(|e| format!("Failed to write PDF: {}", e))?;
    Ok(true)
  })
  .await
  .map_err(|e| e.to_string())?
}

/// Credential stores under `$HOME`, denied to the webview. Must equal the
/// `fs:scope` deny list in capabilities/default.json (a test pins this): the
/// capability covers plugin-fs commands, this list covers Rust commands that
/// read files themselves (`read_safe_image`), which plugin-fs never checks.
const CREDENTIAL_DIRS: &[&str] = &[
  ".ssh",
  ".gnupg",
  ".aws",
  ".azure",
  ".kube",
  ".docker",
  ".config/gcloud",
  ".config/gh",
];
const CREDENTIAL_FILES: &[&str] = &[".netrc", ".npmrc", ".pypirc", ".git-credentials"];

/// Whether `canonical` is (inside) one of the credential stores. Each store is
/// compared both as written and resolved, so `~/.ssh` symlinked to another
/// volume is still caught when that volume is opened (issue #221 review).
fn is_credential_store(canonical: &std::path::Path, home: &std::path::Path) -> bool {
  let canonical_home = home.canonicalize().unwrap_or_else(|_| home.to_path_buf());
  CREDENTIAL_DIRS.iter().chain(CREDENTIAL_FILES).any(|entry| {
    let store = home.join(entry);
    canonical.starts_with(canonical_home.join(entry))
      || store.canonicalize().is_ok_and(|resolved| canonical.starts_with(resolved))
  })
}

/// Resolve, validate, and read an image referenced from a document, enforcing
/// two boundaries: the file must sit within `base_dir` (the document's own
/// directory) AND within `allowed_root`. The second boundary matters because
/// `base_dir` is supplied by the webview — a compromised renderer could pass
/// `base_dir = "/"` to read `/etc/passwd`, other users' homes, SSH keys, etc.
/// `allowed_root` is derived by the command wrapper from the OS home directory,
/// which the webview cannot influence. `also_allowed` admits paths outside
/// `allowed_root` that the user granted through the OS (open dialog, drag &
/// drop, file association) — the command wrapper backs it with the runtime fs
/// scope, which the webview cannot widen either (issue #221: documents on
/// D:\, R:\ or /Volumes need their images too). Returns base64-encoded file
/// contents.
fn read_image_within(
  base_dir: &str,
  src: &str,
  allowed_root: &std::path::Path,
  also_allowed: &dyn Fn(&std::path::Path) -> bool,
) -> Result<String, String> {
  let base = std::path::Path::new(base_dir);
  let candidate = if std::path::Path::new(src).is_absolute() {
    std::path::PathBuf::from(src)
  } else {
    base.join(src)
  };

  let canonical = candidate
    .canonicalize()
    .map_err(|e| format!("Cannot resolve path: {}", e))?;
  let canonical_base = base
    .canonicalize()
    .map_err(|e| format!("Cannot resolve base: {}", e))?;

  if !canonical.starts_with(&canonical_base) {
    return Err("Path is outside the document directory".to_string());
  }

  if is_credential_store(&canonical, allowed_root) {
    return Err("Path is a credential store".to_string());
  }
  let canonical_root = allowed_root
    .canonicalize()
    .unwrap_or_else(|_| allowed_root.to_path_buf());
  if !canonical.starts_with(&canonical_root) && !also_allowed(&canonical) {
    return Err("Path is outside the allowed directory".to_string());
  }

  // Open without following symlinks to prevent TOCTOU after canonicalize.
  // Note: O_NOFOLLOW / FILE_FLAG_OPEN_REPARSE_POINT protect the terminal path
  // segment. Parent directory swaps would require openat(), which is out of scope
  // for a desktop Markdown viewer.
  use base64::Engine;
  use std::io::Read;

  #[cfg(unix)]
  let file_result = {
    use std::os::unix::fs::OpenOptionsExt;
    std::fs::OpenOptions::new()
      .read(true)
      .custom_flags(libc::O_NOFOLLOW)
      .open(&canonical)
  };
  #[cfg(windows)]
  let file_result = {
    use std::os::windows::fs::OpenOptionsExt;
    // FILE_FLAG_OPEN_REPARSE_POINT: do not follow symlinks/junctions
    std::fs::OpenOptions::new()
      .read(true)
      .custom_flags(0x00200000)
      .open(&canonical)
  };
  #[cfg(not(any(unix, windows)))]
  let file_result = std::fs::File::open(&canonical);

  let mut file = file_result.map_err(|e| format!("Cannot open file: {}", e))?;
  let mut bytes = Vec::new();
  file.read_to_end(&mut bytes)
    .map_err(|e| format!("Cannot read file: {}", e))?;
  Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

/// Read a document-referenced image, sandboxed to the user's home directory
/// plus whatever the user granted at runtime. See `read_image_within` for why
/// this boundary is enforced on top of the webview-supplied `base_dir`.
#[tauri::command]
fn read_safe_image(
  app: tauri::AppHandle,
  base_dir: String,
  src: String,
) -> Result<String, String> {
  use tauri::Manager;
  let home = app
    .path()
    .home_dir()
    .map_err(|e| format!("Cannot resolve home directory: {}", e))?;
  let scope = app.fs_scope();
  read_image_within(&base_dir, &src, &home, &|p| scope.is_allowed(p))
}

/// Grant the webview read access to a file the OS handed us (file
/// association, CLI argument, second-instance argv, macOS "Open With").
/// Unlike the open dialog and drag & drop, these paths reach Rendu without
/// tauri-plugin-fs seeing them, so nothing else adds them to the runtime scope
/// and files outside `$HOME` failed with `forbidden path` (issue #221).
fn grant_opened_file<R: tauri::Runtime>(app: &tauri::AppHandle<R>, path: &std::path::Path) {
  let scope = app.fs_scope();
  if let Err(e) = scope.allow_file(path) {
    log::warn!("failed to allow {} in fs scope: {}", path.display(), e);
  }
  // Also granted here, not only by the scope listener: when another thread is
  // emitting a scope event, tauri queues ours and `allow_file` returns before
  // the listener runs, so the frontend could list the folder too early.
  if let Some(dir) = folder_to_grant(path) {
    if let Err(e) = scope.allow_directory(dir, true) {
      log::warn!("failed to allow {} in fs scope: {}", dir.display(), e);
    }
  }
}

/// Rendu shows an opened Markdown file's folder in the sidebar (the frontend
/// re-roots to the parent and lists it), so a file-only grant leaves the
/// sidebar at `forbidden path` outside `$HOME` (issue #221). The open dialog
/// and drag & drop grant just the file, so this is applied to every file that
/// enters the runtime scope. Recursive so subfolders expand and relative
/// images resolve; for a file at a drive root that means the whole drive,
/// which is the same reach as opening that folder. Non-Markdown grants (the
/// PDF save dialog) don't widen anything.
fn folder_to_grant(granted: &std::path::Path) -> Option<&std::path::Path> {
  if !is_markdown_path(&granted.to_string_lossy()) || !granted.is_file() {
    return None;
  }
  granted.parent().filter(|p| !p.as_os_str().is_empty())
}

/// Check if a path looks like a markdown file (by extension).
fn is_markdown_path(path: &str) -> bool {
  let lower = path.to_lowercase();
  lower.ends_with(".md") || lower.ends_with(".markdown")
}

/// Find the first markdown file path in CLI argv, resolved against `cwd`.
/// `argv[0]` is the executable path and is always skipped.
/// Returns the absolute path as a String if it exists and looks like markdown.
#[cfg(desktop)]
fn pick_markdown_arg(argv: &[String], cwd: &std::path::Path) -> Option<String> {
  for arg in argv.iter().skip(1) {
    if !is_markdown_path(arg) {
      continue;
    }
    let candidate = std::path::Path::new(arg);
    let resolved = if candidate.is_absolute() {
      candidate.to_path_buf()
    } else {
      cwd.join(candidate)
    };
    if resolved.exists() {
      if let Some(s) = resolved.to_str() {
        return Some(s.to_string());
      }
    }
  }
  None
}

/// Inner implementation: atomically write `contents` to `target` via a sibling
/// tmp file + rename, but only if `target`'s canonicalized parent lives under
/// `allowed_base`. Refuses any path that resolves outside the sandbox.
fn atomic_write_inner(
  allowed_base: &std::path::Path,
  target: &std::path::Path,
  contents: &[u8],
) -> Result<(), String> {
  use std::io::Write;

  let parent = target
    .parent()
    .filter(|p| !p.as_os_str().is_empty())
    .ok_or_else(|| "Path has no parent directory".to_string())?;
  let file_name = target
    .file_name()
    .ok_or_else(|| "Path has no file name".to_string())?;

  let canonical_parent = parent
    .canonicalize()
    .map_err(|e| format!("Cannot resolve target parent: {}", e))?;
  let canonical_base = allowed_base
    .canonicalize()
    .map_err(|e| format!("Cannot resolve allowed base: {}", e))?;

  if !canonical_parent.starts_with(&canonical_base) {
    return Err("Path is outside the allowed directory".to_string());
  }

  // Use canonical_parent so the rename target matches the validated path.
  let canonical_target = canonical_parent.join(file_name);
  let tmp = {
    let mut name = file_name.to_os_string();
    name.push(".tmp");
    canonical_parent.join(name)
  };

  {
    let mut file = std::fs::File::create(&tmp)
      .map_err(|e| format!("Cannot create tmp file: {}", e))?;
    file.write_all(contents).map_err(|e| {
      let _ = std::fs::remove_file(&tmp);
      format!("Cannot write tmp file: {}", e)
    })?;
    file.sync_all().map_err(|e| {
      let _ = std::fs::remove_file(&tmp);
      format!("Cannot fsync tmp file: {}", e)
    })?;
  }

  std::fs::rename(&tmp, &canonical_target).map_err(|e| {
    let _ = std::fs::remove_file(&tmp);
    format!("Cannot rename tmp to target: {}", e)
  })?;
  Ok(())
}

/// The only files the webview may write. On macOS and Windows the app config
/// dir is also the app data dir, which holds tauri-plugin-persisted-scope's
/// `.persisted-scope`; writing that file would let a compromised webview
/// grant itself any folder on the next launch. So the webview names one of
/// these files and Rust picks the path (issue #221 review).
const WRITABLE_CONFIG_FILES: &[&str] = &["settings.json", "recent.json"];

fn config_file_target(config_dir: &std::path::Path, name: &str) -> Result<std::path::PathBuf, String> {
  if !WRITABLE_CONFIG_FILES.contains(&name) {
    return Err(format!("Not a writable config file: {}", name));
  }
  Ok(config_dir.join(name))
}

/// Atomically write one of `WRITABLE_CONFIG_FILES` in the app config dir via
/// a sibling tmp file + rename. Guarantees the target is either the prior
/// version or the new version — never a half-written file. This is the
/// webview's only write path: fs:allow-write-text-file is not granted, because
/// plugin-fs ORs a command's scope with the runtime scope, which would make
/// every folder the user opens writable.
#[tauri::command]
fn atomic_write(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String> {
  let config_dir = app
    .path()
    .app_config_dir()
    .map_err(|e| format!("Cannot resolve app config dir: {}", e))?;
  let target = config_file_target(&config_dir, &name)?;
  std::fs::create_dir_all(&config_dir)
    .map_err(|e| format!("Cannot create app config dir: {}", e))?;
  atomic_write_inner(&config_dir, &target, contents.as_bytes())
}

/// Holds at most one active filesystem watcher. Starting a new watch
/// drops the previous `Debouncer`, which stops its background thread and
/// releases the OS watch handles (notify-debouncer-mini stops on Drop).
///
/// Debounce window is 5 seconds — we prefer stability over responsiveness
/// for a reader app.
#[derive(Default)]
struct WatchState(Mutex<Option<Debouncer<RecommendedWatcher>>>);

const WATCH_DEBOUNCE: Duration = Duration::from_secs(5);

/// Payload emitted on the `fs-changed` event. `path` is the same string
/// the frontend passed to `start_watching` (echoed verbatim per the
/// React/Rust contract).
#[derive(Clone, Serialize)]
struct FsChangedPayload {
  kind: &'static str,
  path: String,
}

/// Map the frontend-supplied `kind` string to a static tag + notify mode.
/// Returned `&'static str` is what we echo back in the `fs-changed`
/// payload so we never allocate from the caller-supplied String again.
fn validate_watch_kind(kind: &str) -> Result<(&'static str, RecursiveMode), String> {
  match kind {
    "file" => Ok(("file", RecursiveMode::NonRecursive)),
    "directory" => Ok(("directory", RecursiveMode::Recursive)),
    other => Err(format!(
      "Invalid kind: {} (expected \"file\" or \"directory\")",
      other
    )),
  }
}

/// Reject paths that don't exist or whose file-system type doesn't match
/// the caller-supplied `kind`. The latter prevents notify from silently
/// using the wrong `RecursiveMode` if the frontend passes `kind: "file"`
/// for a directory (notify accepts it but then misses nested changes).
///
/// We don't canonicalize: the frontend must get the *same* path string
/// back in the `fs-changed` event so it can match against its own state.
fn validate_watch_path(path: &str, expected_kind: &str) -> Result<std::path::PathBuf, String> {
  let p = std::path::PathBuf::from(path);
  // symlink_metadata() to avoid following links — same threat model as
  // read_safe_image: the webview cannot use a link to escape its intent.
  let meta = p
    .symlink_metadata()
    .map_err(|e| format!("Path does not exist: {} ({})", path, e))?;
  match expected_kind {
    "file" if !meta.is_file() => Err(format!(
      "Path is not a regular file: {} (kind=\"file\" requires a file)",
      path
    )),
    "directory" if !meta.is_dir() => Err(format!(
      "Path is not a directory: {} (kind=\"directory\" requires a directory)",
      path
    )),
    _ => Ok(p),
  }
}

#[tauri::command]
fn start_watching(
  app: tauri::AppHandle,
  state: tauri::State<'_, WatchState>,
  path: String,
  kind: String,
) -> Result<(), String> {
  let (kind_static, mode) = validate_watch_kind(&kind)?;
  let watch_path = validate_watch_path(&path, kind_static)?;

  // Drop any prior debouncer *before* constructing the new one so the
  // old OS watch handle is released first. Holding the lock across the
  // new_debouncer call also serializes concurrent start_watching calls.
  let mut guard = state.0.lock();
  *guard = None;

  let echo_path = path.clone();
  let app_handle = app.clone();
  let mut debouncer = new_debouncer(
    WATCH_DEBOUNCE,
    move |res: DebounceEventResult| match res {
      Ok(events) if !events.is_empty() => {
        // Coalesce: we only need to notify the frontend that *something*
        // changed under the watched path. The frontend re-reads on its
        // own. One emit per debounce batch.
        if let Err(e) = app_handle.emit(
          "fs-changed",
          FsChangedPayload {
            kind: kind_static,
            path: echo_path.clone(),
          },
        ) {
          // Most likely the window is gone; just log and move on.
          log::warn!("failed to emit fs-changed for {}: {:?}", echo_path, e);
        }
      }
      Ok(_) => {}
      Err(e) => {
        log::warn!("fs watch error for {}: {:?}", echo_path, e);
      }
    },
  )
  .map_err(|e| format!("Failed to create watcher: {}", e))?;

  debouncer
    .watcher()
    .watch(&watch_path, mode)
    .map_err(|e| format!("Failed to watch path: {}", e))?;

  *guard = Some(debouncer);
  Ok(())
}

#[tauri::command]
fn stop_watching(state: tauri::State<'_, WatchState>) -> Result<(), String> {
  // Dropping the Debouncer ends its background thread and releases watches.
  *state.0.lock() = None;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  // Single-instance plugin must be registered first per Tauri v2 docs.
  // When a second instance is launched, the OS forwards its argv/cwd here and
  // exits the second process; we surface the file (if any) to the running one.
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
      let cwd_path = std::path::PathBuf::from(&cwd);
      let file = pick_markdown_arg(&argv, &cwd_path);

      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
      }

      if let Some(path) = file {
        grant_opened_file(app, std::path::Path::new(&path));
        // Stash into InitialFile so the frontend can pick it up via
        // get_initial_file if the React listener hasn't mounted yet
        // (race on cold start). The listener also handles the live case.
        // Mirrors the macOS RunEvent::Opened path.
        if let Some(state) = app.try_state::<InitialFile>() {
          *state.0.lock() = Some(path.clone());
        }
        let _ = app.emit("file-open-request", &path);
      }
    }));
  }

  builder = builder
    .plugin(tauri_plugin_fs::init())
    // Must come after the fs plugin: it restores grants into the fs scope so
    // folders/files opened from outside $HOME still open from Recent after a
    // restart (issue #221).
    .plugin(tauri_plugin_persisted_scope::init())
    .plugin(tauri_plugin_dialog::init())
    .manage(InitialFile::default())
    .manage(WatchState::default())
    .invoke_handler(tauri::generate_handler![check_for_updates, get_initial_file, open_external_url, open_path, export_pdf, read_safe_image, atomic_write, start_watching, stop_watching]);

  #[cfg(feature = "e2e-testing")]
  {
    builder = builder.plugin(tauri_plugin_playwright::init());
  }

  let built_app = builder
    .setup(|app| {
      // --- Build native menu bar ---

      // Rendu (app) menu
      let about_meta = AboutMetadataBuilder::new()
        .name(Some("Rendu"))
        .version(Some(env!("CARGO_PKG_VERSION")))
        .copyright(Some("Copyright © 2026 Hideo Kashioka. All rights reserved."))
        .build();
      let app_menu = SubmenuBuilder::new(app, "Rendu")
        .about(Some(about_meta))
        .separator()
        .quit()
        .build()?;

      // File menu
      let open_folder = MenuItemBuilder::with_id("open_folder", "Open Folder...")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
      let open_file = MenuItemBuilder::with_id("open_file", "Open File...")
        .accelerator("CmdOrCtrl+Shift+O")
        .build(app)?;
      let print = MenuItemBuilder::with_id("print", "Print...")
        .accelerator("CmdOrCtrl+P")
        .build(app)?;

      let file_menu = SubmenuBuilder::new(app, "File")
        .item(&open_folder)
        .item(&open_file)
        .separator()
        .item(&print)
        .build()?;

      // Edit menu (viewer-only: Copy)
      let edit_menu = SubmenuBuilder::new(app, "Edit")
        .copy()
        .build()?;

      // Window menu
      let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .separator()
        .fullscreen()
        .build()?;

      // Help menu
      let supported_syntax = MenuItemBuilder::with_id("supported_syntax", "Supported Syntax")
        .build(app)?;
      let website = MenuItemBuilder::with_id("website", "Rendu Website")
        .build(app)?;
      let report_issue = MenuItemBuilder::with_id("report_issue", "Report Issue on GitHub...")
        .build(app)?;
      let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&supported_syntax)
        .separator()
        .item(&website)
        .item(&report_issue)
        .build()?;

      let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&window_menu)
        .item(&help_menu)
        .build()?;

      app.set_menu(menu)?;

      // --- Handle menu events ---
      let app_handle = app.handle().clone();
      app.on_menu_event(move |_app, event| {
        match event.id().as_ref() {
          "open_folder"  => { let _ = app_handle.emit("menu-open-folder", ()); }
          "open_file"    => { let _ = app_handle.emit("menu-open-file", ()); }
          "print"        => { let _ = app_handle.emit("menu-print", ()); }
          "supported_syntax" => { let _ = app_handle.emit("menu-supported-syntax", ()); }
          "website"      => { let _ = open::that("https://kashioka.github.io/Rendu/"); }
          "report_issue" => { let _ = open::that("https://github.com/kashioka/Rendu/issues"); }
          _ => {}
        }
      });

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Registered before any grant below so the folder of every opened file
      // follows its file into the scope (see `folder_to_grant`). Grants made
      // inside the listener are queued by the scope and re-emitted, so the
      // persisted-scope plugin saves them too.
      //
      // Known limitation: for open-dialog and drag & drop grants (made inside
      // the plugins, so `grant_opened_file` can't run), the listener is the
      // only folder grant. If another thread is emitting a scope event at that
      // instant, the event is queued and the frontend may list the folder
      // before it is granted; the sidebar and relative images then show
      // `forbidden path` and are not retried. Recovery: Open Folder on the
      // parent, then pick the document again. Needs two opens at once.
      let scope = app.fs_scope();
      let listener_scope = scope.clone();
      scope.listen(move |event| {
        if let tauri::scope::fs::Event::PathAllowed(path) = event {
          if let Some(dir) = folder_to_grant(path) {
            if let Err(e) = listener_scope.allow_directory(dir, true) {
              log::warn!("failed to allow {} in fs scope: {}", dir.display(), e);
            }
          }
        }
      });

      // Parse CLI arguments for file association (Windows / Linux / macOS open-with)
      let args: Vec<String> = std::env::args().collect();
      if let Some(file_path) = args.get(1) {
        if is_markdown_path(file_path) && std::path::Path::new(file_path).exists() {
          // Absolute so the scope pattern matches what plugin-fs resolves.
          let file_path = std::path::absolute(file_path)
            .ok()
            .and_then(|p| p.to_str().map(String::from))
            .unwrap_or_else(|| file_path.clone());
          grant_opened_file(app.handle(), std::path::Path::new(&file_path));
          let state = app.state::<InitialFile>();
          *state.0.lock() = Some(file_path);
        }
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  built_app.run(|_app_handle, _event| {
    // macOS: handle file open via Finder double-click / "Open With" / `open -a`
    #[cfg(target_os = "macos")]
    if let RunEvent::Opened { urls } = &_event {
      for url in urls {
        let path = if url.scheme() == "file" {
          url.to_file_path().ok().and_then(|p| p.to_str().map(String::from))
        } else {
          None
        };
        if let Some(p) = path {
          if is_markdown_path(&p) {
            grant_opened_file(_app_handle, std::path::Path::new(&p));
            // Store in InitialFile so the frontend can pick it up on cold start
            let state = _app_handle.state::<InitialFile>();
            *state.0.lock() = Some(p.clone());
            let _ = _app_handle.emit("file-open-request", &p);
            break;
          }
        }
      }
    }
  });
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;
  use std::io::Write;
  use tempfile::tempdir;

  /// `also_allowed` for tests that exercise only the home boundary.
  const DENY_ALL: fn(&std::path::Path) -> bool = |_| false;

  // ------------------------------------------------------------------
  // os_download_url
  // ------------------------------------------------------------------

  #[test]
  fn os_download_url_builds_direct_link_for_macos_and_windows() {
    assert_eq!(
      os_download_url("macos", "v0.9.0", "0.9.0"),
      Some("https://github.com/kashioka/Rendu/releases/download/v0.9.0/Rendu_0.9.0_aarch64.dmg".to_string())
    );
    assert_eq!(
      os_download_url("windows", "v0.9.0", "0.9.0"),
      Some("https://github.com/kashioka/Rendu/releases/download/v0.9.0/Rendu_0.9.0_x64-setup.exe".to_string())
    );
  }

  #[test]
  fn os_download_url_returns_none_for_linux_and_unknown() {
    // Linux ships .deb/.rpm/.AppImage — no single installer to link to.
    assert_eq!(os_download_url("linux", "v0.9.0", "0.9.0"), None);
    assert_eq!(os_download_url("freebsd", "v0.9.0", "0.9.0"), None);
  }

  // ------------------------------------------------------------------
  // is_allowed_external_url
  // ------------------------------------------------------------------

  #[test]
  fn external_url_allows_only_web_and_mail() {
    assert!(is_allowed_external_url("https://example.com"));
    assert!(is_allowed_external_url("http://example.com/path"));
    assert!(is_allowed_external_url("HTTPS://Example.com")); // case-insensitive
    assert!(is_allowed_external_url("mailto:a@b.com"));
    assert!(is_allowed_external_url("  https://example.com")); // leading space
  }

  #[test]
  fn external_url_rejects_dangerous_schemes() {
    assert!(!is_allowed_external_url("file:///etc/passwd"));
    assert!(!is_allowed_external_url("smb://attacker/share"));
    assert!(!is_allowed_external_url("javascript:alert(1)"));
    assert!(!is_allowed_external_url("vscode://x"));
    assert!(!is_allowed_external_url("/Applications/Calculator.app"));
    assert!(!is_allowed_external_url(""));
  }

  // ------------------------------------------------------------------
  // is_executable_extension
  // ------------------------------------------------------------------

  #[test]
  fn executable_extension_flags_os_executable_types() {
    for p in [
      "/x/evil.command", "/x/Foo.app", "C:/x/evil.exe", "C:/x/evil.bat",
      "/x/script.scpt", "/x/thing.workflow", "/x/EVIL.EXE",
      "/x/installer.pkg", "C:/x/setup.msix", "C:/x/app.appinstaller",
    ] {
      assert!(is_executable_extension(p), "should flag {p}");
    }
  }

  #[test]
  fn executable_extension_allows_passive_documents() {
    for p in ["/x/report.pdf", "/x/img.png", "/x/notes.txt", "/x/data.csv", "/x/no_ext"] {
      assert!(!is_executable_extension(p), "should allow {p}");
    }
  }

  // ------------------------------------------------------------------
  // is_markdown_path
  // ------------------------------------------------------------------

  #[test]
  fn is_markdown_path_accepts_md_extension() {
    assert!(is_markdown_path("README.md"));
    assert!(is_markdown_path("/path/to/file.md"));
    assert!(is_markdown_path("notes.markdown"));
  }

  #[test]
  fn is_markdown_path_is_case_insensitive() {
    assert!(is_markdown_path("README.MD"));
    assert!(is_markdown_path("notes.MARKDOWN"));
    assert!(is_markdown_path("hello.MarKdoWn"));
  }

  #[test]
  fn is_markdown_path_rejects_other_extensions() {
    assert!(!is_markdown_path("file.txt"));
    assert!(!is_markdown_path("file.json"));
    assert!(!is_markdown_path("file.html"));
    assert!(!is_markdown_path("file.md.bak"));
  }

  #[test]
  fn is_markdown_path_rejects_no_extension_or_empty() {
    assert!(!is_markdown_path(""));
    assert!(!is_markdown_path("README"));
    assert!(!is_markdown_path("md"));
    assert!(!is_markdown_path("markdown"));
  }

  // ------------------------------------------------------------------
  // pick_markdown_arg — single-instance argv parser
  // ------------------------------------------------------------------

  #[cfg(desktop)]
  #[test]
  fn pick_markdown_arg_resolves_relative_path_via_cwd() {
    let dir = tempdir().unwrap();
    let md = dir.path().join("notes.md");
    write_file(&md, b"# hi");

    let argv = vec!["rendu".to_string(), "notes.md".to_string()];
    let picked = pick_markdown_arg(&argv, dir.path()).expect("should pick");
    assert_eq!(std::path::PathBuf::from(picked), md);
  }

  #[cfg(desktop)]
  #[test]
  fn pick_markdown_arg_returns_absolute_path_as_is() {
    let dir = tempdir().unwrap();
    let md = dir.path().join("a.markdown");
    write_file(&md, b"x");

    let argv = vec!["rendu".to_string(), md.to_string_lossy().to_string()];
    // cwd is irrelevant when arg is absolute
    let picked = pick_markdown_arg(&argv, std::path::Path::new("/")).expect("should pick");
    assert_eq!(std::path::PathBuf::from(picked), md);
  }

  #[cfg(desktop)]
  #[test]
  fn pick_markdown_arg_skips_argv0_executable() {
    // argv[0] is the executable path; even if it happens to end in .md it
    // must not be returned. (Defensive: callers should not rely on this.)
    let dir = tempdir().unwrap();
    let fake_exe = dir.path().join("rendu.md");
    write_file(&fake_exe, b"not really markdown");

    let argv = vec![fake_exe.to_string_lossy().to_string()];
    assert!(pick_markdown_arg(&argv, dir.path()).is_none());
  }

  #[cfg(desktop)]
  #[test]
  fn pick_markdown_arg_returns_none_for_missing_file() {
    let dir = tempdir().unwrap();
    let argv = vec!["rendu".to_string(), "missing.md".to_string()];
    assert!(pick_markdown_arg(&argv, dir.path()).is_none());
  }

  #[cfg(desktop)]
  #[test]
  fn pick_markdown_arg_returns_none_for_non_markdown_arg() {
    let dir = tempdir().unwrap();
    let other = dir.path().join("notes.txt");
    write_file(&other, b"x");
    let argv = vec!["rendu".to_string(), "notes.txt".to_string()];
    assert!(pick_markdown_arg(&argv, dir.path()).is_none());
  }

  #[cfg(desktop)]
  #[test]
  fn pick_markdown_arg_returns_none_when_no_extra_args() {
    let dir = tempdir().unwrap();
    let argv = vec!["rendu".to_string()];
    assert!(pick_markdown_arg(&argv, dir.path()).is_none());
  }

  // Regression test for Codex finding: when a second instance forwards a
  // markdown file before the React listener has mounted, the path must be
  // observable via InitialFile so the frontend can still pick it up.
  #[test]
  fn initial_file_take_returns_then_clears() {
    let state = InitialFile::default();
    *state.0.lock() = Some("/path/to/notes.md".to_string());
    assert_eq!(state.0.lock().take(), Some("/path/to/notes.md".to_string()));
    assert_eq!(state.0.lock().take(), None);
  }

  #[test]
  fn initial_file_overwrites_previous_value() {
    // Simulates the single-instance handler receiving a second forwarded
    // file while a stale value from cold start hasn't been consumed yet.
    let state = InitialFile::default();
    *state.0.lock() = Some("/first.md".to_string());
    *state.0.lock() = Some("/second.md".to_string());
    assert_eq!(state.0.lock().take(), Some("/second.md".to_string()));
  }

  #[cfg(desktop)]
  #[test]
  fn pick_markdown_arg_picks_first_markdown_among_multiple_args() {
    let dir = tempdir().unwrap();
    let first = dir.path().join("first.md");
    let second = dir.path().join("second.md");
    write_file(&first, b"1");
    write_file(&second, b"2");
    let argv = vec![
      "rendu".to_string(),
      "--flag".to_string(),
      "first.md".to_string(),
      "second.md".to_string(),
    ];
    let picked = pick_markdown_arg(&argv, dir.path()).expect("should pick");
    assert_eq!(std::path::PathBuf::from(picked), first);
  }

  // ------------------------------------------------------------------
  // read_safe_image — tempfile を使った実 FS テスト（Marky パターン）
  // ------------------------------------------------------------------

  fn write_file(path: &std::path::Path, contents: &[u8]) {
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent).unwrap();
    }
    let mut f = fs::File::create(path).unwrap();
    f.write_all(contents).unwrap();
  }

  // `read_image_within` is the testable core; the command wrapper only injects
  // the OS home dir as `allowed_root`. Tests pass the tempdir root as the
  // allowed root so the home boundary is satisfied for the in-bounds cases.

  #[test]
  fn read_safe_image_reads_file_within_base_dir() {
    let dir = tempdir().unwrap();
    let img = dir.path().join("img.png");
    write_file(&img, b"PNG_BYTES_HERE");

    let result = read_image_within(
      &dir.path().to_string_lossy(),
      "img.png",
      dir.path(),
      &DENY_ALL,
    );
    assert!(result.is_ok(), "expected Ok, got {:?}", result);
    let encoded = result.unwrap();
    use base64::Engine;
    let decoded = base64::engine::general_purpose::STANDARD
      .decode(&encoded)
      .unwrap();
    assert_eq!(decoded, b"PNG_BYTES_HERE");
  }

  #[test]
  fn read_safe_image_supports_subdirectories() {
    let dir = tempdir().unwrap();
    let img = dir.path().join("assets").join("nested.png");
    write_file(&img, b"NESTED_PNG");

    let result = read_image_within(
      &dir.path().to_string_lossy(),
      "assets/nested.png",
      dir.path(),
      &DENY_ALL,
    );
    assert!(result.is_ok());
  }

  #[test]
  fn read_safe_image_rejects_relative_path_traversal() {
    let dir = tempdir().unwrap();
    let inner = dir.path().join("inner");
    fs::create_dir_all(&inner).unwrap();
    // base_dir = inner, but try to access ../outside.png at dir.path()
    let outside = dir.path().join("outside.png");
    write_file(&outside, b"SHOULD_NOT_READ");

    let result = read_image_within(&inner.to_string_lossy(), "../outside.png", dir.path(), &DENY_ALL);
    assert!(result.is_err(), "expected Err for path traversal");
    assert!(result.unwrap_err().contains("outside the document directory"));
  }

  #[test]
  fn read_safe_image_rejects_absolute_path_outside_base_dir() {
    let base = tempdir().unwrap();
    let elsewhere = tempdir().unwrap();
    let outside = elsewhere.path().join("secret.png");
    write_file(&outside, b"SECRET");

    let result = read_image_within(
      &base.path().to_string_lossy(),
      &outside.to_string_lossy(),
      base.path(),
      &DENY_ALL,
    );
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("outside the document directory"));
  }

  #[test]
  fn read_safe_image_rejects_path_outside_allowed_root() {
    // The image IS within its base_dir, but base_dir is outside the allowed
    // root (home). A compromised webview passing base_dir="/some/other/dir"
    // must not be able to read files there. Simulates that with two tempdirs.
    let home = tempdir().unwrap();
    let outside = tempdir().unwrap();
    let img = outside.path().join("secret.png");
    write_file(&img, b"SECRET");

    let result = read_image_within(
      &outside.path().to_string_lossy(),
      "secret.png",
      home.path(),
      &DENY_ALL,
    );
    assert!(result.is_err(), "expected Err, got {:?}", result);
    assert!(result.unwrap_err().contains("outside the allowed directory"));
  }

  #[test]
  fn read_safe_image_returns_error_for_missing_file() {
    let dir = tempdir().unwrap();
    let result = read_image_within(&dir.path().to_string_lossy(), "does-not-exist.png", dir.path(), &DENY_ALL);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Cannot resolve path"));
  }

  #[test]
  fn read_safe_image_returns_error_for_missing_base_dir() {
    let dir = tempdir().unwrap();
    let result = read_image_within("/nonexistent/base/dir", "img.png", dir.path(), &DENY_ALL);
    assert!(result.is_err());
  }

  // Issue #221: a document on another drive (D:\, R:\, /Volumes) lives
  // outside home, but the user granted it through the OS. The runtime-scope
  // check admits it; the document-directory boundary still applies.
  #[test]
  fn read_safe_image_allows_path_granted_outside_allowed_root() {
    let home = tempdir().unwrap();
    let other_drive = tempdir().unwrap();
    write_file(&other_drive.path().join("img.png"), b"PNG");
    let granted = other_drive.path().canonicalize().unwrap();

    let result = read_image_within(
      &other_drive.path().to_string_lossy(),
      "img.png",
      home.path(),
      &|p| p.starts_with(&granted),
    );
    assert!(result.is_ok(), "expected Ok, got {:?}", result);
  }

  #[test]
  fn read_safe_image_grant_does_not_bypass_document_directory() {
    let home = tempdir().unwrap();
    let other_drive = tempdir().unwrap();
    let doc_dir = other_drive.path().join("docs");
    fs::create_dir_all(&doc_dir).unwrap();
    write_file(&other_drive.path().join("secret.png"), b"SECRET");

    let result = read_image_within(
      &doc_dir.to_string_lossy(),
      "../secret.png",
      home.path(),
      &|_| true,
    );
    assert!(result.unwrap_err().contains("outside the document directory"));
  }

  // Credential stores stay unreadable through the image command, which reads
  // files itself and so never hits plugin-fs's capability deny list.
  #[test]
  fn read_safe_image_rejects_credential_store_in_home() {
    let home = tempdir().unwrap();
    let ssh = home.path().join(".ssh");
    write_file(&ssh.join("id_ed25519"), b"KEY");

    let result = read_image_within(&ssh.to_string_lossy(), "id_ed25519", home.path(), &DENY_ALL);
    assert!(result.unwrap_err().contains("credential store"));
  }

  // Issue #221 review: `~/.ssh` symlinked onto another volume must stay denied
  // when the user opens a document on that volume.
  #[cfg(unix)]
  #[test]
  fn read_safe_image_rejects_symlinked_credential_store_outside_home() {
    use std::os::unix::fs::symlink;
    let home = tempdir().unwrap();
    let volume = tempdir().unwrap();
    let real_ssh = volume.path().join("ssh");
    write_file(&real_ssh.join("id_ed25519"), b"KEY");
    symlink(&real_ssh, home.path().join(".ssh")).unwrap();

    let result = read_image_within(
      &real_ssh.to_string_lossy(),
      "id_ed25519",
      home.path(),
      &|_| true,
    );
    assert!(result.unwrap_err().contains("credential store"));
  }

  #[test]
  fn is_credential_store_matches_dirs_and_files_only() {
    let home = tempdir().unwrap();
    let h = home.path().canonicalize().unwrap();
    assert!(is_credential_store(&h.join(".ssh/id_rsa"), home.path()));
    assert!(is_credential_store(&h.join(".config/gh/hosts.yml"), home.path()));
    assert!(is_credential_store(&h.join(".netrc"), home.path()));
    assert!(!is_credential_store(&h.join(".config/other/x.png"), home.path()));
    assert!(!is_credential_store(&h.join(".sshnotes/a.png"), home.path()));
    assert!(!is_credential_store(&h.join("docs/a.png"), home.path()));
  }

  // ------------------------------------------------------------------
  // check_open_path: nothing that routes back into Rendu (issue #221 review)
  // ------------------------------------------------------------------

  #[test]
  fn check_open_path_refuses_markdown() {
    let dir = tempdir().unwrap();
    let md = dir.path().join("Notes.MD");
    write_file(&md, b"# x");
    assert!(check_open_path(&md).unwrap_err().contains("Markdown"));
    let pdf = dir.path().join("a.pdf");
    write_file(&pdf, b"%PDF");
    assert!(check_open_path(&pdf).is_ok());
  }

  // `file:///x%2Emd` is decoded to x.md by the OS opener; URLs and relative
  // paths never reach it.
  #[test]
  fn check_open_path_refuses_urls_and_relative_paths() {
    let dir = tempdir().unwrap();
    write_file(&dir.path().join("README.md"), b"# x");
    let url = format!("file://{}/README%2Emd", dir.path().display());
    assert!(check_open_path(std::path::Path::new(&url)).is_err());
    assert!(check_open_path(std::path::Path::new("README.md")).is_err());
    assert!(check_open_path(std::path::Path::new("https://example.com/a.pdf")).is_err());
  }

  // Resolving a UNC path already talks SMB, so these are refused by name,
  // before canonicalize, whether or not they exist.
  #[test]
  fn check_open_path_refuses_network_paths() {
    for p in [
      r"\\attacker\share\doc.pdf",
      r"\\?\UNC\attacker\share\doc.pdf",
      r"\\.\UNC\attacker\share\doc.pdf",
      "//attacker/share/doc.pdf",
      r"/\attacker\share\doc.pdf",
      r"\/attacker\share\doc.pdf",
    ] {
      assert!(check_open_path(std::path::Path::new(p)).unwrap_err().contains("network"), "{p}");
    }
  }

  #[test]
  fn check_open_path_refuses_shortcuts() {
    let dir = tempdir().unwrap();
    for name in ["jump.url", "jump.webloc", "jump.fileloc", "app.desktop"] {
      let p = dir.path().join(name);
      write_file(&p, b"[InternetShortcut]\nURL=file:///tmp/notes.md\n");
      assert!(check_open_path(&p).unwrap_err().contains("shortcut"), "{name}");
    }
  }

  // Links to a folder ("see ./assets/") still open in the file manager.
  #[test]
  fn check_open_path_allows_folders() {
    let dir = tempdir().unwrap();
    assert!(check_open_path(dir.path()).is_ok());
  }

  #[test]
  fn check_open_path_refuses_missing_file() {
    let dir = tempdir().unwrap();
    assert!(check_open_path(&dir.path().join("gone.pdf")).is_err());
  }

  // A non-.md name that resolves to a .md file (symlink here; on Windows also
  // `x.md.` and 8.3 names) is caught via the resolved path, as is an alias to
  // an executable.
  #[cfg(unix)]
  #[test]
  fn check_open_path_checks_resolved_path() {
    use std::os::unix::fs::symlink;
    let dir = tempdir().unwrap();
    let md = dir.path().join("secret.md");
    write_file(&md, b"# x");
    let alias = dir.path().join("alias.txt");
    symlink(&md, &alias).unwrap();
    assert!(check_open_path(&alias).unwrap_err().contains("Markdown"));

    let exe = dir.path().join("run.command");
    write_file(&exe, b"#!/bin/sh");
    let exe_alias = dir.path().join("photo.png");
    symlink(&exe, &exe_alias).unwrap();
    assert!(check_open_path(&exe_alias).unwrap_err().contains("executable"));
  }

  // ------------------------------------------------------------------
  // folder_to_grant (issue #221)
  // ------------------------------------------------------------------

  #[test]
  fn folder_to_grant_returns_parent_of_markdown_file() {
    let dir = tempdir().unwrap();
    let md = dir.path().join("README.md");
    write_file(&md, b"# x");
    assert_eq!(folder_to_grant(&md), Some(dir.path()));
  }

  #[test]
  fn folder_to_grant_ignores_non_markdown_and_directories() {
    let dir = tempdir().unwrap();
    // PDF save dialog grants the target file; that must not widen the scope.
    let pdf = dir.path().join("out.pdf");
    write_file(&pdf, b"%PDF");
    assert_eq!(folder_to_grant(&pdf), None);
    // Folder grants (open-folder dialog, drop) and the parent grant this
    // function itself triggers must not recurse upward.
    let folder = dir.path().join("notes.md");
    fs::create_dir_all(&folder).unwrap();
    assert_eq!(folder_to_grant(&folder), None);
    assert_eq!(folder_to_grant(dir.path()), None);
  }

  #[test]
  fn folder_to_grant_ignores_missing_file() {
    let dir = tempdir().unwrap();
    assert_eq!(folder_to_grant(&dir.path().join("gone.md")), None);
  }

  // ------------------------------------------------------------------
  // atomic_write_inner
  // ------------------------------------------------------------------

  #[test]
  fn config_file_target_allows_only_known_files() {
    let dir = std::path::Path::new("/cfg");
    assert_eq!(config_file_target(dir, "settings.json").unwrap(), dir.join("settings.json"));
    assert_eq!(config_file_target(dir, "recent.json").unwrap(), dir.join("recent.json"));
    // The persisted fs scope lives in the same dir on macOS/Windows.
    assert!(config_file_target(dir, ".persisted-scope").is_err());
    assert!(config_file_target(dir, "../settings.json").is_err());
    assert!(config_file_target(dir, "/etc/passwd").is_err());
    assert!(config_file_target(dir, "sub/settings.json").is_err());
  }

  #[test]
  fn atomic_write_creates_new_file() {
    let dir = tempdir().unwrap();
    let target = dir.path().join("settings.json");
    let result = atomic_write_inner(dir.path(), &target, b"{\"k\":1}");
    assert!(result.is_ok(), "expected Ok, got {:?}", result);
    assert_eq!(fs::read_to_string(&target).unwrap(), "{\"k\":1}");
  }

  #[test]
  fn atomic_write_overwrites_existing_file() {
    let dir = tempdir().unwrap();
    let target = dir.path().join("settings.json");
    write_file(&target, b"{\"k\":\"old\"}");

    let result = atomic_write_inner(dir.path(), &target, b"{\"k\":\"new\"}");
    assert!(result.is_ok());
    assert_eq!(fs::read_to_string(&target).unwrap(), "{\"k\":\"new\"}");
  }

  #[test]
  fn atomic_write_does_not_leave_tmp_file_after_success() {
    let dir = tempdir().unwrap();
    let target = dir.path().join("settings.json");
    atomic_write_inner(dir.path(), &target, b"x").unwrap();
    let tmp = dir.path().join("settings.json.tmp");
    assert!(!tmp.exists(), "tmp file should be cleaned up after rename");
  }

  #[test]
  fn atomic_write_overwrites_stale_tmp_file() {
    // Simulates a prior interrupted write that left a stale .tmp behind.
    // atomic_write must overwrite (not append to) the stale tmp.
    let dir = tempdir().unwrap();
    let target = dir.path().join("settings.json");
    let tmp = dir.path().join("settings.json.tmp");
    write_file(&tmp, b"STALE_PARTIAL_CONTENT");

    atomic_write_inner(dir.path(), &target, b"FRESH").unwrap();
    assert_eq!(fs::read_to_string(&target).unwrap(), "FRESH");
    assert!(!tmp.exists());
  }

  #[test]
  fn atomic_write_preserves_target_when_rename_target_dir_missing() {
    // If parent dir doesn't exist, canonicalize fails — no partial state.
    let dir = tempdir().unwrap();
    let missing_parent = dir.path().join("nonexistent").join("settings.json");
    let result = atomic_write_inner(dir.path(), &missing_parent, b"x");
    assert!(result.is_err());
  }

  #[test]
  fn atomic_write_rejects_target_in_unrelated_directory() {
    // An absolute path to a directory entirely outside allowed_base must be
    // refused — protects against XSS-driven writes to arbitrary FS locations.
    let allowed = tempdir().unwrap();
    let outside = tempdir().unwrap();
    let evil_target = outside.path().join("evil.json");

    let result = atomic_write_inner(allowed.path(), &evil_target, b"pwn");
    assert!(result.is_err(), "expected reject, got {:?}", result);
    assert!(result.unwrap_err().contains("outside the allowed directory"));
    assert!(!evil_target.exists());
  }

  #[test]
  fn atomic_write_rejects_relative_path_traversal() {
    // target = allowed_base/../escaped.json must canonicalize to outside base.
    let allowed = tempdir().unwrap();
    let nested = allowed.path().join("nested");
    fs::create_dir_all(&nested).unwrap();
    let escaping = nested.join("..").join("..").join("escaped.json");

    let result = atomic_write_inner(&nested, &escaping, b"pwn");
    assert!(result.is_err(), "expected reject, got {:?}", result);
    assert!(result.unwrap_err().contains("outside the allowed directory"));
  }

  #[cfg(unix)]
  #[test]
  fn atomic_write_rejects_symlinked_parent_outside_allowed_base() {
    use std::os::unix::fs::symlink;
    let allowed = tempdir().unwrap();
    let elsewhere = tempdir().unwrap();

    // Create allowed/escape -> elsewhere (symlinked dir outside)
    let link = allowed.path().join("escape");
    symlink(elsewhere.path(), &link).unwrap();
    let target = link.join("settings.json");

    let result = atomic_write_inner(allowed.path(), &target, b"pwn");
    assert!(result.is_err(), "symlinked parent must be rejected, got {:?}", result);
    assert!(result.unwrap_err().contains("outside the allowed directory"));
  }

  #[cfg(unix)]
  #[test]
  fn read_safe_image_rejects_symlink_pointing_outside_base_dir() {
    use std::os::unix::fs::symlink;
    let base = tempdir().unwrap();
    let elsewhere = tempdir().unwrap();
    let target = elsewhere.path().join("secret.png");
    write_file(&target, b"SECRET");

    let link = base.path().join("link.png");
    symlink(&target, &link).unwrap();

    let result = read_image_within(&base.path().to_string_lossy(), "link.png", base.path(), &DENY_ALL);
    // canonicalize() resolves symlinks, so the canonical path will be outside base_dir
    // and the starts_with() check should reject it.
    assert!(result.is_err(), "symlink to outside should be rejected, got {:?}", result);
    assert!(result.unwrap_err().contains("outside the document directory"));
  }

  // ------------------------------------------------------------------
  // fs watch — validators + state machine
  //
  // We don't drive notify in unit tests: real fs events are racy and OS
  // -specific, so the debounce + delivery path is exercised via the
  // React integration + manual scenarios per the task spec. Here we
  // cover the pure validators and the WatchState start→stop / start→
  // start (replace) invariants.
  // ------------------------------------------------------------------

  #[test]
  fn validate_watch_kind_accepts_file_and_directory() {
    let (tag, mode) = validate_watch_kind("file").unwrap();
    assert_eq!(tag, "file");
    assert_eq!(mode, RecursiveMode::NonRecursive);

    let (tag, mode) = validate_watch_kind("directory").unwrap();
    assert_eq!(tag, "directory");
    assert_eq!(mode, RecursiveMode::Recursive);
  }

  #[test]
  fn validate_watch_kind_rejects_unknown_kind() {
    let err = validate_watch_kind("FILE").unwrap_err();
    assert!(err.contains("Invalid kind"));
    let err = validate_watch_kind("").unwrap_err();
    assert!(err.contains("Invalid kind"));
    let err = validate_watch_kind("recursive").unwrap_err();
    assert!(err.contains("Invalid kind"));
  }

  #[test]
  fn validate_watch_path_accepts_matching_kind() {
    let dir = tempdir().unwrap();
    let file = dir.path().join("notes.md");
    write_file(&file, b"x");

    assert!(validate_watch_path(&file.to_string_lossy(), "file").is_ok());
    assert!(validate_watch_path(&dir.path().to_string_lossy(), "directory").is_ok());
  }

  #[test]
  fn validate_watch_path_rejects_missing_path() {
    let dir = tempdir().unwrap();
    let missing = dir.path().join("does-not-exist.md");
    let err = validate_watch_path(&missing.to_string_lossy(), "file").unwrap_err();
    assert!(err.contains("Path does not exist"));
  }

  #[test]
  fn validate_watch_path_rejects_directory_when_kind_is_file() {
    // Codex round 1: notify silently uses the wrong RecursiveMode if the
    // frontend bug or race passes kind="file" for a directory. Refuse.
    let dir = tempdir().unwrap();
    let err = validate_watch_path(&dir.path().to_string_lossy(), "file").unwrap_err();
    assert!(err.contains("not a regular file"), "got: {}", err);
  }

  #[test]
  fn validate_watch_path_rejects_file_when_kind_is_directory() {
    let dir = tempdir().unwrap();
    let file = dir.path().join("notes.md");
    write_file(&file, b"x");
    let err = validate_watch_path(&file.to_string_lossy(), "directory").unwrap_err();
    assert!(err.contains("not a directory"), "got: {}", err);
  }

  // The state machine uses a real Debouncer that spawns a thread; we
  // build one over a tempdir so the test is hermetic.
  fn make_test_debouncer() -> Debouncer<RecommendedWatcher> {
    new_debouncer(WATCH_DEBOUNCE, |_res: DebounceEventResult| {}).unwrap()
  }

  #[test]
  fn watch_state_default_is_none() {
    let state = WatchState::default();
    assert!(state.0.lock().is_none());
  }

  #[test]
  fn watch_state_stop_clears_active_watcher() {
    // Simulates `stop_watching`: assign Some, then None, verify it dropped.
    let state = WatchState::default();
    {
      let dir = tempdir().unwrap();
      let mut d = make_test_debouncer();
      d.watcher().watch(dir.path(), RecursiveMode::Recursive).unwrap();
      *state.0.lock() = Some(d);
    }
    assert!(state.0.lock().is_some());
    *state.0.lock() = None;
    assert!(state.0.lock().is_none());
  }

  #[test]
  fn watch_state_start_replaces_previous_watcher() {
    // The contract: a second start_watching must drop the previous
    // debouncer before installing the new one. We mirror the production
    // sequence `*guard = None; ... *guard = Some(new);` and assert the
    // slot ends up holding the *new* debouncer (i.e. assignment is not
    // a no-op when a previous value exists).
    let state = WatchState::default();
    let dir = tempdir().unwrap();

    let mut first = make_test_debouncer();
    first.watcher().watch(dir.path(), RecursiveMode::Recursive).unwrap();
    *state.0.lock() = Some(first);

    // Production order: drop first, *then* construct second.
    {
      let mut guard = state.0.lock();
      *guard = None;
      assert!(guard.is_none(), "old watcher must drop before new one is built");
      let mut second = make_test_debouncer();
      second.watcher().watch(dir.path(), RecursiveMode::Recursive).unwrap();
      *guard = Some(second);
    }
    assert!(state.0.lock().is_some());
  }

  // ------------------------------------------------------------------
  // fs scope configuration (issue #178)
  // ------------------------------------------------------------------

  /// Dot-directories (`.notes/`, `.github/`) must be readable under `$HOME`,
  /// so `requireLiteralLeadingDot` is turned off. In exchange, well-known
  /// credential stores are explicitly denied. This test pins both halves so
  /// neither can be dropped silently.
  #[test]
  fn fs_scope_allows_dot_dirs_but_denies_credential_stores() {
    let conf: serde_json::Value =
      serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
    assert_eq!(
      conf["plugins"]["fs"]["requireLiteralLeadingDot"],
      serde_json::Value::Bool(false),
      "requireLiteralLeadingDot must be false so $HOME/** matches dot-directories (issue #178)"
    );

    let cap: serde_json::Value =
      serde_json::from_str(include_str!("../capabilities/default.json")).unwrap();
    let scope = cap["permissions"]
      .as_array()
      .unwrap()
      .iter()
      .find(|p| p["identifier"] == "fs:scope")
      .expect("fs:scope permission present");
    let paths = |key: &str| -> Vec<String> {
      scope[key]
        .as_array()
        .map(|a| a.as_slice())
        .unwrap_or(&[])
        .iter()
        .map(|e| e["path"].as_str().unwrap().to_string())
        .collect()
    };
    let allow = paths("allow");
    let deny = paths("deny");

    assert!(allow.iter().any(|p| p == "$HOME/**"));
    // `$HOME/**` does not match `$HOME` itself, so a file opened from the
    // home root left the sidebar at `forbidden path` (issue #221).
    assert!(allow.iter().any(|p| p == "$HOME"), "allow missing $HOME (issue #221)");

    // read_safe_image enforces the same list itself; keep the two in sync.
    // `X/**` does not match `X` itself in the glob crate, so dirs need both.
    let mut expected_deny: Vec<String> = CREDENTIAL_DIRS
      .iter()
      .flat_map(|d| [format!("$HOME/{d}"), format!("$HOME/{d}/**")])
      .chain(CREDENTIAL_FILES.iter().map(|f| format!("$HOME/{f}")))
      .collect();
    let mut actual_deny = deny.clone();
    actual_deny.sort();
    expected_deny.sort();
    assert_eq!(actual_deny, expected_deny, "fs:scope deny must match CREDENTIAL_DIRS/FILES");

    for dir in [
      ".ssh",
      ".gnupg",
      ".aws",
      ".azure",
      ".kube",
      ".docker",
      ".config/gcloud",
      ".config/gh",
    ] {
      // `X/**` does not match `X` itself in the glob crate, so both forms are
      // needed to block listing the directory as well as reading its files.
      assert!(deny.iter().any(|p| p == &format!("$HOME/{dir}")), "deny missing $HOME/{dir}");
      assert!(deny.iter().any(|p| p == &format!("$HOME/{dir}/**")), "deny missing $HOME/{dir}/**");
    }
    for file in [".netrc", ".npmrc", ".pypirc", ".git-credentials"] {
      assert!(deny.iter().any(|p| p == &format!("$HOME/{file}")), "deny missing $HOME/{file}");
    }
  }
}
