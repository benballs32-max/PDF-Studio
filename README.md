# PDF Studio

A native Windows desktop app for everything PDF — built with Electron, React, and PyMuPDF. Features a Liquid Glass UI inspired by Apple's WWDC 2025 design language.

![PDF Studio](https://img.shields.io/badge/platform-Windows-blue) ![Electron](https://img.shields.io/badge/Electron-33-47848F) ![React](https://img.shields.io/badge/React-18-61DAFB) ![Python](https://img.shields.io/badge/Python-3.8+-3776AB)

---

## Features

### PDF Editor
- Open and view PDFs with smooth zoom and page navigation
- **Highlight** — drag to highlight text in 6 colours
- **Draw** — freehand pen tool with 3 line weights
- **Text** — click to place text annotations
- **Erase** — remove individual annotations
- Rotate and delete pages
- Save annotations permanently into the PDF via PyMuPDF
- **Full-text search** — Ctrl+F to search across all pages with match highlighting

### PDF Tools
| Tool | Description |
|------|-------------|
| **Convert** | PDF → Word (.docx), Excel (.xlsx), PNG, JPEG, HTML, plain text |
| **Merge** | Combine multiple PDFs into one |
| **Split** | Extract every page into separate PDF files |
| **Compress** | Reduce file size with before/after size comparison |
| **Security** | Add or remove password protection (AES-256) |

### Home Screen
- Liquid Glass homepage with tool cards
- Recent files list — click any to open directly in the editor

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 33 (frameless, acrylic background) |
| Frontend | React 18 + TypeScript + Vite 5 |
| PDF Rendering | react-pdf v10 (pdf.js) |
| PDF Processing | Python + PyMuPDF (fitz) |
| Animations | Framer Motion |
| Icons | Lucide React |

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.8+
- **pip** packages:

```bash
pip install pymupdf python-docx openpyxl
```

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/benballs32-max/PDF-Studio.git
cd PDF-Studio
```

### 2. Install dependencies

```bash
npm install
```

> **Corporate network / SSL inspection?** Create a `.npmrc` file with `strict-ssl=false`

### 3. Copy the PDF.js worker

```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
```

### 4. Run in development

```bash
npm run dev
```

Vite starts the dev server and Electron launches automatically. Press **F12** to open DevTools.

---

## Project Structure

```
PDF-Studio/
├── electron/
│   ├── main.ts          # Electron main process — window, IPC handlers
│   └── preload.ts       # Context bridge (exposes electronAPI to renderer)
├── python/
│   ├── pdf_engine.py    # All PDF processing commands (PyMuPDF)
│   └── requirements.txt
├── public/
│   └── pdf.worker.min.mjs  # pdf.js web worker
├── src/
│   ├── pages/
│   │   ├── Home.tsx     # Landing page with tool cards + recent files
│   │   ├── Editor.tsx   # PDF viewer, annotation tools, search
│   │   └── Converter.tsx # Convert / Merge / Split / Compress / Security tabs
│   ├── components/
│   │   └── TitleBar.tsx # Custom frameless window title bar
│   ├── utils/
│   │   └── recentFiles.ts # localStorage recent file tracking
│   └── styles/
│       ├── glass.css    # Liquid Glass component styles
│       └── globals.css  # CSS variables and resets
├── vite.config.ts
└── tsconfig.json
```

---

## IPC Architecture

The renderer communicates with the main process via a typed `window.electronAPI` bridge:

```
Renderer (React) → contextBridge → Main Process → Python subprocess
```

PDF processing commands are JSON-encoded and passed to `python/pdf_engine.py` as a subprocess argument. Results are returned as JSON stdout.

---

## Building for Production

```bash
npm run build
```

> Packaging with electron-builder is not yet configured. The `build` script compiles TypeScript and bundles the renderer — suitable for running via `npm run preview`.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Open full-text search |
| `Enter` | Next search match |
| `Shift+Enter` | Previous search match |
| `Escape` | Close search / cancel text annotation |
| `F12` | Toggle DevTools (dev mode only) |
