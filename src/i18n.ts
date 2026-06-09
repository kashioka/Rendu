export type Locale = "en" | "ja" | "zh-CN";

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

  // Navigation
  "nav.back": string;
  "nav.forward": string;

  // Empty state
  "empty.heading": string;
  "empty.subheading": string;
  "empty.openFolder": string;
  "empty.openFile": string;
  "empty.selectFile": string;
  "empty.selectFile.sub": string;
  "drop.openMarkdown": string;

  // Recent files
  "recent.title": string;
  "recent.remove": string;
  "recent.openError": string;

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
  "viewer.zoom.in": string;
  "viewer.zoom.out": string;
  "viewer.zoom.reset": string;
  "viewer.image.download": string;
  "viewer.mermaid.download": string;
  "viewer.lightbox.close": string;
  "viewer.lightbox.download": string;
  "viewer.code.copy": string;
  "viewer.code.copied": string;

  // Mermaid
  "mermaid.renderError": string;

  // Settings
  "settings.title": string;
  "settings.language": string;
  "settings.theme": string;
  "settings.theme.system": string;
  "settings.theme.dark": string;
  "settings.theme.light": string;
  "settings.appColors": string;
  "settings.markdownColors": string;
  "settings.mermaidColors": string;
  "settings.autoSave": string;
  "settings.systemColorsNote": string;

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

  // Update banner
  "update.available": string;
  "update.download": string;
  "update.homebrew": string;
  "update.latest": string;

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

  // Help / Syntax Reference
  "help.syntaxTitle": string;
  "help.description": string;
  "help.basicFormatting": string;
  "help.bold": string;
  "help.italic": string;
  "help.strikethrough": string;
  "help.headings": string;
  "help.headingLevel": string;
  "help.lists": string;
  "help.unorderedList": string;
  "help.orderedList": string;
  "help.taskList": string;
  "help.blocks": string;
  "help.codeBlock": string;
  "help.blockquote": string;
  "help.horizontalRule": string;
  "help.table": string;
  "help.lineBreak": string;
  "help.collapsible": string;
  "help.superSub": string;
  "help.mermaid": string;
  "help.link": string;
  "help.html": string;
  "help.mermaidTitle": string;
  "help.footer": string;
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

  "nav.back": "Back",
  "nav.forward": "Forward",

  "empty.heading": "Open a Markdown (.md) file to get started",
  "empty.subheading": "Markdown files are plain-text documents with simple formatting. Choose a folder to browse, or open a file directly.",
  "empty.openFolder": "Open Folder",
  "empty.openFile": "Open File",
  "empty.selectFile": "Select a file to view",
  "empty.selectFile.sub": "Choose a Markdown (.md) file from the sidebar to start reading.",
  "drop.openMarkdown": "Drop a Markdown file or folder to open",

  "recent.title": "Recent",
  "recent.remove": "Remove from recent",
  "recent.openError": "This file or folder no longer exists.",

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
  "viewer.zoom.in": "Zoom in",
  "viewer.zoom.out": "Zoom out",
  "viewer.zoom.reset": "Reset zoom",
  "viewer.image.download": "Download image",
  "viewer.mermaid.download": "Download as PNG",
  "viewer.lightbox.close": "Close",
  "viewer.lightbox.download": "Download",
  "viewer.code.copy": "Copy code",
  "viewer.code.copied": "Copied!",

  "mermaid.renderError": "Mermaid render error",

  "update.available": "v{version} is available",
  "update.download": "Download",
  "update.homebrew": "or: brew upgrade --cask kashioka/tap/rendu",
  "update.latest": "You're on the latest version",

  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.theme": "Theme",
  "settings.theme.system": "System",
  "settings.theme.dark": "Dark",
  "settings.theme.light": "Light",
  "settings.appColors": "App Colors",
  "settings.markdownColors": "Markdown Colors",
  "settings.mermaidColors": "Mermaid Diagram Colors",
  "settings.autoSave": "Settings are saved automatically.",
  "settings.systemColorsNote": "Colors follow your system's light/dark setting automatically. Choose Dark or Light to customize colors.",

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

  "help.syntaxTitle": "Supported Syntax",
  "help.description": "Rendu supports GitHub Flavored Markdown (GFM) with HTML extensions.",
  "help.basicFormatting": "Formatting",
  "help.bold": "Bold",
  "help.italic": "Italic",
  "help.strikethrough": "Strikethrough",
  "help.headings": "Headings",
  "help.headingLevel": "Heading {n}",
  "help.lists": "Lists",
  "help.unorderedList": "Bullet list",
  "help.orderedList": "Numbered list",
  "help.taskList": "Task list",
  "help.blocks": "Blocks",
  "help.codeBlock": "Code block",
  "help.blockquote": "Blockquote",
  "help.horizontalRule": "Horizontal rule",
  "help.table": "Table",
  "help.lineBreak": "Line break",
  "help.collapsible": "Collapsible section",
  "help.superSub": "Superscript / Subscript",
  "help.link": "Link",
  "help.html": "HTML",
  "help.mermaidTitle": "Mermaid",
  "help.mermaid": "Diagram (flowchart, sequence, etc.)",
  "help.footer": "GitHub Flavored Markdown (GFM) + HTML",
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

  "nav.back": "戻る",
  "nav.forward": "進む",

  "empty.heading": "Markdownファイル（.md）を開いてください",
  "empty.subheading": "Markdownファイルは書式付きのテキストファイルです。フォルダを開いて一覧から選ぶか、ファイルを直接指定できます。",
  "empty.openFolder": "フォルダを開く",
  "empty.openFile": "ファイルを開く",
  "empty.selectFile": "ファイルを選択して表示",
  "empty.selectFile.sub": "サイドバーからMarkdownファイル（.md）を選んで閲覧できます。",
  "drop.openMarkdown": "Markdownファイルまたはフォルダをドロップして開く",

  "recent.title": "最近使ったファイル",
  "recent.remove": "履歴から削除",
  "recent.openError": "このファイルまたはフォルダはもう存在しません。",

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
  "viewer.zoom.in": "拡大",
  "viewer.zoom.out": "縮小",
  "viewer.zoom.reset": "ズームリセット",
  "viewer.image.download": "画像をダウンロード",
  "viewer.mermaid.download": "PNGでダウンロード",
  "viewer.lightbox.close": "閉じる",
  "viewer.lightbox.download": "ダウンロード",
  "viewer.code.copy": "コードをコピー",
  "viewer.code.copied": "コピーしました！",

  "mermaid.renderError": "Mermaid描画エラー",

  "update.available": "v{version} が利用可能です",
  "update.download": "ダウンロード",
  "update.homebrew": "または: brew upgrade --cask kashioka/tap/rendu",
  "update.latest": "最新版をご利用いただいています",

  "settings.title": "設定",
  "settings.language": "言語",
  "settings.theme": "テーマ",
  "settings.theme.system": "システム",
  "settings.theme.dark": "ダーク",
  "settings.theme.light": "ライト",
  "settings.appColors": "アプリカラー",
  "settings.markdownColors": "Markdownカラー",
  "settings.mermaidColors": "Mermaid図カラー",
  "settings.autoSave": "設定は自動的に保存されます。",
  "settings.systemColorsNote": "システムテーマ選択中は、配色が OS のライト/ダーク設定に自動で従います。色をカスタマイズするには Dark または Light を選んでください。",

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

  "help.syntaxTitle": "対応している記法",
  "help.description": "Rendu は GitHub Flavored Markdown（GFM）+ HTML に対応しています。",
  "help.basicFormatting": "書式",
  "help.bold": "太字",
  "help.italic": "斜体",
  "help.strikethrough": "取り消し線",
  "help.headings": "見出し",
  "help.headingLevel": "見出し{n}",
  "help.lists": "リスト",
  "help.unorderedList": "箇条書き",
  "help.orderedList": "番号付きリスト",
  "help.taskList": "タスクリスト",
  "help.blocks": "ブロック",
  "help.codeBlock": "コードブロック",
  "help.blockquote": "引用",
  "help.horizontalRule": "水平線",
  "help.table": "テーブル",
  "help.lineBreak": "改行",
  "help.collapsible": "折りたたみセクション",
  "help.superSub": "上付き / 下付き文字",
  "help.link": "リンク",
  "help.html": "HTML",
  "help.mermaidTitle": "Mermaid",
  "help.mermaid": "図（フローチャート、シーケンス図など）",
  "help.footer": "GitHub Flavored Markdown (GFM) + HTML",
};

const zhCN: Translations = {
  "sidebar.toggle.hide": "隐藏侧边栏",
  "sidebar.toggle.show": "显示侧边栏",
  "sidebar.folder": "文件夹",
  "sidebar.folder.title": "打开文件夹",
  "sidebar.file": "文件",
  "sidebar.file.title": "打开文件",
  "sidebar.settings.title": "设置",
  "sidebar.emptyFolder": "请选择一个文件夹开始",
  "sidebar.outline": "大纲",

  "nav.back": "后退",
  "nav.forward": "前进",

  "empty.heading": "打开一个 Markdown（.md）文件开始阅读",
  "empty.subheading": "Markdown 文件是带有简单格式的纯文本文档。你可以选择文件夹浏览，也可以直接打开单个文件。",
  "empty.openFolder": "打开文件夹",
  "empty.openFile": "打开文件",
  "empty.selectFile": "选择要查看的文件",
  "empty.selectFile.sub": "从侧边栏选择一个 Markdown（.md）文件开始阅读。",
  "drop.openMarkdown": "拖入 Markdown 文件或文件夹以打开",

  "recent.title": "最近打开",
  "recent.remove": "从最近打开中移除",
  "recent.openError": "这个文件或文件夹已不存在。",

  "outline.title": "大纲",
  "outline.noHeadings": "没有标题",

  "viewer.loading": "正在加载...",
  "viewer.error.title": "文件加载失败",
  "viewer.error.path": "路径：{path}",
  "viewer.search.placeholder": "搜索...",
  "viewer.search.noResults": "无结果",
  "viewer.matchCount": "{count} 个匹配项",
  "viewer.lineToggle.hide": "隐藏行号",
  "viewer.lineToggle.show": "显示行号",
  "viewer.exportPdf": "导出 PDF",
  "viewer.exportPdf.exporting": "正在导出...",
  "viewer.exportPdf.overlay": "正在导出 PDF...",
  "viewer.exportPdf.error": "PDF 导出失败",
  "viewer.zoom.in": "放大",
  "viewer.zoom.out": "缩小",
  "viewer.zoom.reset": "重置缩放",
  "viewer.image.download": "下载图片",
  "viewer.mermaid.download": "下载为 PNG",
  "viewer.lightbox.close": "关闭",
  "viewer.lightbox.download": "下载",
  "viewer.code.copy": "复制代码",
  "viewer.code.copied": "已复制！",

  "mermaid.renderError": "Mermaid 渲染错误",

  "update.available": "v{version} 可用",
  "update.download": "下载",
  "update.homebrew": "或运行：brew upgrade --cask kashioka/tap/rendu",
  "update.latest": "当前已是最新版本",

  "settings.title": "设置",
  "settings.language": "语言",
  "settings.theme": "主题",
  "settings.theme.system": "跟随系统",
  "settings.theme.dark": "深色",
  "settings.theme.light": "浅色",
  "settings.appColors": "应用颜色",
  "settings.markdownColors": "Markdown 颜色",
  "settings.mermaidColors": "Mermaid 图表颜色",
  "settings.autoSave": "设置会自动保存。",
  "settings.systemColorsNote": "选择「跟随系统」时，配色会自动跟随系统的浅色/深色设置。如需自定义颜色，请选择「深色」或「浅色」。",

  "settings.color.background": "背景",
  "settings.color.sidebar": "侧边栏",
  "settings.color.text": "文字",
  "settings.color.mutedText": "辅助文字",
  "settings.color.border": "边框",
  "settings.color.button": "按钮",

  "settings.color.heading": "标题",
  "settings.color.link": "链接",
  "settings.color.codeBg": "代码背景",
  "settings.color.mdBorder": "边框",

  "settings.color.mermaidBg": "背景",
  "settings.color.primary": "主色（节点）",
  "settings.color.primaryText": "主文字",
  "settings.color.lineArrow": "线条 / 箭头",
  "settings.color.actorBox": "角色框",
  "settings.color.actorText": "角色文字",
  "settings.color.signalText": "信号文字",
  "settings.color.noteBg": "注释背景",
  "settings.color.noteText": "注释文字",

  "help.syntaxTitle": "支持的语法",
  "help.description": "Rendu 支持 GitHub Flavored Markdown（GFM）和 HTML 扩展。",
  "help.basicFormatting": "格式",
  "help.bold": "粗体",
  "help.italic": "斜体",
  "help.strikethrough": "删除线",
  "help.headings": "标题",
  "help.headingLevel": "{n} 级标题",
  "help.lists": "列表",
  "help.unorderedList": "项目符号列表",
  "help.orderedList": "编号列表",
  "help.taskList": "任务列表",
  "help.blocks": "区块",
  "help.codeBlock": "代码块",
  "help.blockquote": "引用",
  "help.horizontalRule": "分隔线",
  "help.table": "表格",
  "help.lineBreak": "换行",
  "help.collapsible": "可折叠区块",
  "help.superSub": "上标 / 下标",
  "help.link": "链接",
  "help.html": "HTML",
  "help.mermaidTitle": "Mermaid",
  "help.mermaid": "图表（流程图、时序图等）",
  "help.footer": "GitHub Flavored Markdown（GFM）+ HTML",
};

const dictionaries: Record<Locale, Translations> = { en, ja, "zh-CN": zhCN };

export function getTranslations(locale: Locale): Translations {
  return dictionaries[locale];
}
