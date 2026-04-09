# Rendu

A lightweight desktop Markdown viewer built with Tauri and React.

**[日本語](./README.ja.md)**

![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![License](https://img.shields.io/badge/License-MIT-green)

## Quick Start

**macOS Apple Silicon only.**

Open **Terminal** and run:

```bash
curl -fsSL https://github.com/kashioka/Rendu/releases/latest/download/install.sh | bash
```

That's it. The installer downloads Rendu, copies it to `/Applications`, clears the macOS quarantine flag, and launches the app.

> **Why Terminal?** Rendu is not code-signed with an Apple Developer ID, so newer macOS versions (Sequoia / Tahoe) block double-click installation of `.app` and `.command` files with *"damaged"* or *"cannot be verified"* errors. Running the installer from Terminal bypasses this restriction safely.

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

## Usage

1. Launch the app
2. Click **Open Folder** to select a folder containing Markdown files, or **Open File** to open a single file
3. The rendered Markdown appears in the right panel
4. Use the **Outline** section at the bottom of the sidebar to navigate headings
5. Click **PDF Export** at the top to export as PDF
6. Click the gear icon to customize the theme

## Troubleshooting

### The installer failed, or I want to inspect each step

Download and install manually:

```bash
curl -LO https://github.com/kashioka/Rendu/releases/latest/download/Rendu-macos-aarch64.tar.gz
tar xzf Rendu-macos-aarch64.tar.gz
xattr -cr Rendu.app
mv Rendu.app /Applications/
open /Applications/Rendu.app
```

All versions and release notes are on the [Releases](https://github.com/kashioka/Rendu/releases) page.

### "Rendu is damaged and can't be opened"

The quarantine flag wasn't cleared. Run:

```bash
xattr -cr /Applications/Rendu.app
```

Then launch Rendu again.

### Security software warning on first run

Since the build is unsigned, antivirus software (e.g. Bitdefender) may block file operations such as PDF export. When prompted, select **"Trust this application"** to allow it. This warning typically only appears once. It may reappear after a clean rebuild (`cargo clean`).

## Development

For contributors or anyone who wants to build Rendu from source.

**Prerequisites**

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/)
- Xcode Command Line Tools (`xcode-select --install`)

**Clone and install dependencies**

```bash
git clone https://github.com/kashioka/Rendu.git
cd Rendu
npm install
```

**Run in development mode**

```bash
npm run dev
```

**Build a release**

```bash
npm run build
./scripts/build-tarball.sh
```

Generated artifacts:

```
src-tauri/target/release/bundle/macos/Rendu.app
src-tauri/target/release/bundle/tarball/Rendu-macos-aarch64.tar.gz
```

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
