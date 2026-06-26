# PDF Studio — Roadmap

Progress tracker for making PDF Studio rival Adobe Acrobat.
Cross off items as they are completed.

---

## Phase 1 — Page Management ✅ DONE
- [x] Page thumbnails sidebar (click to jump to page)
- [x] Drag to reorder pages
- [x] Extract specific pages to a new PDF
- [x] Insert pages from another PDF
- [x] Crop pages

## Phase 2 — Document Navigation ✅ DONE
- [x] Bookmarks / outline panel (chapter tree from PDF metadata)
- [x] Comments panel (sidebar listing every annotation with jump-to)
- [ ] Sticky notes — skipped (not needed)

## Phase 3 — Content Editing ✅ DONE (practical subset)
- [ ] Edit text inline — skipped (requires deep PDF content-stream editing)
- [ ] Add / replace / resize images — skipped (future)
- [x] Watermarks (diagonal text, opacity + angle controls, all pages)
- [x] Stamps — APPROVED / DRAFT / CONFIDENTIAL / COPY / VOID with colour-coded border
- [x] Headers & footers across all pages (with separator line)
- [x] Page numbering (6 positions, configurable start number)

## Phase 4 — Inbound Conversions
- [ ] Images (PNG / JPG) → PDF
- [ ] Word / PowerPoint / Excel → PDF
- [ ] Webpage (URL) → PDF

## Phase 5 — Security & Compliance
- [ ] Redaction — permanently black out sensitive text & images
- [ ] Permission controls (restrict printing / copying / editing independently)
- [ ] Digital signatures (sign + verify)

## Phase 6 — Forms
- [ ] Fill existing PDF form fields
- [ ] Create interactive form fields (text box, checkbox, radio, dropdown, signature)
- [ ] Export / import form data (JSON / CSV)

## Phase 7 — OCR
- [ ] Tesseract integration to recognise text in scanned / image-based PDFs
- [ ] Output a searchable text layer over the scan
- [ ] Scanned docs become searchable via the existing Ctrl+F search

## Phase 8 — Advanced
- [ ] Compare two PDFs (side-by-side visual diff)
- [ ] Comment threads (reply to individual annotations)
- [ ] Annotation undo / redo stack
- [ ] Batch operations (watermark / compress / convert an entire folder)

---

## Future / Deferred

### PDF Content Editing (requires careful UX design)
- [ ] **Image replacement** — detect images on the current page (via PyMuPDF `get_images` + `get_image_bbox`), highlight their bounding boxes in the viewer, click one to open a file picker and swap it via `doc.replace_image(xref, filename=...)`. Fully feasible.
- [ ] **Text redact & replace** — user draws a rectangle over existing text (like the crop tool), that region is erased (redaction), then they type replacement text which is inserted at the same position. Font won't match the original exactly (PDF limitation — text is stored as positioned drawing commands, not editable strings), but gives a practical "white-out and retype" workflow. Same trade-off every non-Adobe editor makes.

> Note: True inline text editing with reflow is not possible — PDF has no paragraph model or text-flow engine. The above two approaches are the closest practical equivalents.

---

## Already Shipped
- [x] PDF viewer with zoom, page navigation
- [x] Annotation tools — highlight, draw, text, erase
- [x] Save annotations permanently to PDF (PyMuPDF)
- [x] Rotate & delete pages
- [x] Full-text search (Ctrl+F) with match highlighting
- [x] Convert PDF → Word, Excel, PNG, JPEG, HTML, plain text
- [x] Merge PDFs
- [x] Split PDF into individual pages
- [x] Compress PDF
- [x] Password protect / unlock (AES-256)
- [x] Recent files on home screen
- [x] Liquid Glass UI / Electron native window
