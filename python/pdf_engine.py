"""PDF processing engine — called as a subprocess by Electron main process."""
import sys
import json
import os

def to_text(input: str, output: str, **_):
    import fitz
    doc = fitz.open(input)
    text = "\n\n".join(page.get_text() for page in doc)
    with open(output, "w", encoding="utf-8") as f:
        f.write(text)
    return {"success": True, "pages": len(doc)}

def to_html(input: str, output: str, **_):
    import fitz
    doc = fitz.open(input)
    parts = [page.get_text("html") for page in doc]
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Converted PDF</title></head>
<body>{'<hr>'.join(parts)}</body></html>"""
    with open(output, "w", encoding="utf-8") as f:
        f.write(html)
    return {"success": True, "pages": len(doc)}

def to_image(input: str, output: str, format: str = "png", dpi: int = 150, **_):
    import fitz
    doc = fitz.open(input)
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    base, ext = os.path.splitext(output)
    saved = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        path = f"{base}_p{i+1}{ext}" if len(doc) > 1 else output
        pix.save(path)
        saved.append(path)
    return {"success": True, "files": saved}

def to_docx(input: str, output: str, **_):
    import fitz
    from docx import Document
    from docx.shared import Pt

    doc = fitz.open(input)
    word = Document()
    for page in doc:
        for block in page.get_text("blocks"):
            text = block[4].strip()
            if text:
                para = word.add_paragraph(text)
                para.paragraph_format.space_after = Pt(6)
        word.add_page_break()
    word.save(output)
    return {"success": True, "pages": len(doc)}

def to_xlsx(input: str, output: str, **_):
    import fitz
    import openpyxl

    doc = fitz.open(input)
    wb = openpyxl.Workbook()
    for page_num, page in enumerate(doc):
        ws = wb.create_sheet(title=f"Page {page_num + 1}")
        tables = page.find_tables()
        if tables.tables:
            for table in tables.tables:
                for r, row in enumerate(table.extract()):
                    for c, cell in enumerate(row):
                        ws.cell(row=r + 1, column=c + 1, value=cell)
        else:
            for i, line in enumerate(page.get_text().splitlines()):
                ws.cell(row=i + 1, column=1, value=line)
    if "Sheet" in wb.sheetnames:
        del wb["Sheet"]
    wb.save(output)
    return {"success": True, "pages": len(doc)}

def merge(inputs: list, output: str, **_):
    import fitz
    result = fitz.open()
    for path in inputs:
        result.insert_pdf(fitz.open(path))
    result.save(output)
    return {"success": True, "pages": len(result)}

def split(input: str, output: str, **_):
    import fitz
    doc = fitz.open(input)
    os.makedirs(output, exist_ok=True)
    saved = []
    for i in range(len(doc)):
        out = fitz.open()
        out.insert_pdf(doc, from_page=i, to_page=i)
        path = os.path.join(output, f"page_{i+1}.pdf")
        out.save(path)
        saved.append(path)
    return {"success": True, "files": saved}

def compress(input: str, output: str, **_):
    import fitz
    doc = fitz.open(input)
    doc.save(output, garbage=4, deflate=True, clean=True)
    before = os.path.getsize(input)
    after = os.path.getsize(output)
    return {"success": True, "before_kb": before // 1024, "after_kb": after // 1024}

def rotate_page(input: str, output: str, page: int, angle: int, **_):
    import fitz
    doc = fitz.open(input)
    doc[page].set_rotation((doc[page].rotation + angle) % 360)
    doc.save(output)
    return {"success": True}

def delete_page(input: str, output: str, page: int, **_):
    import fitz
    doc = fitz.open(input)
    doc.delete_page(page)
    doc.save(output)
    return {"success": True, "pages": len(doc)}

def apply_annotations(input: str, output: str, annotations: list, **_):
    import fitz

    def hex_to_rgb(h: str):
        h = h.lstrip('#')
        return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))

    doc = fitz.open(input)
    for a in annotations:
        pg = doc[a['page']]
        color = hex_to_rgb(a.get('color', '#FACC15'))
        if a['type'] == 'highlight':
            annot = pg.add_highlight_annot(fitz.Rect(a['rect']))
            annot.set_colors(stroke=color); annot.update()
        elif a['type'] == 'text':
            annot = pg.add_text_annot(fitz.Point(a['x'], pg.rect.height - a['y']), a['content'])
            annot.set_colors(stroke=color); annot.update()
        elif a['type'] == 'ink':
            ink = [[fitz.Point(p[0], pg.rect.height - p[1]) for p in a['points']]]
            annot = pg.add_ink_annot(ink)
            annot.set_colors(stroke=color)
            annot.set_border(width=a.get('width', 2))
            annot.update()
    doc.save(output)
    return {"success": True}

def reorder_pages(input: str, output: str, order: list, **_):
    import fitz
    doc = fitz.open(input)
    doc.select(order)
    doc.save(output)
    return {"success": True, "pages": len(doc)}

def extract_pages(input: str, output: str, pages: list, **_):
    import fitz
    doc = fitz.open(input)
    out = fitz.open()
    for pg in sorted(set(pages)):
        out.insert_pdf(doc, from_page=pg, to_page=pg)
    out.save(output)
    return {"success": True, "pages": len(out)}

def insert_pages(input: str, output: str, source: str, position: int, **_):
    import fitz
    doc = fitz.open(input)
    src = fitz.open(source)
    doc.insert_pdf(src, start_at=position)
    doc.save(output)
    return {"success": True, "pages": len(doc)}

def crop_page(input: str, output: str, page: int, rect: list, **_):
    import fitz
    doc = fitz.open(input)
    doc[page].set_cropbox(fitz.Rect(rect))
    doc.save(output)
    return {"success": True}

def encrypt_pdf(input: str, output: str, password: str, **_):
    import fitz
    doc = fitz.open(input)
    doc.save(output,
             encryption=fitz.PDF_ENCRYPT_AES_256,
             user_pw=password,
             owner_pw=password)
    return {"success": True}

def decrypt_pdf(input: str, output: str, password: str, **_):
    import fitz
    doc = fitz.open(input)
    if doc.needs_pass:
        if not doc.authenticate(password):
            raise ValueError("Incorrect password — could not unlock the PDF.")
    doc.save(output, encryption=fitz.PDF_ENCRYPT_NONE)
    return {"success": True}

COMMANDS = {
    "to_text": to_text,
    "to_html": to_html,
    "to_image": to_image,
    "to_docx": to_docx,
    "to_xlsx": to_xlsx,
    "merge": merge,
    "split": split,
    "compress": compress,
    "rotate_page": rotate_page,
    "delete_page": delete_page,
    "apply_annotations": apply_annotations,
    "encrypt_pdf": encrypt_pdf,
    "decrypt_pdf": decrypt_pdf,
    "reorder_pages": reorder_pages,
    "extract_pages": extract_pages,
    "insert_pages": insert_pages,
    "crop_page": crop_page,
}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No arguments provided"}))
        sys.exit(1)
    try:
        payload = json.loads(sys.argv[1])
        cmd = payload.pop("cmd")
        if cmd not in COMMANDS:
            raise ValueError(f"Unknown command: {cmd}")
        result = COMMANDS[cmd](**payload)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
