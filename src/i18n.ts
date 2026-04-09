export type Locale = "en" | "ja";

export interface Translations {
  // App / Sidebar
  "sidebar.toggle.hide": string;
  "sidebar.toggle.show": string;
  "sidebar.folder": string;
  "sidebar.folder.title": string;
  "sidebar.file": string;
  "sidebar.file.title": string;
  "sidebar.settings.title": string;
  "sidebar.emptyFolder": string;
  "sidebar.outline": string;

  // Empty state
  "app.selectFile": string;

  // Outline
  "outline.title": string;
  "outline.noHeadings": string;

  // Viewer
  "viewer.loading": string;
  "viewer.error.title": string;
  "viewer.error.path": string;
  "viewer.search.placeholder": string;
  "viewer.search.noResults": string;
  "viewer.matchCount": string;
  "viewer.lineToggle.hide": string;
  "viewer.lineToggle.show": string;
  "viewer.exportPdf": string;
  "viewer.exportPdf.exporting": string;
  "viewer.exportPdf.overlay": string;
  "viewer.exportPdf.error": string;
  "viewer.refresh": string;
  "viewer.zoom.in": string;
  "viewer.zoom.out": string;
  "viewer.zoom.reset": string;
  "viewer.image.download": string;
  "viewer.mermaid.download": string;
  "viewer.lightbox.close": string;
  "viewer.lightbox.download": string;

  // Mermaid
  "mermaid.renderError": string;

  // Settings
  "settings.title": string;
  "settings.language": string;
  "settings.theme": string;
  "settings.appColors": string;
  "settings.markdownColors": string;
  "settings.mermaidColors": string;
  "settings.autoSave": string;

  // Settings - App Colors
  "settings.color.background": string;
  "settings.color.sidebar": string;
  "settings.color.text": string;
  "settings.color.mutedText": string;
  "settings.color.border": string;
  "settings.color.button": string;

  // Settings - Markdown Colors
  "settings.color.heading": string;
  "settings.color.link": string;
  "settings.color.codeBg": string;
  "settings.color.mdBorder": string;

  // Settings - Mermaid Colors
  "settings.color.mermaidBg": string;
  "settings.color.primary": string;
  "settings.color.primaryText": string;
  "settings.color.lineArrow": string;
  "settings.color.actorBox": string;
  "settings.color.actorText": string;
  "settings.color.signalText": string;
  "settings.color.noteBg": string;
  "settings.color.noteText": string;
}

const en: Translations = {
  "sidebar.toggle.hide": "Hide sidebar",
  "sidebar.toggle.show": "Show sidebar",
  "sidebar.folder": "Folder",
  "sidebar.folder.title": "Open folder",
  "sidebar.file": "File",
  "sidebar.file.title": "Open file",
  "sidebar.settings.title": "Settings",
  "sidebar.emptyFolder": "Select a folder to get started",
  "sidebar.outline": "Outline",

  "app.selectFile": "Select a Markdown file to get started",

  "outline.title": "Outline",
  "outline.noHeadings": "No headings",

  "viewer.loading": "Loading...",
  "viewer.error.title": "Failed to load file",
  "viewer.error.path": "Path: {path}",
  "viewer.search.placeholder": "Search...",
  "viewer.search.noResults": "No results",
  "viewer.matchCount": "{count} match(es)",
  "viewer.lineToggle.hide": "Hide line numbers",
  "viewer.lineToggle.show": "Show line numbers",
  "viewer.exportPdf": "Export PDF",
  "viewer.exportPdf.exporting": "Exporting...",
  "viewer.exportPdf.overlay": "Exporting PDF...",
  "viewer.exportPdf.error": "PDF export failed",
  "viewer.refresh": "Reload file",
  "viewer.zoom.in": "Zoom in",
  "viewer.zoom.out": "Zoom out",
  "viewer.zoom.reset": "Reset zoom",
  "viewer.image.download": "Download image",
  "viewer.mermaid.download": "Download as PNG",
  "viewer.lightbox.close": "Close",
  "viewer.lightbox.download": "Download",

  "mermaid.renderError": "Mermaid render error",

  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.theme": "Theme",
  "settings.appColors": "App Colors",
  "settings.markdownColors": "Markdown Colors",
  "settings.mermaidColors": "Mermaid Diagram Colors",
  "settings.autoSave": "Settings are saved automatically.",

  "settings.color.background": "Background",
  "settings.color.sidebar": "Sidebar",
  "settings.color.text": "Text",
  "settings.color.mutedText": "Muted Text",
  "settings.color.border": "Border",
  "settings.color.button": "Button",

  "settings.color.heading": "Heading",
  "settings.color.link": "Link",
  "settings.color.codeBg": "Code Background",
  "settings.color.mdBorder": "Border",

  "settings.color.mermaidBg": "Background",
  "settings.color.primary": "Primary (nodes)",
  "settings.color.primaryText": "Primary Text",
  "settings.color.lineArrow": "Line / Arrow",
  "settings.color.actorBox": "Actor Box",
  "settings.color.actorText": "Actor Text",
  "settings.color.signalText": "Signal Text",
  "settings.color.noteBg": "Note Background",
  "settings.color.noteText": "Note Text",
};

const ja: Translations = {
  "sidebar.toggle.hide": "サイドバーを非表示",
  "sidebar.toggle.show": "サイドバーを表示",
  "sidebar.folder": "フォルダ",
  "sidebar.folder.title": "フォルダを開く",
  "sidebar.file": "ファイル",
  "sidebar.file.title": "ファイルを開く",
  "sidebar.settings.title": "設定",
  "sidebar.emptyFolder": "フォルダを選択してください",
  "sidebar.outline": "Outline",

  "app.selectFile": "Markdownファイルを選択してください",

  "outline.title": "目次",
  "outline.noHeadings": "見出しなし",

  "viewer.loading": "読み込み中...",
  "viewer.error.title": "ファイルの読み込みに失敗しました",
  "viewer.error.path": "パス: {path}",
  "viewer.search.placeholder": "検索...",
  "viewer.search.noResults": "結果なし",
  "viewer.matchCount": "{count}件の一致",
  "viewer.lineToggle.hide": "行番号を非表示",
  "viewer.lineToggle.show": "行番号を表示",
  "viewer.exportPdf": "PDF出力",
  "viewer.exportPdf.exporting": "出力中...",
  "viewer.exportPdf.overlay": "PDF出力中...",
  "viewer.exportPdf.error": "PDF出力に失敗しました",
  "viewer.refresh": "ファイルを再読み込み",
  "viewer.zoom.in": "拡大",
  "viewer.zoom.out": "縮小",
  "viewer.zoom.reset": "ズームリセット",
  "viewer.image.download": "画像をダウンロード",
  "viewer.mermaid.download": "PNGでダウンロード",
  "viewer.lightbox.close": "閉じる",
  "viewer.lightbox.download": "ダウンロード",

  "mermaid.renderError": "Mermaid描画エラー",

  "settings.title": "設定",
  "settings.language": "言語",
  "settings.theme": "テーマ",
  "settings.appColors": "アプリカラー",
  "settings.markdownColors": "Markdownカラー",
  "settings.mermaidColors": "Mermaid図カラー",
  "settings.autoSave": "設定は自動的に保存されます。",

  "settings.color.background": "背景",
  "settings.color.sidebar": "サイドバー",
  "settings.color.text": "テキスト",
  "settings.color.mutedText": "補助テキスト",
  "settings.color.border": "ボーダー",
  "settings.color.button": "ボタン",

  "settings.color.heading": "見出し",
  "settings.color.link": "リンク",
  "settings.color.codeBg": "コード背景",
  "settings.color.mdBorder": "ボーダー",

  "settings.color.mermaidBg": "背景",
  "settings.color.primary": "プライマリ (ノード)",
  "settings.color.primaryText": "プライマリテキスト",
  "settings.color.lineArrow": "ライン / 矢印",
  "settings.color.actorBox": "アクターボックス",
  "settings.color.actorText": "アクターテキスト",
  "settings.color.signalText": "シグナルテキスト",
  "settings.color.noteBg": "ノート背景",
  "settings.color.noteText": "ノートテキスト",
};

const dictionaries: Record<Locale, Translations> = { en, ja };

export function getTranslations(locale: Locale): Translations {
  return dictionaries[locale];
}
