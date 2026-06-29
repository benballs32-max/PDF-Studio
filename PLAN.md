# PDF Studio — Implementation Plan

**Goal:** Implement all remaining features from the post-Phase-8 backlog.

## Features

### Quick wins
- [x] ~~Phase 1-8 complete~~
- [ ] **PDF Metadata Editor** — edit Title, Author, Subject, Keywords embedded in file
- [ ] **Flatten PDF** — bake annotations/form fills into the page permanently (warning: loses text layer)
- [ ] **Insert Blank Page** — add a blank A4 page at the current position
- [ ] **Extract Images** — pull all embedded images out as PNG/JPEG files

### Medium effort
- [ ] **Split by Bookmarks** — auto-split a PDF into chapters based on its outline
- [ ] **Find & Replace** — search + replace text across all pages (Ctrl+H style)
- [ ] **Print** — Electron native print dialog

### Polish
- [ ] **Keyboard Shortcuts Panel** — `?` overlay listing all shortcuts (+ add Ctrl+S for save)
- [ ] **App Auto-Updater** — electron-updater checks GitHub releases on startup

## Implementation Notes

### Python commands to add
- `get_metadata(input)` → returns metadata dict
- `set_metadata(input, output, metadata)` → applies metadata
- `flatten_pdf(input, output)` → rasterises pages with annots baked in; text layer lost
- `insert_blank_page(input, output, position, width, height)` → inserts blank page
- `extract_images(input, output_dir)` → saves all embedded images to folder
- `split_by_bookmarks(input, output_dir)` → splits by top-level TOC entries
- `find_replace_text(input, output, find, replace)` → redact+insert replacement

### UI placement
- Metadata, Flatten, Extract Images → Content section of right sidebar
- Insert Blank Page → Page section of right sidebar
- Find & Replace → extend existing search bar (Replace toggle button)
- Print → top toolbar (alongside Save)
- Shortcuts panel → `?` button in toolbar
- Split by Bookmarks → OutlinePanel (below bookmark list when outline exists)
- Auto-updater → main.ts background check, toast notification if update available
