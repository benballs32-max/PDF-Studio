# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for the PDF Studio Python sidecar.
# Run from project root:  npm run build:python
# Or manually:  pyinstaller python/pdf_engine.spec --noconfirm

a = Analysis(
    ['pdf_engine.py'],
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=[
        # PyMuPDF (fitz)
        'fitz', 'fitz._fitz',
        # PIL / Pillow
        'PIL', 'PIL.Image', 'PIL.ImageFile',
        # docx2pdf — uses Win32 COM on Windows
        'docx2pdf',
        'win32com', 'win32com.client', 'pywintypes',
        # Office file libraries
        'docx', 'pptx', 'openpyxl',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Strip heavy packages we never use
    excludes=['tkinter', 'matplotlib', 'scipy', 'numpy', 'pandas'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='pdf_engine',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,   # console=True so stdout/stderr are captured by Electron
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='pdf_engine',
)
