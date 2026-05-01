use std::sync::Mutex;
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
  state.0.lock().unwrap().take()
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .manage(InitialFile::default())
    .invoke_handler(tauri::generate_handler![check_for_updates, get_initial_file, open_external_url, read_safe_image]);

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
          *state.0.lock().unwrap() = Some(file_path.clone());
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
            *state.0.lock().unwrap() = Some(p.clone());
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
}
