# Rendu

**Markdown in. Beautiful renders out.**
Just drag a file to start reading. A free, lightweight viewer.
No config, no account — ready in seconds.

> *Rendu* is French for "a finished rendering" or "something delivered." Just as architects create a *rendu* to convey their design intent, Rendu transforms your Markdown blueprints into an intuitive, beautifully rendered form.

### Why Rendu?

| | Rendu | Obsidian | Typora | VS Code |
|---|:---:|:---:|:---:|:---:|
| Instant startup | **Yes** | Slow | OK | Slow |
| Zero config | **Yes** | Plugins required | Minimal | Extensions required |
| Free | **Yes** | Freemium | Paid | Free |
| Pure viewer | **Yes** | Editor-first | Editor-first | Editor-first |
| Mermaid diagrams | **Yes** | Plugin | Plugin | Extension |

### Built for reading, not editing

- **Open a folder, start reading** — file tree, outline, and rendered Markdown in one window
- **Mermaid diagrams, GFM tables, syntax highlighting** — all built in, nothing to install
- **One-click PDF export** — share rendered docs with anyone
- **Lightweight & native** — Tauri + Rust backend, under 15 MB on disk
- **CLI friendly** — `rendu file.md` opens and renders instantly (macOS, via Homebrew)

**[日本語](./README.ja.md)**

![CI](https://github.com/kashioka/Rendu/actions/workflows/ci.yml/badge.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.0-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6)
![License](https://img.shields.io/badge/License-MIT-green)

![Rendu Demo](docs/demo.gif)

![Rendu — Dark theme](docs/screenshot.png)

![Rendu — Light theme](docs/screenshot-light.png) ![Rendu — Settings](docs/screenshot-settings.png) ![Rendu — Viewer with search](docs/screenshot-viewer.png)

## Download

### macOS

**[Download Rendu.dmg](https://github.com/kashioka/Rendu/releases/latest/download/Rendu_0.5.2_aarch64.dmg)** — open and drag to Applications.

> Rendu is code-signed and notarized by Apple. Just open the DMG, drag to Applications, and launch — no extra steps needed.

Other install methods:

| Method | Command |
|--------|---------|
| Homebrew | `brew install --cask kashioka/tap/rendu` |
| CLI | After Homebrew install: `rendu README.md` |

### Windows

**[Download Rendu installer (.exe)](https://github.com/kashioka/Rendu/releases/latest)** — run the installer.

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

**From the terminal:**

```bash
rendu README.md
```

**From the app:**

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
mv Rendu.app /Applications/
open /Applications/Rendu.app
```

All versions and release notes are on the [Releases](https://github.com/kashioka/Rendu/releases) page.

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

## Feedback

Bug reports and feature requests are welcome — please open an [Issue](https://github.com/kashioka/Rendu/issues).

## License

MIT
