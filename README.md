# Rendu

A lightweight desktop Markdown viewer built with Tauri and React.

**[日本語](./README.ja.md)**

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![License](https://img.shields.io/badge/License-MIT-green)

## Download

[**Download Rendu_0.1.0_aarch64.dmg**](https://github.com/kashioka/Rendu/releases/download/v0.1.0/Rendu_0.1.0_aarch64.dmg) (macOS Apple Silicon)

> All versions are available on the [Releases](https://github.com/kashioka/Rendu/releases) page.

### Install

1. Open the downloaded `.dmg` file
2. Drag **Rendu** to the **Applications** folder
3. **Important:** Before the first launch, open Terminal and run:
   ```
   xattr -cr /Applications/Rendu.app
   ```
   This removes the macOS quarantine flag (required for unsigned apps).
4. Double-click Rendu in Applications to launch

> **Note:** Skipping step 3 will result in a *"Rendu is damaged and can't be opened"* error.

## Features

- **File tree** — Browse `.md` / `.markdown` files in a folder tree
- **Markdown rendering** — Full GFM support (tables, task lists, strikethrough, etc.)
- **Syntax highlighting** — Automatic code block highlighting
- **Mermaid diagrams** — Inline rendering of flowcharts, sequence diagrams, ER diagrams, and more
- **Document outline** — Heading list in the sidebar with click-to-jump navigation
- **PDF export** — Export the current Markdown page as an A4 PDF
- **Theme customization** — Change colors for background, text, code blocks, and more in real time
- **Resizable UI** — Drag the divider between file tree and outline to adjust panel sizes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri 2.0 (Rust) |
| Frontend | React 19 + TypeScript + Vite |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| Diagrams | Mermaid |
| PDF export | html2pdf.js |
| Styling | Tailwind CSS 4 |

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)
- macOS: Xcode Command Line Tools (`xcode-select --install`)

### Install & Run

```bash
git clone https://github.com/kashioka/Rendu.git
cd Rendu
npm install
npm run dev
```

### Build

```bash
npm run build
```

The `.dmg` installer will be generated at:

```
src-tauri/target/release/bundle/dmg/Rendu_<version>_aarch64.dmg
```

## Install (macOS)

See the [Download](#download) section above for the easiest way to install.

If you build from source, the `.app` bundle will be at:

```
src-tauri/target/release/bundle/macos/Rendu.app
```

## Usage

1. Launch the app
2. Click **Open Folder** to select a folder containing Markdown files
3. Click a `.md` file in the file tree
4. The rendered Markdown appears in the right panel
5. Use the **Outline** section at the bottom of the sidebar to navigate headings
6. Click **PDF Export** at the top to export as PDF
7. Click the gear icon to customize the theme

## Troubleshooting

### "Rendu is damaged and can't be opened"

This happens because the app is not code-signed. Run this command in Terminal before opening:

```
xattr -cr /Applications/Rendu.app
```

### Security software warning on first run

Since the development build is unsigned, antivirus software (e.g. Bitdefender) may block file operations such as PDF export. When prompted, select **"Trust this application"** to allow it. This warning typically only appears once. It may reappear after a clean rebuild (`cargo clean`).

## Project Structure

```
Rendu/
├── src/
│   ├── components/
│   │   ├── FileTree.tsx        # File tree browser
│   │   ├── MarkdownViewer.tsx  # Markdown rendering + PDF export
│   │   ├── MermaidBlock.tsx    # Mermaid diagram rendering
│   │   ├── OutlinePanel.tsx    # Document outline
│   │   └── Settings.tsx        # Theme settings panel
│   ├── App.tsx                 # Main layout
│   ├── main.tsx                # Entry point
│   ├── useSettings.ts          # Theme settings hook
│   └── index.css               # Global styles
├── src-tauri/
│   ├── src/                    # Rust backend
│   ├── capabilities/           # Tauri permission config
│   └── tauri.conf.json         # Tauri config
└── package.json
```

## License

MIT
