# PDF Studio

A native Windows desktop PDF editor built to rival Adobe Acrobat — built with Electron, React, and PyMuPDF. Features a Liquid Glass UI inspired by Apple's WWDC 2025 design language.

![PDF Studio](https://img.shields.io/badge/platform-Windows-blue) ![Electron](https://img.shields.io/badge/Electron-33-47848F) ![React](https://img.shields.io/badge/React-18-61DAFB) ![Python](https://img.shields.io/badge/Python-3.8+-3776AB)

---

## Features

### Editor
The editor opens PDFs in a three-panel layout: a left sidebar for navigation, a centre viewer, and a right sidebar with all editing tools labelled and grouped by category.

**Annotate**
- **Highlight** — drag to highlight text in 6 colours
- **Draw** — freehand pen with 3 line weights and colour picker
- **Text** — click to place text notes anywhere on a page
- **Erase** — remove individual annotations
- Save all annotations permanently into the PDF

**Page Management**
- Thumbnail sidebar — click to jump, drag to reorder
- Extract selected pages to a new PDF
- Insert pages from another PDF at any position
- Crop, rotate, and delete pages
- Non-destructive working copy — original is never touched until you save

**Search**
- `Ctrl+F` full-text search across all pages
- Match highlighting with previous/next navigation

**Bookmarks & Comments**
- Outline/bookmarks panel — click any entry to jump to that page
- Comments panel — lists every annotation with page jump

### Document Creation
Convert other formats into PDF directly from the Home screen:

| Source | Notes |
|--------|-------|
| Images (PNG, JPG, BMP, TIFF, WebP) | Any number of images merged into one PDF |
| Office (Word, Excel, PowerPoint) | Via LibreOffice (free) or Microsoft Office |
| Webpage (URL) | Via Playwright or WeasyPrint |

### PDF Tools
| Tool | Description |
|------|-------------|
| **Convert** | PDF → Word, Excel, PNG, JPEG, HTML, plain text |
| **Merge** | Combine multiple PDFs into one |
| **Split** | Extract every page to a separate file |
| **Compress** | Reduce file size with before/after size comparison |
| **Protect** | Add or remove password protection (AES-256) |

### Content Tools
Add content overlays to every page without manual editing:
- **Watermark** — diagonal text with opacity and angle controls
- **Stamp** — DRAFT / APPROVED / CONFIDENTIAL / COPY / VOID with colour-coded borders
- **Header & Footer** — custom text with separator line
- **Page Numbers** — 6 placement positions, configurable start number

### Security
- **Redact** — draw boxes over sensitive content; permanently blacks it out on save (irreversible)
- **Permissions** — restrict printing, copying, editing, annotations, and forms independently using AES-256 encryption; a random owner password prevents removal of restrictions
- **Password protect / unlock** — standard open-document password

### Forms
- **Fill** — Forms panel in the left sidebar shows all existing form fields with type-appropriate inputs (text, checkbox, radio, dropdown)
- **Create** — draw-to-place tool for adding text, checkbox, radio, and dropdown fields to any page
- **Export / Import** — save form data as JSON or CSV; load it back in to fill fields in bulk

### OCR
- Run Tesseract OCR on scanned or image-based PDFs
- Adds an invisible text layer — the visual appearance is unchanged
- Scanned pages become searchable with `Ctrl+F` after OCR
- 12 supported languages; 150 / 300 / 600 DPI resolution options

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Shell | Electron 33 (frameless, acrylic background) |
| Frontend | React 18 + TypeScript + Vite 5 |
| Routing | React Router 6 |
| Animations | Framer Motion |
| Icons | Lucide React |
| PDF Rendering | react-pdf v10 (pdf.js) |
| PDF Processing | Python + PyMuPDF (fitz) |
| OCR | Tesseract + pytesseract |
| Office conversion | LibreOffice or docx2pdf (Microsoft Office COM) |

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.8+

Install Python dependencies:

```bash
pip install pymupdf python-docx openpyxl Pillow pytesseract
```

**Optional — required for specific features:**

| Package | Feature |
|---------|---------|
| `docx2pdf` | Office → PDF (requires Microsoft Office installed) |
| `playwright` + `playwright install chromium` | Web → PDF |
| `weasyprint` | Web → PDF (fallback, no browser required) |
| [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) | OCR — must be a system install, not a pip package |
| LibreOffice | Office → PDF (free alternative to Microsoft Office) |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/benballs32-max/PDF-Studio.git
cd PDF-Studio
```

### 2. Install Node dependencies

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

## Building for Distribution

PDF Studio bundles the Python engine into a self-contained executable using PyInstaller so end users don't need Python installed.

### 1. Install PyInstaller

```bash
pip install pyinstaller
```

### 2. Build everything

```bash
npm run dist
```

This runs three steps in sequence:
1. `vite build` — bundles the React frontend
2. `pyinstaller python/pdf_engine.spec` — packages the Python engine into `python/dist/pdf_engine/`
3. `electron-builder` — creates a Windows NSIS installer in `release/`

The installer includes the bundled Python engine and lets the user choose the installation directory.

---

## Project Structure

```
PDF-Studio/
├── electron/
│   ├── main.ts          # Electron main process — window creation, IPC handlers, Python sidecar
│   └── preload.ts       # contextBridge — exposes typed electronAPI to the renderer
├── python/
│   ├── pdf_engine.py    # All PDF processing commands (PyMuPDF + Tesseract + Office)
│   ├── pdf_engine.spec  # PyInstaller spec for bundling into a standalone exe
│   └── requirements.txt
├── public/
│   └── pdf.worker.min.mjs  # pdf.js web worker (copy from pdfjs-dist after npm install)
├── src/
│   ├── pages/
│   │   ├── Home.tsx       # Landing page — tool cards, create PDF section, recent files
│   │   ├── Editor.tsx     # Full PDF editor — viewer, annotation canvas, right sidebar tools
│   │   ├── Converter.tsx  # Convert / Merge / Split / Compress / Security tabs
│   │   └── ImportPDF.tsx  # Import from images, Office files, or URLs
│   ├── components/
│   │   └── TitleBar.tsx   # Custom frameless window title bar
│   ├── utils/
│   │   └── recentFiles.ts # localStorage recent file tracking
│   └── styles/
│       ├── glass.css      # Liquid Glass component styles
│       └── globals.css    # CSS variables and resets
├── vite.config.ts
└── tsconfig.json
```

---

## IPC Architecture

```
Renderer (React) → contextBridge (preload.ts) → Main Process (main.ts) → Python subprocess
```

PDF commands are JSON-encoded and passed to `pdf_engine.py` (dev) or the bundled `pdf_engine.exe` (production) as a subprocess argument. Results are returned as JSON on stdout.

In dev: `python pdf_engine.py '{"cmd":"compress","input":"...","output":"..."}'`  
In prod: `resources/pdf_engine/pdf_engine.exe '{"cmd":"compress","input":"...","output":"..."}'`

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Open full-text search |
| `Enter` | Next search match |
| `Shift+Enter` | Previous search match |
| `Escape` | Close search / cancel active annotation |
| `F12` | Toggle DevTools (dev mode only) |
