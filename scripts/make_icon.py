"""
PDF Studio icon generator — run once to produce public/icon.ico + public/icon.png
Requires: Pillow  (pip install Pillow)
"""
from PIL import Image, ImageDraw, ImageFilter
import os, math

# ── Palette ────────────────────────────────────────────────────────────────────
GRAD_TOP    = (79,  70, 229)   # indigo-600
GRAD_BOT    = (109, 40, 217)   # violet-600
DOC_FILL    = (255, 255, 255, 250)
DOC_SHADOW  = (0, 0, 0, 55)
FOLD_FILL   = (192, 185, 255, 200)
BAR_START   = (244,  63,  94)  # rose-500
BAR_END     = (192,  38, 211)  # fuchsia-700
LINE_COLOR  = (140, 130, 220, 120)

# ── Helpers ────────────────────────────────────────────────────────────────────
def gradient_bg(size):
    """Diagonal indigo→violet gradient"""
    img = Image.new('RGBA', (size, size))
    pix = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            r = int(GRAD_TOP[0] + (GRAD_BOT[0] - GRAD_TOP[0]) * t)
            g = int(GRAD_TOP[1] + (GRAD_BOT[1] - GRAD_TOP[1]) * t)
            b = int(GRAD_TOP[2] + (GRAD_BOT[2] - GRAD_TOP[2]) * t)
            pix[x, y] = (r, g, b, 255)
    return img

def rounded_mask(size, radius):
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=255)
    return mask

def gradient_bar(width, height, c1, c2):
    """Horizontal gradient bar as RGBA image"""
    bar = Image.new('RGBA', (width, height))
    pix = bar.load()
    for x in range(width):
        t = x / max(width - 1, 1)
        r = int(c1[0] + (c2[0] - c1[0]) * t)
        g = int(c1[1] + (c2[1] - c1[1]) * t)
        b = int(c1[2] + (c2[2] - c1[2]) * t)
        for y in range(height):
            pix[x, y] = (r, g, b, 255)
    return bar

# ── Core icon at a single size ─────────────────────────────────────────────────
def make_at(size):
    # Background
    bg = gradient_bg(size)
    r_corner = max(3, round(size * 0.22))
    mask = rounded_mask(size, r_corner)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    img.paste(bg, mask=mask)

    draw = ImageDraw.Draw(img)

    # Document geometry
    dw = round(size * 0.52)
    dh = round(size * 0.62)
    dx = round((size - dw) / 2)
    dy = round((size - dh) / 2) + round(size * 0.01)
    dr = max(1, round(size * 0.055))

    # Drop shadow (48+)
    if size >= 48:
        sh = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        sh_d = ImageDraw.Draw(sh)
        sh_d.rounded_rectangle(
            [dx + round(size*0.02), dy + round(size*0.025),
             dx + dw + round(size*0.02), dy + dh + round(size*0.025)],
            radius=dr, fill=DOC_SHADOW
        )
        sh = sh.filter(ImageFilter.GaussianBlur(radius=max(2, size // 20)))
        img = Image.alpha_composite(img, sh)
        draw = ImageDraw.Draw(img)

    # White document card
    draw.rounded_rectangle([dx, dy, dx+dw, dy+dh], radius=dr, fill=DOC_FILL)

    # Folded corner (32+)
    fold = round(dw * 0.24) if size >= 32 else 0
    if fold:
        fx, fy = dx + dw - fold, dy
        # Triangle overlay for the fold
        draw.polygon([(fx, fy), (dx+dw, fy), (dx+dw, fy+fold)], fill=FOLD_FILL)
        # Fold crease lines
        lw = max(1, round(size / 90))
        draw.line([(fx, fy), (fx, fy+fold)], fill=(160,150,230,160), width=lw)
        draw.line([(fx, fy+fold), (dx+dw, fy+fold)], fill=(160,150,230,160), width=lw)

    # Gradient bar at top of document (32+) — rose→fuchsia, PDF brand color
    if size >= 32:
        bar_h = max(2, round(dh * 0.11))
        bar_w = dw - fold if fold else dw
        bar_img = gradient_bar(bar_w, bar_h, BAR_START, BAR_END)
        # Round the top-left corner of the bar to match doc
        bar_mask = Image.new('L', (bar_w, bar_h), 255)
        img.paste(bar_img, (dx, dy), mask=bar_mask)

        # Re-draw doc top edge to clean up
        if fold:
            # Re-clip right side of bar under fold
            draw.polygon([(dx+bar_w, dy), (dx+dw, dy), (dx+dw, dy+fold)], fill=DOC_FILL)
            draw.polygon([(dx+bar_w, dy), (dx+dw, dy), (dx+dw, dy+bar_h)], fill=(0,0,0,0))
            bar_img2 = gradient_bar(bar_w, bar_h, BAR_START, BAR_END)
            img.paste(bar_img2, (dx, dy), mask=bar_mask)
            draw = ImageDraw.Draw(img)
            draw.polygon([(fx, fy), (dx+dw, fy), (dx+dw, fy+fold)], fill=FOLD_FILL)
            draw.line([(fx, fy), (fx, fy+fold)], fill=(160,150,230,160), width=max(1, round(size/90)))
            draw.line([(fx, fy+fold), (dx+dw, fy+fold)], fill=(160,150,230,160), width=max(1, round(size/90)))

    # Text lines (32+)
    if size >= 32:
        lx1 = dx + round(dw * 0.15)
        lx2 = dx + round(dw * 0.85)
        ly_start = dy + round(dh * 0.40)
        lw_px = max(1, round(size / 72))
        spacing = round(dh * 0.14)
        for i in range(3):
            ly = ly_start + i * spacing
            x2 = lx2 if i < 2 else lx1 + round((lx2 - lx1) * 0.6)  # last line shorter
            draw.line([(lx1, ly), (x2, ly)], fill=LINE_COLOR, width=lw_px)

    return img

# ── Build all sizes and save ───────────────────────────────────────────────────
SIZES = [16, 24, 32, 48, 64, 128, 256]
print("Generating PDF Studio icon...")
images = {s: make_at(s) for s in SIZES}
print(f"  Generated {len(SIZES)} sizes: {SIZES}")

os.makedirs('public', exist_ok=True)

# PNG (256px)
images[256].save('public/icon.png')
print("  OK public/icon.png")

# ICO — save each size as RGBA PNG bytes, then hand-build the ICO binary
# so all sizes are guaranteed present (Pillow's multi-size ICO is unreliable)
import io, struct

def _ico_entry(img):
    """Return (directory entry bytes, PNG data bytes) for one ICO frame."""
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    data = buf.getvalue()
    w, h = img.size
    w_byte = 0 if w == 256 else w   # ICO uses 0 to mean 256
    h_byte = 0 if h == 256 else h
    # ICONDIRENTRY: width, height, colorCount, reserved, planes, bitCount, size, offset
    entry = struct.pack('<BBBBHHII', w_byte, h_byte, 0, 0, 1, 32, len(data), 0)
    return entry, data

ico_sizes = [16, 24, 32, 48, 64, 128, 256]
entries, datas = [], []
for s in ico_sizes:
    e, d = _ico_entry(images[s])
    entries.append(e)
    datas.append(d)

# Calculate offsets: ICONDIR (6) + ICONDIRENTRY*n (16*n) + preceding data
header = struct.pack('<HHH', 0, 1, len(ico_sizes))  # reserved, type=1 (ICO), count
offset = 6 + 16 * len(ico_sizes)
fixed_entries = []
for e, d in zip(entries, datas):
    # Patch the offset field (last 4 bytes of entry)
    fixed_entries.append(e[:12] + struct.pack('<I', offset))
    offset += len(d)

with open('public/icon.ico', 'wb') as f:
    f.write(header)
    for e in fixed_entries:
        f.write(e)
    for d in datas:
        f.write(d)

print("  OK public/icon.ico")
print("Done.")
