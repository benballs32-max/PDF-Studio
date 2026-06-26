import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { addRecentFile } from '../utils/recentFiles'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  ArrowLeft, Upload, FileText, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Maximize2, X, Save, RotateCw, Trash2,
  MousePointer, Highlighter, PenLine, Type, Eraser,
  Search, ChevronUp, ChevronDown,
} from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

type Tool = 'select' | 'highlight' | 'draw' | 'text' | 'erase'
type AnnotShape =
  | { type: 'highlight'; x: number; y: number; w: number; h: number; color: string }
  | { type: 'draw'; pts: [number, number][]; color: string; lw: number }
  | { type: 'text'; x: number; y: number; content: string; color: string }
type Annot = AnnotShape & { id: string; page: number }

const COLORS = ['#FACC15', '#34D399', '#60A5FA', '#F87171', '#C084FC', '#000000']
const HIGHLIGHT_ALPHA = '55'

// ── Full-text search ─────────────────────────────────────────────────────────
interface TxtItem { str: string; x: number; y: number; w: number; h: number }
interface PageText { pageNum: number; items: TxtItem[]; fullText: string; offsets: number[] }
interface MatchRect { x: number; y: number; w: number; h: number }
interface SearchMatch { page: number; rect: MatchRect }

function buildMatchRects(pt: PageText, qLower: string): MatchRect[] {
  const lower = pt.fullText.toLowerCase()
  const rects: MatchRect[] = []
  let pos = 0
  while ((pos = lower.indexOf(qLower, pos)) !== -1) {
    const end = pos + qLower.length
    const hit = pt.items.filter((_, i) => {
      const s = pt.offsets[i], e = s + pt.items[i].str.length
      return e > pos && s < end && pt.items[i].str.trim()
    })
    if (hit.length) {
      const minX = Math.min(...hit.map(t => t.x))
      const maxX = Math.max(...hit.map(t => t.x + t.w))
      const y = Math.min(...hit.map(t => t.y))
      const h = Math.max(...hit.map(t => t.h)) || 12
      rects.push({ x: minX, y, w: Math.max(maxX - minX, 4), h })
    }
    pos++
  }
  return rects
}

// Convert annotation canvas coords → PDF point space for PyMuPDF
function toPdfCoords(
  ax: number, ay: number, aw: number, ah: number,
  canvasW: number, canvasH: number, scale: number,
) {
  const ptW = canvasW / scale
  const ptH = canvasH / scale
  const x0 = ax / scale
  const y0 = ptH - (ay + ah) / scale
  const x1 = (ax + aw) / scale
  const y1 = ptH - ay / scale
  return [x0, y0, x1, y1, ptW, ptH]
}

export default function Editor() {
  const navigate = useNavigate()
  const location = useLocation()

  // Files
  const [files, setFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<string | null>(null)

  // Viewer state
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [canvasDims, setCanvasDims] = useState<{ w: number; h: number } | null>(null)

  // Editing
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState(COLORS[0])
  const [lineWidth, setLineWidth] = useState(3)
  const [annotations, setAnnotations] = useState<Map<number, Annot[]>>(new Map())
  const [drawing, setDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState<[number, number][]>([])
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [textTarget, setTextTarget] = useState<{ x: number; y: number } | null>(null)
  const [textVal, setTextVal] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)

  // Search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [textIndex, setTextIndex] = useState<PageText[]>([])
  const [allMatches, setAllMatches] = useState<SearchMatch[]>([])
  const [matchIdx, setMatchIdx] = useState(0)

  const viewerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const pageContainerRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Load a PDF by path directly ─────────────────────────────────────────────
  const loadPdf = async (path: string) => {
    setPdfData(null)
    setCanvasDims(null)
    setNumPages(0)
    setLoadError(null)
    try {
      const data = await window.electronAPI!.readFile(path)
      if (data && data.length > 0) {
        setPdfData(data)
        addRecentFile(path)
      } else {
        setLoadError(`readFile returned empty (path: ${path})`)
      }
    } catch (err: unknown) {
      setLoadError(`readFile threw: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Open file passed via router state (e.g. clicking a recent file on Home)
  useEffect(() => {
    const fileFromNav = (location.state as { file?: string } | null)?.file
    if (fileFromNav) {
      setFiles([fileFromNav])
      setActiveFile(fileFromNav)
      setPageNumber(1)
      loadPdf(fileFromNav)
      window.history.replaceState({}, '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Extract text from every page once PDF loads (for search) ────────────────
  useEffect(() => {
    if (!pdfData) { setTextIndex([]); setAllMatches([]); return }
    let cancelled = false
    ;(async () => {
      const pdf = await pdfjs.getDocument(pdfData).promise
      const index: PageText[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const vp = page.getViewport({ scale: 1 })
        const items: TxtItem[] = content.items
          .filter((it): it is typeof it & { str: string } => 'str' in it)
          .map(it => ({
            str: it.str,
            x: it.transform[4],
            y: it.transform[5],
            w: it.width,
            h: it.height || Math.abs(it.transform[3]) || 12,
          }))
        let fullText = ''
        const offsets: number[] = []
        for (const it of items) { offsets.push(fullText.length); fullText += it.str }
        index.push({ pageNum: i, items, fullText, offsets })
        void vp // used for side-effect of loading page viewport
      }
      if (!cancelled) setTextIndex(index)
    })()
    return () => { cancelled = true }
  }, [pdfData])

  // ── Re-run search whenever query or index changes ────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim() || textIndex.length === 0) {
      setAllMatches([]); setMatchIdx(0); return
    }
    const q = searchQuery.toLowerCase()
    const matches: SearchMatch[] = []
    for (const pt of textIndex) {
      for (const rect of buildMatchRects(pt, q)) matches.push({ page: pt.pageNum, rect })
    }
    setAllMatches(matches)
    setMatchIdx(0)
    if (matches.length > 0) setPageNumber(matches[0].page)
  }, [searchQuery, textIndex])

  // ── Ctrl+F opens search; Escape closes it ───────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault(); setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus search input when bar opens
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 30)
  }, [searchOpen])

  // ── Redraw annotation overlay whenever annotations / dims / page change ─────
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas || !canvasDims) return
    canvas.width = canvasDims.w
    canvas.height = canvasDims.h
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Search highlights — drawn first so annotations appear on top
    const ptH = canvasDims.h / scale
    const pageMatches = allMatches.map((m, i) => ({ m, i })).filter(({ m }) => m.page === pageNumber)
    for (const { m, i } of pageMatches) {
      ctx.fillStyle = i === matchIdx ? 'rgba(250,204,21,0.65)' : 'rgba(250,204,21,0.28)'
      ctx.fillRect(
        m.rect.x * scale,
        (ptH - m.rect.y - m.rect.h) * scale,
        m.rect.w * scale,
        m.rect.h * scale,
      )
    }

    const pageAnnots = annotations.get(pageNumber) ?? []
    for (const a of pageAnnots) {
      ctx.save()
      if (a.type === 'highlight') {
        ctx.fillStyle = a.color + HIGHLIGHT_ALPHA
        ctx.fillRect(a.x, a.y, a.w, a.h)
      } else if (a.type === 'draw') {
        ctx.strokeStyle = a.color
        ctx.lineWidth = a.lw
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        a.pts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py))
        ctx.stroke()
      } else if (a.type === 'text') {
        ctx.fillStyle = a.color
        ctx.font = '14px Inter, sans-serif'
        ctx.fillText(a.content, a.x, a.y + 14)
      }
      ctx.restore()
    }

    // Live drag rect / path preview
    ctx.save()
    if (dragRect && (tool === 'highlight')) {
      ctx.fillStyle = color + HIGHLIGHT_ALPHA
      ctx.fillRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h)
    }
    if (currentPath.length > 1 && tool === 'draw') {
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      currentPath.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py))
      ctx.stroke()
    }
    ctx.restore()
  }, [annotations, pageNumber, canvasDims, dragRect, currentPath, tool, color, lineWidth, allMatches, matchIdx, scale])

  // Focus text input when it appears
  useEffect(() => {
    if (textTarget) setTimeout(() => textInputRef.current?.focus(), 30)
  }, [textTarget])

  // ── File management ─────────────────────────────────────────────────────────
  const addFiles = useCallback((paths: string[]) => {
    setFiles(prev => {
      const next = [...prev, ...paths.filter(p => !prev.includes(p))]
      return next
    })
    // Load the first new file if nothing is open yet
    if (!activeFile && paths.length > 0) {
      setActiveFile(paths[0])
      setPageNumber(1)
      loadPdf(paths[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile])

  const [isDragActive, setIsDragActive] = useState(false)

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragActive(true) }
  const handleDragLeave = () => setIsDragActive(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    const paths = Array.from(e.dataTransfer.files)
      .filter(f => f.name.toLowerCase().endsWith('.pdf'))
      .map(f => (f as unknown as { path: string }).path)
      .filter(Boolean)
    if (paths.length) addFiles(paths)
  }

  const openFromDialog = async () => {
    const paths = await window.electronAPI?.openPDF()
    if (!paths?.length) return
    setFiles(prev => [...prev, ...paths.filter(p => !prev.includes(p))])
    if (!activeFile) {
      setActiveFile(paths[0])
      setPageNumber(1)
    }
    loadPdf(paths[0])
  }

  const switchFile = (path: string) => {
    setActiveFile(path)
    setPageNumber(1)
    setAnnotations(new Map())
    loadPdf(path)
  }

  const removeFile = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFiles(prev => {
      const next = prev.filter(p => p !== path)
      if (activeFile === path) switchFile(next[0] ?? '')
      return next
    })
  }

  // ── ResizeObserver: reliably track PDF canvas pixel dimensions ──────────────
  useLayoutEffect(() => {
    const container = pageContainerRef.current
    if (!container) return
    const sync = () => {
      const c = container.querySelector<HTMLCanvasElement>('canvas.react-pdf__Page__canvas')
      if (c && c.offsetWidth > 0) setCanvasDims({ w: c.offsetWidth, h: c.offsetHeight })
    }
    const obs = new ResizeObserver(sync)
    obs.observe(container)
    sync() // run once immediately in case already rendered
    return () => obs.disconnect()
  }, [pdfData, pageNumber, scale])

  // ── Viewer helpers ──────────────────────────────────────────────────────────
  const goTo = (n: number) => setPageNumber(Math.max(1, Math.min(n, numPages)))
  const zoom = (d: number) => setScale(s => parseFloat(Math.max(0.5, Math.min(3, s + d)).toFixed(1)))

  const gotoMatch = (delta: number) => {
    if (!allMatches.length) return
    const next = (matchIdx + delta + allMatches.length) % allMatches.length
    setMatchIdx(next)
    setPageNumber(allMatches[next].page)
  }
  const fitWidth = () => {
    if (viewerRef.current) setScale((viewerRef.current.clientWidth - 80) / 595)
  }

  // ── Annotation helpers ──────────────────────────────────────────────────────
  const uid = () => Math.random().toString(36).slice(2)
  const relPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = overlayRef.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as [number, number]
  }

  const addAnnot = (a: Omit<Annot, 'id' | 'page'>) => {
    setAnnotations(prev => {
      const next = new Map(prev)
      const existing = next.get(pageNumber) ?? []
      next.set(pageNumber, [...existing, { ...a, id: uid(), page: pageNumber } as Annot])
      return next
    })
  }

  const eraseAt = (x: number, y: number) => {
    setAnnotations(prev => {
      const next = new Map(prev)
      const existing = next.get(pageNumber) ?? []
      next.set(pageNumber, existing.filter(a => {
        if (a.type === 'highlight') return !(x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h)
        if (a.type === 'text') return !(x >= a.x && x <= a.x + 120 && y >= a.y && y <= a.y + 20)
        if (a.type === 'draw') return !a.pts.some(([px, py]) => Math.hypot(px - x, py - y) < 12)
        return true
      }))
      return next
    })
  }

  // ── Canvas mouse events ─────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'select') return
    const [x, y] = relPos(e)

    if (tool === 'text') { setTextTarget({ x, y }); setTextVal(''); return }
    if (tool === 'erase') { eraseAt(x, y); return }
    if (tool === 'highlight') { setDragRect({ x, y, w: 0, h: 0 }); setDrawing(true); return }
    if (tool === 'draw') { setCurrentPath([[x, y]]); setDrawing(true); return }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const [x, y] = relPos(e)
    if (tool === 'highlight' && dragRect) {
      setDragRect({ x: dragRect.x, y: dragRect.y, w: x - dragRect.x, h: y - dragRect.y })
    }
    if (tool === 'draw') {
      setCurrentPath(prev => [...prev, [x, y]])
    }
    if (tool === 'erase') eraseAt(x, y)
  }

  const onMouseUp = () => {
    if (!drawing) return
    setDrawing(false)
    if (tool === 'highlight' && dragRect && Math.abs(dragRect.w) > 4 && Math.abs(dragRect.h) > 4) {
      const x = dragRect.w < 0 ? dragRect.x + dragRect.w : dragRect.x
      const y = dragRect.h < 0 ? dragRect.y + dragRect.h : dragRect.y
      addAnnot({ type: 'highlight', x, y, w: Math.abs(dragRect.w), h: Math.abs(dragRect.h), color })
    }
    if (tool === 'draw' && currentPath.length > 1) {
      addAnnot({ type: 'draw', pts: currentPath, color, lw: lineWidth })
    }
    setDragRect(null)
    setCurrentPath([])
  }

  const commitText = () => {
    if (textTarget && textVal.trim()) {
      addAnnot({ type: 'text', x: textTarget.x, y: textTarget.y, content: textVal.trim(), color })
    }
    setTextTarget(null); setTextVal('')
  }

  // ── Page actions via PyMuPDF ────────────────────────────────────────────────
  const rotatePage = async (dir: 'cw' | 'ccw') => {
    if (!activeFile) return
    const outPath = activeFile // save in-place
    await window.electronAPI?.pdfCommand('rotate_page', {
      input: activeFile, output: outPath, page: pageNumber - 1, angle: dir === 'cw' ? 90 : -90,
    })
    // Reload
    const data = await window.electronAPI?.readFile(activeFile)
    if (data) setPdfData(data)
  }

  const deletePage = async () => {
    if (!activeFile || numPages <= 1) return
    await window.electronAPI?.pdfCommand('delete_page', {
      input: activeFile, output: activeFile, page: pageNumber - 1,
    })
    const data = await window.electronAPI?.readFile(activeFile)
    if (data) { setPdfData(data); goTo(Math.min(pageNumber, numPages - 1)) }
  }

  // ── Save with annotations ───────────────────────────────────────────────────
  const save = async () => {
    if (!activeFile || !canvasDims) return
    setSaveStatus('saving')
    const annotList: object[] = []

    for (const [pg, annots] of annotations.entries()) {
      for (const a of annots) {
        if (a.type === 'highlight') {
          const [x0, y0, x1, y1] = toPdfCoords(a.x, a.y, a.w, a.h, canvasDims.w, canvasDims.h, scale)
          annotList.push({ type: 'highlight', page: pg - 1, rect: [x0, y0, x1, y1], color: a.color })
        } else if (a.type === 'text') {
          const px = a.x / scale
          const py = canvasDims.h / scale - a.y / scale
          annotList.push({ type: 'text', page: pg - 1, x: px, y: py, content: a.content, color: a.color })
        } else if (a.type === 'draw') {
          const inkList = a.pts.map(([px, py]) => [px / scale, canvasDims.h / scale - py / scale])
          annotList.push({ type: 'ink', page: pg - 1, points: inkList, color: a.color, width: a.lw })
        }
      }
    }

    try {
      const outPath = await window.electronAPI?.savePath('pdf')
      if (!outPath) { setSaveStatus('idle'); return }
      await window.electronAPI?.pdfCommand('apply_annotations', {
        input: activeFile, output: outPath, annotations: annotList,
      })
      setSaveStatus('done')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (err) {
      console.error(err); setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const cursorFor: Record<Tool, string> = {
    select: 'default', highlight: 'crosshair', draw: 'crosshair', text: 'text', erase: 'cell',
  }

  const pageAnnotCount = (annotations.get(pageNumber) ?? []).length

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 10 }}
    >

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <ToolBarBtn onClick={() => navigate('/')}><ArrowLeft size={14} /> Back</ToolBarBtn>
        <span style={{ fontWeight: 600, fontSize: 16, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeFile ? activeFile.split(/[\\/]/).pop() : 'PDF Editor'}
        </span>
        <ToolBarBtn onClick={openFromDialog} accent><Upload size={13} /> Open</ToolBarBtn>
        {activeFile && (
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={save}
            disabled={saveStatus === 'saving'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: saveStatus === 'done' ? 'rgba(34,197,94,0.25)' : saveStatus === 'error' ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: 'white', boxShadow: '0 0 20px rgba(99,102,241,0.3)',
            }}
          >
            <Save size={13} />
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'done' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save PDF'}
          </motion.button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {files.length === 0 ? (
          <motion.div
            key="drop" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="glass glass-shimmer"
            style={{ flex: 1, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, cursor: 'pointer', border: isDragActive ? '2px dashed rgba(99,102,241,0.8)' : undefined }}
          >
            <div style={{ width: 68, height: 68, borderRadius: 18, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={26} color="#6366f1" />
            </div>
            <p style={{ fontWeight: 600, fontSize: 16 }}>{isDragActive ? 'Drop PDF here' : 'Drag & drop a PDF or use Open above'}</p>
          </motion.div>
        ) : (
          <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', gap: 10, overflow: 'hidden' }}>

            {/* Left: file list */}
            <div className="glass" style={{ width: 170, borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto', flexShrink: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingBottom: 6 }}>Files</p>
              {files.map(f => {
                const name = f.split(/[\\/]/).pop() ?? f
                const active = f === activeFile
                return (
                  <div key={f} onClick={() => switchFile(f)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', background: active ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : 'transparent'}` }}>
                    <FileText size={12} color={active ? '#818cf8' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: active ? '#c7d2fe' : 'var(--text-secondary)' }}>{name}</span>
                    <button onClick={e => removeFile(f, e)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 1, display: 'flex', flexShrink: 0 }}><X size={10} /></button>
                  </div>
                )
              })}
            </div>

            {/* Centre: toolbar + viewer */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>

              {/* Toolbar row */}
              <div style={{ borderRadius: 10, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {/* Page nav */}
                <TBtn onClick={() => goTo(pageNumber - 1)} disabled={pageNumber <= 1}><ChevronLeft size={13} /></TBtn>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 60, textAlign: 'center' }}>
                  {numPages > 0 ? `${pageNumber} / ${numPages}` : '—'}
                </span>
                <TBtn onClick={() => goTo(pageNumber + 1)} disabled={pageNumber >= numPages}><ChevronRight size={13} /></TBtn>

                <Sep />

                {/* Zoom */}
                <TBtn onClick={() => zoom(-0.1)}><ZoomOut size={13} /></TBtn>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 38, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
                <TBtn onClick={() => zoom(0.1)}><ZoomIn size={13} /></TBtn>
                <TBtn onClick={fitWidth}><Maximize2 size={12} /></TBtn>

                <Sep />

                {/* Editing tools */}
                {([
                  ['select', <MousePointer size={13} />, 'Select'],
                  ['highlight', <Highlighter size={13} />, 'Highlight'],
                  ['draw', <PenLine size={13} />, 'Draw'],
                  ['text', <Type size={13} />, 'Text'],
                  ['erase', <Eraser size={13} />, 'Erase'],
                ] as [Tool, React.ReactNode, string][]).map(([t, icon, label]) => (
                  <TBtn key={t} onClick={() => setTool(t)} active={tool === t} title={label}>{icon}</TBtn>
                ))}

                <Sep />

                {/* Color swatches */}
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    title={c}
                    style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: color === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }}
                  />
                ))}

                <Sep />

                {/* Line width */}
                {[2, 4, 7].map(w => (
                  <button
                    key={w}
                    onClick={() => setLineWidth(w)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: lineWidth === w ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)', border: `1px solid ${lineWidth === w ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer' }}
                  >
                    <div style={{ width: w + 8, height: w, background: 'white', borderRadius: 99 }} />
                  </button>
                ))}

                <Sep />

                {/* Page actions */}
                <TBtn onClick={() => rotatePage('cw')} title="Rotate CW"><RotateCw size={13} /></TBtn>
                <TBtn onClick={deletePage} disabled={numPages <= 1} title="Delete page"><Trash2 size={13} /></TBtn>

                <Sep />

                {/* Search */}
                <TBtn onClick={() => setSearchOpen(o => !o)} active={searchOpen} title="Search (Ctrl+F)">
                  <Search size={13} />
                  {allMatches.length > 0 && <span style={{ fontSize: 10 }}>{allMatches.length}</span>}
                </TBtn>

                {pageAnnotCount > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>{pageAnnotCount} annotation{pageAnnotCount !== 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Search bar */}
              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 10, background: 'rgba(15,12,41,0.92)', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}
                  >
                    <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') gotoMatch(e.shiftKey ? -1 : 1)
                        if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
                      }}
                      placeholder="Search in PDF…"
                      style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 14, outline: 'none', flex: 1, minWidth: 160 }}
                    />
                    {searchQuery && (
                      <span style={{ fontSize: 12, color: allMatches.length ? 'var(--text-muted)' : '#ef4444', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {allMatches.length ? `${matchIdx + 1} / ${allMatches.length}` : 'No results'}
                      </span>
                    )}
                    <TBtn onClick={() => gotoMatch(-1)} disabled={!allMatches.length} title="Previous (Shift+Enter)"><ChevronUp size={13} /></TBtn>
                    <TBtn onClick={() => gotoMatch(1)}  disabled={!allMatches.length} title="Next (Enter)"><ChevronDown size={13} /></TBtn>
                    <TBtn onClick={() => { setSearchOpen(false); setSearchQuery('') }} title="Close (Esc)"><X size={13} /></TBtn>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* PDF viewer + overlay */}
              <div ref={viewerRef} style={{ flex: 1, overflow: 'auto', borderRadius: 14, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {pdfData && (
                    <Document
                      file={pdfData}
                      onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPageNumber(p => Math.min(p, n)) }}
                      onLoadError={err => console.error(err)}
                      loading={<Spinner />}
                      error={<ErrBox />}
                    >
                      {/* position:relative + inline-block so it shrink-wraps the page */}
                      <div
                        ref={pageContainerRef}
                        style={{ position: 'relative', display: 'inline-block', lineHeight: 0, background: 'white', boxShadow: '0 8px 40px rgba(0,0,0,0.6)', borderRadius: 2 }}
                      >
                        <Page
                          pageNumber={pageNumber}
                          scale={scale}
                          renderTextLayer
                          renderAnnotationLayer
                          loading={<Spinner />}
                          onRenderSuccess={() => {
                            const c = pageContainerRef.current?.querySelector<HTMLCanvasElement>('canvas.react-pdf__Page__canvas')
                            if (c && c.offsetWidth > 0) setCanvasDims({ w: c.offsetWidth, h: c.offsetHeight })
                          }}
                        />

                        {/* Annotation canvas — sits on top, same pixel size as PDF canvas */}
                        <canvas
                          ref={overlayRef}
                          width={canvasDims?.w ?? 1}
                          height={canvasDims?.h ?? 1}
                          style={canvasDims ? {
                            position: 'absolute', top: 0, left: 0,
                            width: canvasDims.w, height: canvasDims.h,
                            cursor: cursorFor[tool],
                            zIndex: 1000,
                            pointerEvents: tool === 'select' ? 'none' : 'all',
                          } : { display: 'none' }}
                          onMouseDown={onMouseDown}
                          onMouseMove={onMouseMove}
                          onMouseUp={onMouseUp}
                          onMouseLeave={onMouseUp}
                        />

                        {/* Floating text input */}
                        {textTarget && (
                          <div style={{ position: 'absolute', top: textTarget.y, left: textTarget.x, zIndex: 20 }}>
                            <input
                              ref={textInputRef}
                              value={textVal}
                              onChange={e => setTextVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') { setTextTarget(null); setTextVal('') } }}
                              onBlur={commitText}
                              placeholder="Type here…"
                              style={{ background: 'rgba(255,255,200,0.95)', border: '1.5px solid #FACC15', borderRadius: 4, padding: '2px 6px', fontSize: 14, color: '#000', minWidth: 100, outline: 'none' }}
                            />
                          </div>
                        )}
                      </div>
                    </Document>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Small shared components ──────────────────────────────────────────────────

function TBtn({ onClick, disabled, active, title, children }: {
  onClick: () => void; disabled?: boolean; active?: boolean; title?: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: disabled ? 'default' : 'pointer',
        background: active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)',
        border: `1px solid ${active ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}`,
        color: disabled ? 'var(--text-muted)' : active ? '#a5b4fc' : 'var(--text-secondary)',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
      onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.07)' }}
    >
      {children}
    </button>
  )
}

function ToolBarBtn({ onClick, accent, children }: { onClick: () => void; accent?: boolean; children: React.ReactNode }) {
  return (
    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, background: accent ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.08)', border: `1px solid ${accent ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.15)'}`, color: accent ? '#a5b4fc' : 'var(--text-secondary)' }}>
      {children}
    </motion.button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0 }} />
}

function Spinner() {
  return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13 }}>
      <div style={{ width: 16, height: 16, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      Loading…
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function ErrBox() {
  return <div style={{ padding: 32, color: '#ef4444', fontSize: 13, textAlign: 'center' }}>Could not load PDF</div>
}
