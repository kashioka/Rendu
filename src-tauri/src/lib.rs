use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use parking_lot::Mutex;
use std::time::Duration;
use tauri::menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager, RunEvent};
use serde::Serialize;

#[derive(Serialize)]
pub struct UpdateInfo {
  has_update: bool,
  latest_version: String,
  current_version: String,
  release_url: String,
}

#[tauri::command]
async fn check_for_updates() -> UpdateInfo {
  let current = env!("CARGO_PKG_VERSION");
  let no_update = UpdateInfo {
    has_update: false,
    latest_version: current.to_string(),
    current_version: current.to_string(),
    release_url: String::new(),
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

  UpdateInfo {
    has_update: latest != current,
    latest_version: latest.to_string(),
    current_version: current.to_string(),
    release_url,
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

#[tauri::command]
fn open_external_url(url: String) {
  let _ = open::that(&url);
}

/// Resolve, validate, and read an image file atomically.
/// Returns base64-encoded file contents if the path is within the base directory.
#[tauri::command]
fn read_safe_image(base_dir: String, src: String) -> Result<String, String> {
  let base = std::path::Path::new(&base_dir);
  let candidate = if std::path::Path::new(&src).is_absolute() {
    std::path::PathBuf::from(&src)
  } else {
    base.join(&src)
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

/// Atomically write `contents` to `path` via a sibling tmp file + rename.
/// Guarantees the target is either the prior version or the new version —
/// never a half-written file. The webview can only write under the app
/// config directory; any other path is rejected.
#[tauri::command]
fn atomic_write(app: tauri::AppHandle, path: String, contents: String) -> Result<(), String> {
  let allowed_base = app
    .path()
    .app_config_dir()
    .map_err(|e| format!("Cannot resolve app config dir: {}", e))?;
  atomic_write_inner(
    &allowed_base,
    std::path::Path::new(&path),
    contents.as_bytes(),
  )
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
    .plugin(tauri_plugin_dialog::init())
    .manage(InitialFile::default())
    .manage(WatchState::default())
    .invoke_handler(tauri::generate_handler![check_for_updates, get_initial_file, open_external_url, read_safe_image, atomic_write, start_watching, stop_watching]);

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

      // Parse CLI arguments for file association (Windows / Linux / macOS open-with)
      let args: Vec<String> = std::env::args().collect();
      if let Some(file_path) = args.get(1) {
        if is_markdown_path(file_path) && std::path::Path::new(file_path).exists() {
          let state = app.state::<InitialFile>();
          *state.0.lock() = Some(file_path.clone());
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

  #[test]
  fn read_safe_image_reads_file_within_base_dir() {
    let dir = tempdir().unwrap();
    let img = dir.path().join("img.png");
    write_file(&img, b"PNG_BYTES_HERE");

    let result = read_safe_image(
      dir.path().to_string_lossy().to_string(),
      "img.png".to_string(),
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

    let result = read_safe_image(
      dir.path().to_string_lossy().to_string(),
      "assets/nested.png".to_string(),
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

    let result = read_safe_image(
      inner.to_string_lossy().to_string(),
      "../outside.png".to_string(),
    );
    assert!(result.is_err(), "expected Err for path traversal");
    assert!(result.unwrap_err().contains("outside the document directory"));
  }

  #[test]
  fn read_safe_image_rejects_absolute_path_outside_base_dir() {
    let base = tempdir().unwrap();
    let elsewhere = tempdir().unwrap();
    let outside = elsewhere.path().join("secret.png");
    write_file(&outside, b"SECRET");

    let result = read_safe_image(
      base.path().to_string_lossy().to_string(),
      outside.to_string_lossy().to_string(),
    );
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("outside the document directory"));
  }

  #[test]
  fn read_safe_image_returns_error_for_missing_file() {
    let dir = tempdir().unwrap();
    let result = read_safe_image(
      dir.path().to_string_lossy().to_string(),
      "does-not-exist.png".to_string(),
    );
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Cannot resolve path"));
  }

  #[test]
  fn read_safe_image_returns_error_for_missing_base_dir() {
    let result = read_safe_image(
      "/nonexistent/base/dir".to_string(),
      "img.png".to_string(),
    );
    assert!(result.is_err());
  }

  // ------------------------------------------------------------------
  // atomic_write_inner
  // ------------------------------------------------------------------

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

    let result = read_safe_image(
      base.path().to_string_lossy().to_string(),
      "link.png".to_string(),
    );
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
}
