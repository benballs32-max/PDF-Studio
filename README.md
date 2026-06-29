# PDF Studio

A premium, feature-complete PDF editor for Windows built with Electron, React, and Python. PDF Studio pairs a Liquid Glass dark UI with a powerful PyMuPDF backend and optional AI integration — covering everything from basic annotation to multi-document AI analysis.

![PDF Studio](https://img.shields.io/badge/platform-Windows-blue) ![Electron](https://img.shields.io/badge/Electron-33-47848F) ![React](https://img.shields.io/badge/React-18-61DAFB) ![Python](https://img.shields.io/badge/Python-3.8+-3776AB)

---

## Table of Contents

- [Features at a Glance](#features-at-a-glance)
- [Installation](#installation)
- [Tutorial](#tutorial)
  - [Home Screen](#home-screen)
  - [Editor](#editor)
  - [Annotating](#annotating)
  - [Find & Replace](#find--replace)
  - [Page Management](#page-management)
  - [Bookmarks & Outline](#bookmarks--outline)
  - [Comments](#comments)
  - [Forms](#forms)
  - [Undo & Redo](#undo--redo)
  - [Metadata & Document Info](#metadata--document-info)
  - [Printing](#printing)
  - [Converting PDFs](#converting-pdfs)
  - [Importing to PDF](#importing-to-pdf)
  - [Batch Processing](#batch-processing)
  - [Comparing PDFs](#comparing-pdfs)
  - [AI Features (in Editor)](#ai-features-in-editor)
  - [AI Studio](#ai-studio)
  - [Settings](#settings)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tech Stack](#tech-stack)
- [Building from Source](#building-from-source)
- [Project Structure](#project-structure)
- [IPC Architecture](#ipc-architecture)

---

## Features at a Glance

| Area | What's included |
|---|---|
| **Viewing** | Smooth PDF rendering, continuous scroll, zoom, page thumbnails |
| **Annotating** | Highlight, underline, freehand draw, text boxes, shapes, stamps, eraser |
| **Editing** | Find & replace with real-time highlights, metadata editor, flatten annotations |
| **Pages** | Thumbnail panel, insert blank page, page rotation, split by bookmarks, extract images |
| **Bookmarks** | Document outline viewer, jump-to-page, AI-generated bookmark trees |
| **Comments** | Threaded comments with resolve/unresolve, page-linked |
| **Forms** | View and fill all interactive form fields |
| **Undo / Redo** | Full history stack across all edit operations |
| **Convert** | PDF → Word, Excel, PowerPoint, Images, Text — and reverse |
| **Import** | Build a PDF from images or other files |
| **Batch** | Merge, split, compress, watermark, rotate, convert — across many files |
| **Compare** | Side-by-side visual diff of two PDFs |
| **AI (Editor)** | Auto-classify, summarise, translate, smart redact, chat with document |
| **AI Studio** | Contract analyser, multi-doc chat, semantic search, table extractor, auto bookmarks, AI rename |
| **Settings** | Claude / OpenAI / Ollama support with API key management |
| **Auto-updater** | Built-in update checker via GitHub Releases |

---

## Installation

### Download the installer

Grab `PDF Studio Setup 1.0.0.exe` from the [Releases](../../releases) page and run it. The installer lets you pick an install directory and creates a desktop shortcut and Start Menu entry.

> **Windows SmartScreen warning:** The app is not yet code-signed, so SmartScreen may flag it on first launch. Click **More info → Run anyway** to proceed. This is normal for unsigned Electron apps.

---

## Tutorial

### Home Screen

The Home screen is your launchpad. From here you can:

- **Open PDF** — browse for a file to open in the Editor
- **Drop a PDF onto the window** — drag from Explorer to open instantly
- **Recent files** — a grid of the last PDFs you opened, stored locally. Click any to reopen
- **Tool cards** — navigate directly to Convert, Import, Batch, Compare, or AI Studio
- **Settings** — gear icon in the top-right corner

---

### Editor

The Editor is a three-panel layout:

```
┌─────────────┬────────────────────────────┬──────────────┐
│  Left       │                            │   Right      │
│  Sidebar    │    PDF Viewer (centre)     │   Sidebar    │
│  (tabs)     │                            │   (tools)    │
└─────────────┴────────────────────────────┴──────────────┘
```

**Left sidebar tabs:**
| Icon | Tab | Contents |
|---|---|---|
| Folder | Files | Open files list, open new file |
| Grid | Pages | Page thumbnails — click to jump |
| List | Outline | Bookmark / Table of Contents tree |
| Bubble | Comments | All comment threads |
| Checkbox | Forms | Interactive form fields |
| Sparkles | AI | AI tools for this document |

**Toolbar (top):** All annotation tools, find & replace, zoom controls, print, and settings.

**Right sidebar:** Contextual tools grouped by category — Document info, Annotations, Page Tools, and AI.

---

### Annotating

Select an annotation tool from the toolbar, then interact with the PDF viewer.

| Tool | How to use |
|---|---|
| **Highlight** | Click and drag across text to highlight it in yellow |
| **Underline** | Click and drag across text to underline it |
| **Draw** | Click and drag freehand anywhere on the page |
| **Text Box** | Click to place a text annotation; type your note |
| **Shapes** | Click and drag to draw a rectangle, circle, or arrow |
| **Stamp** | Click to place a stamp (Approved, Draft, Confidential, etc.) |
| **Eraser** | Click any existing annotation to remove it |

All annotations are saved back into the PDF file when you save. They are stored as standard PDF annotations and are compatible with other PDF viewers.

To **save**, use the Save button in the toolbar. The original file is overwritten; use Save As to keep the original.

---

### Find & Replace

Press **Ctrl+F** or click the search icon in the toolbar.

1. Type in the **Find** field — all matches across every page are highlighted in real time
2. Use **↑ / ↓** buttons (or Enter / Shift+Enter) to move between matches. The viewer jumps to the active match
3. Click the expand arrow to reveal the **Replace** row
4. Type a replacement string, then:
   - **Replace** — replaces the current match and advances to the next
   - **Replace All** — replaces every match in the document in one go
5. Press **Esc** to close

---

### Page Management

Open the **Pages tab** (grid icon) in the left sidebar to see all page thumbnails.

- **Click** a thumbnail to scroll the viewer to that page
- **Right-click** a thumbnail for page-level actions (rotate, delete, extract)

Additional operations in the **right sidebar → Page Tools:**

| Operation | What it does |
|---|---|
| **Insert blank page** | Adds a new empty page immediately after the current page |
| **Rotate page** | Rotates the current page 90° clockwise |
| **Flatten PDF** | Merges all annotations permanently into the page content — annotations can no longer be edited after this |
| **Split by bookmarks** | Creates one separate PDF file per top-level bookmark section |
| **Extract images** | Finds every embedded image in the PDF and saves them as individual PNG files |

---

### Bookmarks & Outline

Open the **Outline tab** (list icon) in the left sidebar.

- The full Table of Contents tree is shown if the document has one
- Click any entry to jump straight to that page
- Indentation shows heading levels (chapter → section → subsection)

If a document has no bookmarks, use **AI Studio → Auto Bookmarks** to generate a TOC automatically.

---

### Comments

Open the **Comments tab** (speech bubble icon) in the left sidebar.

- Click **Add Comment** to write a note attached to the current page
- **Reply** to any comment to create a thread
- Click the **tick / checkmark** on a comment to mark it resolved — it turns grey but is kept in the file
- Comments are stored as standard PDF annotations

---

### Forms

Open the **Forms tab** (checkbox icon) in the left sidebar when viewing a PDF with interactive fields.

- All detected fields are listed with their type and current value
- Click a field's value to edit it inline
- Supported field types: text, checkbox, radio button, dropdown
- Changes are written back into the PDF on save

---

### Undo & Redo

Every edit operation — annotations, page operations, form changes, find & replace — is recorded in a history stack.

- **Ctrl+Z** — undo the last action
- **Ctrl+Y** — redo

The history is per-session; it resets when you close the file.

---

### Metadata & Document Info

In the **right sidebar**, open the **Document** section to view and edit PDF metadata:

- Title, Author, Subject, Keywords
- Creator application and producer
- Creation and modification dates

Click **Save Metadata** to write the changes back into the PDF.

---

### Printing

Click the **printer icon** in the toolbar or press **Ctrl+P** to open the print dialog.

PDF Studio sends the document to your system's native Windows print dialog, giving you full access to all your installed printers and their settings (paper size, orientation, duplex, etc.).

---

### Converting PDFs

Navigate to **Convert** from the Home screen.

**PDF to another format:**
1. Drop your PDF into the input zone (or click to browse)
2. Choose an output format:

| Format | Output |
|---|---|
| **Word (.docx)** | Editable Word document with text and basic layout |
| **Excel (.xlsx)** | Spreadsheet (best for PDFs that are primarily tables) |
| **PowerPoint (.pptx)** | Slide deck — one slide per PDF page |
| **Images (PNG / JPG)** | Each page as a separate image file |
| **Plain Text (.txt)** | Raw extracted text, preserving reading order |

3. Click **Convert** — the output file is saved in the same folder as the source PDF

**Another format to PDF:**
1. Switch to the **To PDF** tab
2. Drop in an image file (PNG, JPG, BMP, WebP) or a text file
3. Click **Convert** — a new PDF is created from the source

---

### Importing to PDF

Navigate to **Import** from the Home screen to build a PDF from scratch.

- Drop in one or more image files
- They are combined into a single PDF, one image per page, in the order you arranged them
- Click **Create PDF** to produce the output file

---

### Batch Processing

Navigate to **Batch** from the Home screen to process many files at once.

| Operation | How to use |
|---|---|
| **Merge** | Add multiple PDFs in any order → click Merge → one combined PDF is produced |
| **Split** | Add a PDF → set split points (by page number or bookmark) → separate PDFs are created |
| **Compress** | Reduces file size by downsampling embedded images and removing redundant data. The original is preserved |
| **Watermark** | Add a text or image watermark to every page of every selected PDF |
| **Rotate** | Rotate all pages in selected files — 90°, 180°, or 270° |
| **Convert** | Batch-convert multiple PDFs to the same output format in one operation |

Progress and output file locations are shown after each operation completes.

---

### Comparing PDFs

Navigate to **Compare** from the Home screen.

1. Load the **original** PDF on the left panel
2. Load the **revised** PDF on the right panel
3. PDF Studio renders both documents side by side and highlights pages where differences exist
4. Both panels scroll in sync so you can step through changes page by page

Useful for spotting edits between contract versions, reviewing document revisions, or checking that a conversion produced the right output.

---

### AI Features (in Editor)

AI features require an API key configured in Settings (or Ollama running locally). When you open a file, PDF Studio silently classifies it in the background so the AI panel knows what kind of document you're working with.

Open the **AI tab** (✦ sparkles icon) in the left sidebar.

#### Summarise
Click **Summarise** — the full document text is extracted and sent to the AI, which returns a concise summary. Useful for quickly understanding a long document without reading it in full.

#### Classify
Runs automatically when you open a file. Detects the document type (contract, invoice, research paper, report, letter, etc.) and displays the result in the AI tab header. This also customises the suggested chat questions.

#### Translate
1. Type the target language (e.g. "French", "Spanish", "Japanese")
2. Click **Translate**
3. The full translated text is returned in the panel. You can copy it out to use elsewhere

#### Smart Redact
Click **Smart Redact** — the AI reads the document and identifies potentially sensitive information: names, addresses, phone numbers, account numbers, dates of birth, and similar personal data. It returns a list of suggested items to redact so you can review them before permanently removing anything.

#### Chat with PDF
Ask any question about the document in a conversational interface.

- The AI has the full text of your PDF as context
- **Suggested questions** appear as chips below the input — they're tailored to the document type (e.g. contract questions like "What are the payment terms?" or invoice questions like "What is the total amount due?")
- Click a suggested question to send it instantly
- Conversation history is maintained throughout your session
- Press **Enter** or click the send button to submit

For very large documents, text is automatically truncated to fit within the model's context window, with a note indicating how much was included.

---

### AI Studio

Navigate to **AI Studio** from the Home screen for six dedicated AI-powered tools designed for deeper document work.

Tool state is preserved when you switch between tools — your chat history, extracted text, and results stay in memory until you close AI Studio.

---

#### Contract Analyser

Best for legal documents, agreements, NDAs, and service contracts.

1. Click **Add File** and select a contract PDF (or drop one in)
2. Click **Analyse Contract**
3. The AI extracts and structures the document into cards:
   - **Parties** — who is involved in the agreement
   - **Key Dates** — start, end, notice periods, renewal dates
   - **Financial Terms** — amounts, payment schedules, penalties
   - **Obligations** — what each party must do
   - **Red Flags** — unusual clauses, one-sided terms, missing standard protections

Each card is displayed separately so you can read through the analysis quickly.

---

#### Document Chat

For having a conversation with one or more documents simultaneously.

1. Click **Add Files** and select one or more PDFs
2. Click **Load Documents** — text is extracted from all files
3. Type questions in the chat box. The AI has the combined text of all loaded documents as context
4. Follow-up questions work naturally — the AI maintains conversation history

Useful for cross-referencing multiple related documents, researching a topic across a set of reports, or exploring a lengthy document interactively.

---

#### Semantic Search

Finds relevant content by meaning, not just keyword matching.

1. Add one or more PDFs
2. Type a search query describing what you're looking for (e.g. "liability limitations", "payment due dates", "risk factors")
3. Click **Search** — the AI returns the most relevant passages from across all documents
4. Each result shows: the matched passage, the page number, and which file it came from

Unlike Ctrl+F which matches exact words, semantic search understands meaning — so "how much does it cost?" will find pricing information even if those exact words don't appear.

---

#### Table Extractor

Pulls structured data out of PDFs that contain tables.

1. Drop in a PDF
2. Click **Extract Tables**
3. All detected tables are shown in a grid preview inside the app
4. Click **Download CSV** on any table to export it as a `.csv` file ready for Excel or any spreadsheet app

Works best with PDFs that have clearly defined table borders. Uses PyMuPDF's native table detection engine.

---

#### Auto Bookmarks

Generates a Table of Contents for documents that don't have one built in.

1. Drop in a PDF
2. Click **Generate Bookmarks** — the AI reads the document structure and proposes a TOC
3. A preview of the bookmark tree is shown (levels, titles, and page numbers)
4. Click **Apply to PDF** to write the bookmarks directly into the file

The modified PDF will now show a proper outline in any PDF viewer that supports bookmarks.

---

#### AI Rename

Gives meaningful, descriptive filenames to PDFs that have unhelpful names (scan001.pdf, document(2).pdf, etc.).

1. Click **Add Files** and select one or more PDFs
2. Click **Suggest Names** — the AI reads each document and proposes a descriptive filename based on the content
3. Review each suggestion alongside the current filename
4. Click **Apply** next to any suggestion to rename the file on disk immediately
5. Apply all suggestions individually — you stay in control of which renames happen

---

### Settings

Click the **gear icon** in the Editor toolbar, or go to Settings from the Home screen.

#### Choosing a provider

**Claude (Anthropic)**
- Get an API key from [console.anthropic.com](https://console.anthropic.com)
- Paste it into the API key field
- Default model: `claude-haiku-4-5` (fast and cost-efficient)
- Upgrade to `claude-sonnet-4-6` or `claude-opus-4-8` in the Model field for higher quality

**OpenAI**
- Get an API key from [platform.openai.com](https://platform.openai.com)
- Default model: `gpt-4o-mini`
- Upgrade to `gpt-4o` in the Model field for better results

**Ollama (fully local — no API key needed)**
- Install [Ollama](https://ollama.com) and run a model: `ollama run llama3.2`
- Default URL: `http://localhost:11434`
- Default model: `llama3.2`
- Your documents never leave your machine

#### Test Connection
Click **Test Connection** to send a quick request to the configured provider. You'll get a success or error message confirming your credentials work before using any AI features.

#### Saving settings
Click **Save** — settings are stored in your browser's local storage and persist between sessions. They are never sent anywhere and are not included in any files.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+F` | Open Find & Replace |
| `Enter` | Next search match |
| `Shift+Enter` | Previous search match |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+P` | Print |
| `Ctrl++` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom to fit |
| `Escape` | Close active panel or bar |
| `?` | Open keyboard shortcuts reference panel |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Shell** | Electron 33 |
| **UI Framework** | React 18 + TypeScript |
| **Bundler** | Vite 5 |
| **Routing** | React Router 6 |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |
| **PDF Rendering** | react-pdf v10 (PDF.js) |
| **PDF Processing** | PyMuPDF (fitz) via Python sidecar process |
| **AI** | Anthropic Claude API / OpenAI API / Ollama |
| **Packaging** | electron-builder + NSIS |

The Python sidecar (`pdf_engine.py`) is compiled into a standalone `.exe` by PyInstaller and bundled inside the app — end users do not need Python installed.

---

## Building from Source

### Development

```bash
# Clone
git clone https://github.com/benballs32-max/PDF-Studio.git
cd PDF-Studio

# Install Node dependencies
npm install

# Install Python dependencies
pip install pymupdf pillow

# Start dev server (opens Electron automatically)
npm run dev
```

Press F12 inside the app to open DevTools.

### Production build

Produces a Windows NSIS installer in `release/`.

```bash
# Install build tools
pip install pyinstaller pymupdf pillow

# Generate the app icon (only needed once, or after icon changes)
python scripts/make_icon.py

# Full build: Vite → PyInstaller → electron-builder
npm run dist
```

What each step does:
1. **`vite build`** — bundles the React frontend to `dist/` and compiles Electron main/preload to `dist-electron/`
2. **`pyinstaller python/pdf_engine.spec`** — packages the Python engine to `python/dist/pdf_engine/`
3. **`electron-builder`** — packages everything into `release/PDF Studio Setup 1.0.0.exe`

### Regenerating the app icon

```bash
python scripts/make_icon.py
# Writes: public/icon.ico (7 sizes: 16→256) and public/icon.png (256px)
```

---

## Project Structure

```
PDF-Studio/
├── electron/
│   ├── main.ts          # Main process — window, IPC handlers, Python sidecar
│   └── preload.ts       # contextBridge — typed electronAPI exposed to renderer
├── python/
│   ├── pdf_engine.py    # All PDF processing (PyMuPDF)
│   └── pdf_engine.spec  # PyInstaller bundle spec
├── public/
│   ├── icon.ico         # App icon (7 sizes)
│   ├── icon.png         # App icon (256px PNG)
│   └── pdf.worker.min.mjs  # PDF.js web worker
├── scripts/
│   └── make_icon.py     # Icon generator (Pillow)
└── src/
    ├── pages/
    │   ├── Home.tsx       # Landing page
    │   ├── Editor.tsx     # Full PDF editor
    │   ├── Converter.tsx  # PDF conversion tools
    │   ├── ImportPDF.tsx  # Build PDF from images
    │   ├── Batch.tsx      # Batch operations
    │   ├── Compare.tsx    # Side-by-side diff
    │   ├── Settings.tsx   # AI provider config
    │   └── AIStudio.tsx   # Dedicated AI tools
    ├── components/
    │   └── TitleBar.tsx   # Windows title bar with native controls
    ├── utils/
    │   ├── ai.ts          # AI provider routing (Claude / OpenAI / Ollama)
    │   ├── settings.ts    # localStorage settings management
    │   └── recentFiles.ts # Recent files tracking
    └── styles/
        ├── glass.css      # Liquid Glass component styles
        └── globals.css    # CSS variables, resets, scrollbars
```

---

## IPC Architecture

```
Renderer (React)
    ↓  window.electronAPI.*
contextBridge (preload.ts)
    ↓  ipcRenderer.invoke(...)
Main Process (main.ts)
    ↓  child_process / spawn
Python sidecar (pdf_engine.exe in prod, pdf_engine.py in dev)
    ↓  JSON on stdout
Main Process → Renderer
```

PDF commands are JSON-encoded and sent to the Python sidecar as a single argument. Results come back as JSON on stdout.

**Example:**
```json
// Input
{"cmd": "compress", "input": "C:/docs/file.pdf", "output": "C:/docs/file_compressed.pdf"}

// Output
{"success": true, "original_size": 4200000, "compressed_size": 1800000}
```

AI calls are made directly from the renderer via `fetch()` — Electron's renderer has no CORS restrictions, so Claude/OpenAI/Ollama API calls go straight from the app to the provider without passing through the main process.
