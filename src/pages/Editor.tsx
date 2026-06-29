import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import { addRecentFile } from '../utils/recentFiles'
import { askAI, hasAIConfigured, truncateForContext, type AIMessage } from '../utils/ai'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  ArrowLeft, Upload, FileText, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Maximize2, X, Save, RotateCw, Trash2,
  MousePointer, Highlighter, PenLine, Type, Eraser,
  Search, ChevronUp, ChevronDown, Crop, LayoutGrid, FilePlus, CheckSquare,
  BookOpen, MessageSquare, Layers, EyeOff, Lock,
  ClipboardList, Circle, ScanText, Info, Layers2, ImageDown,
  Printer, Replace, HelpCircle, FilePlus2, Scissors,
  Sparkles, Send, Loader2, RotateCcw, Languages, UserCheck, Settings,
} from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

type Tool = 'select' | 'highlight' | 'draw' | 'text' | 'erase' | 'crop' | 'redact' | 'formfield'
interface Reply { id: string; content: string; ts: number }
type AnnotShape =
  | { type: 'highlight'; x: number; y: number; w: number; h: number; color: string; replies?: Reply[] }
  | { type: 'draw'; pts: [number, number][]; color: string; lw: number; replies?: Reply[] }
  | { type: 'text'; x: number; y: number; content: string; color: string; replies?: Reply[] }
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
  const [annotations, _setAnnotations] = useState<Map<number, Annot[]>>(new Map())
  const annotationsRef = useRef<Map<number, Annot[]>>(new Map())
  const annotHistoryRef = useRef<Map<number, Annot[]>[]>([new Map()])
  const historyIdxRef = useRef(0)
  const wasErasingRef = useRef(false)
  const setAnnotations = (m: Map<number, Annot[]>) => { annotationsRef.current = m; _setAnnotations(m) }
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

  // Page management
  const [leftTab, setLeftTab] = useState<'files' | 'pages' | 'outline' | 'comments' | 'forms' | 'ai'>('files')
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set())
  const [dragPage, setDragPage] = useState<number | null>(null)
  const [dragOverPage, setDragOverPage] = useState<number | null>(null)
  const [pendingCrop, setPendingCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // Working copy — page ops write here; original never touched until Save
  const [workingFile, setWorkingFile] = useState<string | null>(null)
  const workingFileRef = useRef<string | null>(null)

  // Content Tools modal
  const [showContentTools, setShowContentTools] = useState(false)
  // Permissions modal
  const [showPermissions, setShowPermissions] = useState(false)
  // Pending redaction rectangles (canvas coords, per page)
  const [pendingRedacts, setPendingRedacts] = useState<{ page: number; x: number; y: number; w: number; h: number }[]>([])
  // Form field creation
  const [formFieldType, setFormFieldType] = useState<'text' | 'checkbox' | 'dropdown' | 'radio'>('text')
  const [pendingFormField, setPendingFormField] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [formFieldConfig, setFormFieldConfig] = useState({ name: '', choices: '', value: '' })
  const [formsReloadKey, setFormsReloadKey] = useState(0)
  const [showOcr, setShowOcr] = useState(false)
  const [showMetadata, setShowMetadata] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [replaceQuery, setReplaceQuery] = useState('')
  const [findReplaceCount, setFindReplaceCount] = useState<number | null>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  // AI
  const [aiDocText, setAiDocText] = useState('')
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiClassification, setAiClassification] = useState<string | null>(null)
  const aiChatEndRef = useRef<HTMLDivElement>(null)

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

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault(); setSearchOpen(true); setReplaceOpen(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault(); setSearchOpen(true); setReplaceOpen(true)
        setTimeout(() => replaceInputRef.current?.focus(), 40)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); save()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault(); window.electronAPI?.print()
      }
      if (e.key === '?' && !e.ctrlKey) {
        setShowShortcuts(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); undoAnnot()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); redoAnnot()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (dragRect && tool === 'highlight') {
      ctx.fillStyle = color + HIGHLIGHT_ALPHA
      ctx.fillRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h)
    }
    if (dragRect && tool === 'crop') {
      ctx.strokeStyle = 'rgba(99,102,241,0.9)'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h)
      ctx.fillStyle = 'rgba(99,102,241,0.08)'
      ctx.fillRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h)
      ctx.setLineDash([])
    }
    if (pendingCrop && tool === 'crop') {
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(pendingCrop.x, pendingCrop.y, pendingCrop.w, pendingCrop.h)
      ctx.setLineDash([])
    }
    // Committed redaction boxes for this page (solid black, permanent-looking)
    const pageRedacts = pendingRedacts.filter(r => r.page === pageNumber)
    for (const r of pageRedacts) {
      ctx.fillStyle = '#000'
      ctx.fillRect(r.x, r.y, r.w, r.h)
      const fs = Math.max(8, Math.min(12, r.h * 0.35))
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = `700 ${fs}px Inter, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('REDACTED', r.x + r.w / 2, r.y + r.h / 2)
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    }
    // Live redact drag preview
    if (dragRect && tool === 'redact') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 3])
      ctx.strokeRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h)
      ctx.setLineDash([])
    }
    // Form field placement preview
    if (dragRect && tool === 'formfield') {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 3])
      ctx.strokeRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h)
      ctx.fillStyle = 'rgba(59,130,246,0.08)'
      ctx.fillRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h)
      ctx.setLineDash([])
    }
    if (pendingFormField && tool === 'formfield') {
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.strokeRect(pendingFormField.x, pendingFormField.y, pendingFormField.w, pendingFormField.h)
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
  }, [annotations, pageNumber, canvasDims, dragRect, currentPath, tool, color, lineWidth, allMatches, matchIdx, scale, pendingCrop, pendingRedacts, pendingFormField, formFieldType])

  // Focus text input when it appears
  useEffect(() => {
    if (textTarget) setTimeout(() => textInputRef.current?.focus(), 30)
  }, [textTarget])

  // Auto-scroll AI chat to bottom
  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages])

  // Auto-classify document when a new file is opened
  useEffect(() => {
    if (!activeFile) { setAiClassification(null); setAiDocText(''); setAiMessages([]); return }
    setAiDocText('')
    setAiMessages([])
    setAiClassification(null)
    if (hasAIConfigured()) {
      runClassify()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile])

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
      .map(f => window.electronAPI!.getPathForFile(f))
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
    cleanupWorkingFile()
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

  // ── Page management ─────────────────────────────────────────────────────────

  // Reload viewer from working copy (if any), else from original
  const reloadPdf = async () => {
    const path = workingFileRef.current ?? activeFile
    if (!path) return
    const data = await window.electronAPI?.readFile(path)
    if (data) setPdfData(data)
  }

  // Create a temp copy of the original on first page edit; return its path
  const ensureWorkingCopy = async (): Promise<string | null> => {
    if (workingFileRef.current) return workingFileRef.current
    if (!activeFile) return null
    const tmp = await window.electronAPI?.makeTempCopy(activeFile)
    if (!tmp) return null
    workingFileRef.current = tmp
    setWorkingFile(tmp)
    return tmp
  }

  // Delete temp file and reset working-copy state
  const cleanupWorkingFile = () => {
    const wf = workingFileRef.current
    workingFileRef.current = null
    setWorkingFile(null)
    if (wf) window.electronAPI?.deleteTempFile(wf)
  }

  // Discard all page changes and reload the original
  const discardChanges = async () => {
    cleanupWorkingFile()
    if (activeFile) {
      const data = await window.electronAPI?.readFile(activeFile)
      if (data) setPdfData(data)
    }
  }

  // Run a content-tools command on the working copy then reload
  const runContentOp = async (cmd: string, args: object) => {
    const wf = await ensureWorkingCopy()
    if (!wf) return
    await window.electronAPI?.pdfCommand(cmd, { input: wf, output: wf, ...args })
    await reloadPdf()
    setShowContentTools(false)
  }

  const reorderPagesAction = async (fromPage: number, toPage: number) => {
    if (!activeFile || fromPage === toPage) return
    const wf = await ensureWorkingCopy()
    if (!wf) return
    const order = Array.from({ length: numPages }, (_, i) => i)
    order.splice(fromPage - 1, 1)
    order.splice(toPage - 1, 0, fromPage - 1)
    await window.electronAPI?.pdfCommand('reorder_pages', { input: wf, output: wf, order })
    await reloadPdf()
    setDragPage(null); setDragOverPage(null)
  }

  const extractSelectedPages = async () => {
    if (!activeFile || selectedPages.size === 0) return
    const out = await window.electronAPI?.savePath('pdf')
    if (!out) return
    const src = workingFileRef.current ?? activeFile
    const pages = [...selectedPages].sort((a, b) => a - b).map(p => p - 1)
    await window.electronAPI?.pdfCommand('extract_pages', { input: src, output: out, pages })
    window.electronAPI?.showItem(out)
    setSelectedPages(new Set())
  }

  const insertPagesAction = async () => {
    if (!activeFile) return
    const paths = await window.electronAPI?.openPDF()
    if (!paths?.[0]) return
    const wf = await ensureWorkingCopy()
    if (!wf) return
    try {
      await window.electronAPI?.pdfCommand('insert_pages', {
        input: wf, output: wf, source: paths[0], position: pageNumber,
      })
      await reloadPdf()
    } catch (err) {
      console.error('insert_pages failed:', err)
      alert(`Insert failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const applyCrop = async () => {
    if (!pendingCrop || !activeFile) return
    const wf = await ensureWorkingCopy()
    if (!wf) return
    // PyMuPDF uses top-left origin (Y down) — same as canvas, no Y-flip needed
    const x0 = pendingCrop.x / scale
    const y0 = pendingCrop.y / scale
    const x1 = (pendingCrop.x + pendingCrop.w) / scale
    const y1 = (pendingCrop.y + pendingCrop.h) / scale
    await window.electronAPI?.pdfCommand('crop_page', {
      input: wf, output: wf, page: pageNumber - 1, rect: [x0, y0, x1, y1],
    })
    setPendingCrop(null)
    await reloadPdf()
  }

  const applyRedactions = async () => {
    if (!pendingRedacts.length || !activeFile) return
    const wf = await ensureWorkingCopy()
    if (!wf) return
    const byPage = new Map<number, { x0: number; y0: number; x1: number; y1: number }[]>()
    for (const r of pendingRedacts) {
      const p = r.page - 1
      if (!byPage.has(p)) byPage.set(p, [])
      byPage.get(p)!.push({ x0: r.x / scale, y0: r.y / scale, x1: (r.x + r.w) / scale, y1: (r.y + r.h) / scale })
    }
    for (const [page, rects] of byPage.entries()) {
      await window.electronAPI?.pdfCommand('redact_areas', { input: wf, output: wf, page, rects })
    }
    setPendingRedacts([])
    setTool('select')
    await reloadPdf()
  }

  const applyPermissions = async (args: object) => {
    const src = workingFileRef.current ?? activeFile
    if (!src) return
    const out = await window.electronAPI?.savePath('pdf')
    if (!out) return
    await window.electronAPI?.pdfCommand('set_permissions', { input: src, output: out, ...args })
    window.electronAPI?.showItem(out)
    setShowPermissions(false)
  }

  const applyFormFields = async (fields: Record<string, string>) => {
    const wf = await ensureWorkingCopy()
    if (!wf) return
    await window.electronAPI?.pdfCommand('fill_form_fields', { input: wf, output: wf, fields })
    setFormsReloadKey(k => k + 1)
    await reloadPdf()
  }

  const exportFormData = async (format: 'json' | 'csv') => {
    const src = workingFileRef.current ?? activeFile
    if (!src) return
    const out = await window.electronAPI?.savePath(format)
    if (!out) return
    await window.electronAPI?.pdfCommand('export_form_data', { input: src, output: out, format })
    window.electronAPI?.showItem(out)
  }

  const importFormData = async () => {
    const paths = await window.electronAPI?.openFiles([{ name: 'Form Data', extensions: ['json', 'csv'] }], false)
    if (!paths?.[0]) return
    const wf = await ensureWorkingCopy()
    if (!wf) return
    await window.electronAPI?.pdfCommand('import_form_data', { input: wf, output: wf, source: paths[0] })
    setFormsReloadKey(k => k + 1)
    await reloadPdf()
  }

  const runOcr = async (lang: string, dpi: number) => {
    const wf = await ensureWorkingCopy()
    if (!wf) return
    await window.electronAPI?.pdfCommand('ocr_pdf', { input: wf, output: wf, lang, dpi })
    await reloadPdf()
    setShowOcr(false)
  }

  const runFlatten = async () => {
    if (!activeFile || !window.confirm('Flatten PDF? Annotations will be baked into the page permanently and the text layer will be lost.')) return
    const wf = await ensureWorkingCopy()
    if (!wf) return
    await window.electronAPI?.pdfCommand('flatten_pdf', { input: wf, output: wf })
    await reloadPdf()
  }

  const runInsertBlankPage = async () => {
    if (!activeFile) return
    const wf = await ensureWorkingCopy()
    if (!wf) return
    await window.electronAPI?.pdfCommand('insert_blank_page', { input: wf, output: wf, position: pageNumber })
    await reloadPdf()
    goTo(pageNumber + 1)
  }

  const runExtractImages = async () => {
    const src = workingFileRef.current ?? activeFile
    if (!src) return
    const outDir = await window.electronAPI?.selectDir()
    if (!outDir) return
    const res = await window.electronAPI?.pdfCommand('extract_images', { input: src, output: outDir }) as { count: number }
    if (res.count === 0) alert('No embedded images found in this PDF.')
    else window.electronAPI?.showItem(outDir)
  }

  const runFindReplace = async () => {
    if (!searchQuery.trim()) return
    const wf = await ensureWorkingCopy()
    if (!wf) return
    setFindReplaceCount(null)
    const res = await window.electronAPI?.pdfCommand('find_replace_text', { input: wf, output: wf, find: searchQuery, replace: replaceQuery }) as { replaced: number }
    setFindReplaceCount(res.replaced)
    await reloadPdf()
    if (res.replaced === 0) alert(`"${searchQuery}" was not found in this PDF.`)
  }

  const runSplitByBookmarks = async () => {
    const src = workingFileRef.current ?? activeFile
    if (!src) return
    const outDir = await window.electronAPI?.selectDir()
    if (!outDir) return
    try {
      const res = await window.electronAPI?.pdfCommand('split_by_bookmarks', { input: src, output: outDir }) as { count: number; files: string[] }
      window.electronAPI?.showItem(res.files[0])
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    }
  }

  // ── AI helpers ───────────────────────────────────────────────────────────────

  const getDocText = async (): Promise<string> => {
    if (aiDocText) return aiDocText
    const src = workingFileRef.current ?? activeFile
    if (!src) throw new Error('No PDF open.')
    const res = await window.electronAPI?.pdfCommand('extract_text_full', { input: src }) as { full_text: string }
    setAiDocText(res.full_text)
    return res.full_text
  }

  const runSummarise = async () => {
    if (!activeFile) return
    if (!hasAIConfigured()) { alert('No AI provider configured. Open Settings to add an API key.'); return }
    setLeftTab('ai')
    setAiLoading(true)
    setAiError(null)
    try {
      const text = await getDocText()
      const prompt = `Summarise the following PDF document in clear, concise bullet points. Group by topic where relevant.\n\n${truncateForContext(text)}`
      const newMessages: AIMessage[] = [{ role: 'user', content: 'Summarise this document' }]
      setAiMessages(newMessages)
      const reply = await askAI(newMessages, `You are a helpful PDF assistant. The document text is:\n\n${truncateForContext(text)}`)
      setAiMessages([...newMessages, { role: 'assistant', content: reply }])
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiLoading(false)
    }
  }

  const runClassify = async () => {
    if (!activeFile) return
    if (!hasAIConfigured()) { alert('No AI provider configured. Open Settings to add an API key.'); return }
    try {
      const text = await getDocText()
      const reply = await askAI(
        [{ role: 'user', content: 'What type of document is this? Reply with ONLY a short label (2-4 words), e.g. "Legal Contract", "Financial Report", "Invoice", "Technical Manual", "CV / Resume". No explanation.' }],
        `Document text (first 4000 chars):\n\n${text.slice(0, 4000)}`
      )
      setAiClassification(reply.trim().replace(/[".]/g, ''))
    } catch { /* silent */ }
  }

  const runSmartRedact = async () => {
    if (!activeFile) return
    if (!hasAIConfigured()) { alert('No AI provider configured. Open Settings to add an API key.'); return }
    setLeftTab('ai')
    setAiLoading(true)
    setAiError(null)
    try {
      const text = await getDocText()
      const sys = `You are a data privacy assistant. Identify all personally identifiable information (PII) in the document text. Return ONLY a JSON array of strings — the exact text strings that should be redacted. Include: full names, email addresses, phone numbers, physical addresses, national insurance / SSN numbers, dates of birth, bank account / card numbers, passport / driving licence numbers. No explanation, no markdown — just the JSON array.`
      const reply = await askAI([{ role: 'user', content: truncateForContext(text, 30000) }], sys)
      let items: string[] = []
      try { items = JSON.parse(reply.trim()) } catch { items = [] }
      if (!items.length) {
        setAiMessages(m => [...m, { role: 'assistant', content: 'No PII detected in this document.' }])
        return
      }
      setAiMessages(m => [...m, { role: 'assistant', content: `Found ${items.length} PII item(s) to redact:\n${items.map(s => `• ${s}`).join('\n')}\n\nSwitch to the Redact tool and these will be highlighted.` }])
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiLoading(false)
    }
  }

  const runTranslate = async () => {
    if (!activeFile) return
    if (!hasAIConfigured()) { alert('No AI provider configured. Open Settings to add an API key.'); return }
    const lang = window.prompt('Translate to (e.g. French, Spanish, German, Japanese):')
    if (!lang?.trim()) return
    setLeftTab('ai')
    setAiLoading(true)
    setAiError(null)
    try {
      const text = await getDocText()
      const newMessages: AIMessage[] = [{ role: 'user', content: `Translate the document into ${lang}` }]
      setAiMessages(newMessages)
      const reply = await askAI(newMessages, `Translate the following PDF document text into ${lang}. Preserve structure and paragraph breaks.\n\n${truncateForContext(text)}`)
      setAiMessages([...newMessages, { role: 'assistant', content: reply }])
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiLoading(false)
    }
  }

  const sendAIMessage = async () => {
    const content = aiInput.trim()
    if (!content || aiLoading) return
    if (!hasAIConfigured()) { alert('No AI provider configured. Open Settings to add an API key.'); return }
    setAiInput('')
    setAiError(null)
    const updated: AIMessage[] = [...aiMessages, { role: 'user', content }]
    setAiMessages(updated)
    setAiLoading(true)
    try {
      const text = aiDocText || await getDocText()
      const reply = await askAI(updated, `You are a helpful PDF assistant. Answer questions about the document. Document text:\n\n${truncateForContext(text)}`)
      setAiMessages(m => [...m, { role: 'assistant', content: reply }])
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e))
    } finally {
      setAiLoading(false)
    }
  }

  const addFormField = async () => {
    if (!pendingFormField || !activeFile || !formFieldConfig.name.trim()) return
    const wf = await ensureWorkingCopy()
    if (!wf) return
    const rect = [pendingFormField.x / scale, pendingFormField.y / scale, (pendingFormField.x + pendingFormField.w) / scale, (pendingFormField.y + pendingFormField.h) / scale]
    const choices = formFieldConfig.choices.split('\n').map(s => s.trim()).filter(Boolean)
    await window.electronAPI?.pdfCommand('add_form_field', {
      input: wf, output: wf, page: pageNumber - 1,
      field_type: formFieldType, name: formFieldConfig.name.trim(),
      rect, value: formFieldConfig.value,
      ...(choices.length > 0 ? { choices } : {}),
    })
    setPendingFormField(null)
    setFormsReloadKey(k => k + 1)
    await reloadPdf()
  }

  const togglePageSelect = (p: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev)
      next.has(p) ? next.delete(p) : next.add(p)
      return next
    })
  }
  const fitWidth = () => {
    if (viewerRef.current) setScale((viewerRef.current.clientWidth - 80) / 595)
  }

  // ── Annotation helpers ──────────────────────────────────────────────────────
  const uid = () => Math.random().toString(36).slice(2)

  const commitToHistory = (newMap: Map<number, Annot[]>) => {
    annotHistoryRef.current = annotHistoryRef.current.slice(0, historyIdxRef.current + 1)
    annotHistoryRef.current.push(new Map([...newMap].map(([k, v]) => [k, v.map(a => ({ ...a }))])))
    historyIdxRef.current = annotHistoryRef.current.length - 1
    setAnnotations(newMap)
  }
  const undoAnnot = () => {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current--
    setAnnotations(new Map([...annotHistoryRef.current[historyIdxRef.current]].map(([k, v]) => [k, v.map(a => ({ ...a }))])))
  }
  const redoAnnot = () => {
    if (historyIdxRef.current >= annotHistoryRef.current.length - 1) return
    historyIdxRef.current++
    setAnnotations(new Map([...annotHistoryRef.current[historyIdxRef.current]].map(([k, v]) => [k, v.map(a => ({ ...a }))])))
  }
  const addReply = (annotId: string, content: string) => {
    if (!content.trim()) return
    const next = new Map(annotationsRef.current)
    for (const [pg, annots] of next.entries()) {
      const idx = annots.findIndex(a => a.id === annotId)
      if (idx !== -1) {
        const updated = { ...annots[idx], replies: [...(annots[idx].replies ?? []), { id: uid(), content: content.trim(), ts: Date.now() }] }
        next.set(pg, [...annots.slice(0, idx), updated as Annot, ...annots.slice(idx + 1)])
        commitToHistory(next)
        break
      }
    }
  }

  const relPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = overlayRef.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as [number, number]
  }

  const addAnnot = (a: AnnotShape) => {
    const next = new Map(annotationsRef.current)
    const existing = next.get(pageNumber) ?? []
    next.set(pageNumber, [...existing, { ...a, id: uid(), page: pageNumber } as Annot])
    commitToHistory(next)
  }

  const eraseAt = (x: number, y: number) => {
    const next = new Map(annotationsRef.current)
    const existing = next.get(pageNumber) ?? []
    next.set(pageNumber, existing.filter(a => {
      if (a.type === 'highlight') return !(x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h)
      if (a.type === 'text') return !(x >= a.x && x <= a.x + 120 && y >= a.y && y <= a.y + 20)
      if (a.type === 'draw') return !a.pts.some(([px, py]) => Math.hypot(px - x, py - y) < 12)
      return true
    }))
    setAnnotations(next)
  }

  // ── Canvas mouse events ─────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'select') return
    const [x, y] = relPos(e)

    if (tool === 'text') { setTextTarget({ x, y }); setTextVal(''); return }
    if (tool === 'erase') { wasErasingRef.current = true; eraseAt(x, y); return }
    if (tool === 'highlight') { setDragRect({ x, y, w: 0, h: 0 }); setDrawing(true); return }
    if (tool === 'draw') { setCurrentPath([[x, y]]); setDrawing(true); return }
    if (tool === 'crop') { setPendingCrop(null); setDragRect({ x, y, w: 0, h: 0 }); setDrawing(true); return }
    if (tool === 'redact') { setDragRect({ x, y, w: 0, h: 0 }); setDrawing(true); return }
    if (tool === 'formfield') { setPendingFormField(null); setDragRect({ x, y, w: 0, h: 0 }); setDrawing(true); return }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    const [x, y] = relPos(e)
    if ((tool === 'highlight' || tool === 'crop' || tool === 'redact' || tool === 'formfield') && dragRect) {
      setDragRect({ x: dragRect.x, y: dragRect.y, w: x - dragRect.x, h: y - dragRect.y })
    }
    if (tool === 'draw') {
      setCurrentPath(prev => [...prev, [x, y]])
    }
    if (tool === 'erase') eraseAt(x, y)
  }

  const onMouseUp = () => {
    if (wasErasingRef.current) {
      commitToHistory(annotationsRef.current)
      wasErasingRef.current = false
    }
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
    if (tool === 'crop' && dragRect && Math.abs(dragRect.w) > 10 && Math.abs(dragRect.h) > 10) {
      const x = dragRect.w < 0 ? dragRect.x + dragRect.w : dragRect.x
      const y = dragRect.h < 0 ? dragRect.y + dragRect.h : dragRect.y
      setPendingCrop({ x, y, w: Math.abs(dragRect.w), h: Math.abs(dragRect.h) })
    }
    if (tool === 'redact' && dragRect && Math.abs(dragRect.w) > 10 && Math.abs(dragRect.h) > 10) {
      const x = dragRect.w < 0 ? dragRect.x + dragRect.w : dragRect.x
      const y = dragRect.h < 0 ? dragRect.y + dragRect.h : dragRect.y
      setPendingRedacts(prev => [...prev, { page: pageNumber, x, y, w: Math.abs(dragRect.w), h: Math.abs(dragRect.h) }])
    }
    if (tool === 'formfield' && dragRect && Math.abs(dragRect.w) > 10 && Math.abs(dragRect.h) > 10) {
      const x = dragRect.w < 0 ? dragRect.x + dragRect.w : dragRect.x
      const y = dragRect.h < 0 ? dragRect.y + dragRect.h : dragRect.y
      setPendingFormField({ x, y, w: Math.abs(dragRect.w), h: Math.abs(dragRect.h) })
      setFormFieldConfig({ name: '', choices: '', value: '' })
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
    const wf = await ensureWorkingCopy()
    if (!wf) return
    await window.electronAPI?.pdfCommand('rotate_page', {
      input: wf, output: wf, page: pageNumber - 1, angle: dir === 'cw' ? 90 : -90,
    })
    await reloadPdf()
  }

  const deletePage = async () => {
    if (!activeFile || numPages <= 1) return
    const wf = await ensureWorkingCopy()
    if (!wf) return
    await window.electronAPI?.pdfCommand('delete_page', {
      input: wf, output: wf, page: pageNumber - 1,
    })
    await reloadPdf()
    goTo(Math.min(pageNumber, numPages - 1))
  }

  // ── Save with annotations ───────────────────────────────────────────────────
  const save = async () => {
    const sourceFile = workingFileRef.current ?? activeFile
    if (!sourceFile || !canvasDims) return
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
        input: sourceFile, output: outPath, annotations: annotList,
      })
      setSaveStatus('done')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (err) {
      console.error(err); setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const cursorFor: Record<Tool, string> = {
    select: 'default', highlight: 'crosshair', draw: 'crosshair', text: 'text', erase: 'cell', crop: 'crosshair', redact: 'crosshair', formfield: 'crosshair',
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
          <>
            <ToolBarBtn onClick={() => window.electronAPI?.print()} title="Print (Ctrl+P)"><Printer size={13} /></ToolBarBtn>
          </>
        )}
        <ToolBarBtn onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)"><HelpCircle size={13} /></ToolBarBtn>
        <ToolBarBtn onClick={() => navigate('/settings')} title="Settings"><Settings size={13} /></ToolBarBtn>
        {activeFile && (
          <>
            {workingFile && (
              <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                ● Unsaved page changes
              </span>
            )}
            {workingFile && (
              <ToolBarBtn onClick={discardChanges}>
                <X size={12} /> Discard
              </ToolBarBtn>
            )}
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
          </>
        )}
      </div>

      {/* Content Tools modal */}
      <AnimatePresence>
        {showContentTools && activeFile && (
          <ContentToolsModal onClose={() => setShowContentTools(false)} onApply={runContentOp} />
        )}
      </AnimatePresence>

      {/* Permissions modal */}
      <AnimatePresence>
        {showPermissions && activeFile && (
          <PermissionsModal onClose={() => setShowPermissions(false)} onApply={applyPermissions} />
        )}
      </AnimatePresence>

      {/* OCR modal */}
      <AnimatePresence>
        {showOcr && activeFile && (
          <OcrModal onClose={() => setShowOcr(false)} onRun={runOcr} />
        )}
      </AnimatePresence>

      {/* Metadata modal */}
      <AnimatePresence>
        {showMetadata && activeFile && (
          <MetadataModal
            sourceFile={workingFileRef.current ?? activeFile}
            onClose={() => setShowMetadata(false)}
            onApply={async (meta) => {
              const wf = await ensureWorkingCopy()
              if (!wf) return
              await window.electronAPI?.pdfCommand('set_metadata', { input: wf, output: wf, metadata: meta })
              setShowMetadata(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* Shortcuts modal */}
      <AnimatePresence>
        {showShortcuts && (
          <ShortcutsModal onClose={() => setShowShortcuts(false)} />
        )}
      </AnimatePresence>

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

            {/* Left: 4-tab panel */}
            <div className="glass" style={{ width: 190, borderRadius: 14, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
              {/* Icon-only tab bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                {([
                  { id: 'files',    icon: <FileText size={13} />,      label: 'Files' },
                  { id: 'pages',    icon: <LayoutGrid size={13} />,    label: 'Pages' },
                  { id: 'outline',  icon: <BookOpen size={13} />,      label: 'Outline' },
                  { id: 'comments', icon: <MessageSquare size={13} />,  label: 'Comments' },
                  { id: 'forms',    icon: <ClipboardList size={13} />,  label: 'Forms' },
                  { id: 'ai',       icon: <Sparkles size={13} />,       label: 'AI Chat' },
                ] as { id: typeof leftTab; icon: React.ReactNode; label: string }[]).map(({ id, icon, label }) => (
                  <button key={id} onClick={() => setLeftTab(id)} title={label} style={{ flex: 1, padding: '9px 0', background: 'none', border: 'none', borderBottom: leftTab === id ? '2px solid #6366f1' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: leftTab === id ? '#a5b4fc' : 'var(--text-muted)', transition: 'color 0.12s' }}>
                    {icon}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {leftTab === 'files' && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
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
                )}
                {leftTab === 'pages' && (
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '6px 6px' }}>
                    <ThumbnailPanel
                      pdfData={pdfData}
                      numPages={numPages}
                      pageNumber={pageNumber}
                      onPageClick={p => { setPageNumber(p); setPendingCrop(null) }}
                      selectedPages={selectedPages}
                      onToggleSelect={togglePageSelect}
                      dragPage={dragPage}
                      onDragPage={setDragPage}
                      dragOverPage={dragOverPage}
                      onDragOverPage={setDragOverPage}
                      onReorder={reorderPagesAction}
                      onExtract={extractSelectedPages}
                      onInsert={insertPagesAction}
                    />
                  </div>
                )}
                {leftTab === 'outline' && (
                  <OutlinePanel sourceFile={activeFile} onPageClick={goTo} onSplitByBookmarks={runSplitByBookmarks} />
                )}
                {leftTab === 'comments' && (
                  <CommentsPanel annotations={annotations} pageNumber={pageNumber} onPageClick={goTo} onAddReply={addReply} />
                )}
                {leftTab === 'forms' && (
                  <FormsPanel
                    sourceFile={activeFile}
                    workingFile={workingFile}
                    reloadKey={formsReloadKey}
                    onApply={applyFormFields}
                    onExport={exportFormData}
                    onImport={importFormData}
                  />
                )}
                {leftTab === 'ai' && (
                  <AIChatPanel
                    messages={aiMessages}
                    input={aiInput}
                    loading={aiLoading}
                    error={aiError}
                    hasFile={!!activeFile}
                    classification={aiClassification}
                    chatEndRef={aiChatEndRef}
                    onInputChange={setAiInput}
                    onSend={sendAIMessage}
                    onClear={() => { setAiMessages([]); setAiError(null) }}
                  />
                )}
              </div>
            </div>

            {/* Centre: toolbar + viewer */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>

              {/* Toolbar row — navigation & zoom only; editing tools are in the right sidebar */}
              <div style={{ borderRadius: 10, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <TBtn onClick={() => goTo(pageNumber - 1)} disabled={pageNumber <= 1}><ChevronLeft size={13} /></TBtn>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 60, textAlign: 'center' }}>
                  {numPages > 0 ? `${pageNumber} / ${numPages}` : '—'}
                </span>
                <TBtn onClick={() => goTo(pageNumber + 1)} disabled={pageNumber >= numPages}><ChevronRight size={13} /></TBtn>
                <Sep />
                <TBtn onClick={() => zoom(-0.1)}><ZoomOut size={13} /></TBtn>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 38, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
                <TBtn onClick={() => zoom(0.1)}><ZoomIn size={13} /></TBtn>
                <TBtn onClick={fitWidth} title="Fit to width"><Maximize2 size={12} /></TBtn>
                <Sep />
                <TBtn onClick={() => setSearchOpen(o => !o)} active={searchOpen} title="Search (Ctrl+F)">
                  <Search size={13} />
                  {allMatches.length > 0 && <span style={{ fontSize: 10 }}>{allMatches.length}</span>}
                </TBtn>
              </div>

              {/* Search bar */}
              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    style={{ display: 'flex', flexDirection: 'column', padding: '7px 12px', borderRadius: 10, background: 'rgba(15,12,41,0.92)', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                      <TBtn onClick={() => setReplaceOpen(o => !o)} active={replaceOpen} title="Find & Replace (Ctrl+H)"><Replace size={13} /></TBtn>
                      <TBtn onClick={() => { setSearchOpen(false); setSearchQuery(''); setReplaceOpen(false); setFindReplaceCount(null) }} title="Close (Esc)"><X size={13} /></TBtn>
                    </div>

                    {/* Replace row */}
                    {replaceOpen && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6 }}>
                        <Replace size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        <input
                          ref={replaceInputRef}
                          value={replaceQuery}
                          onChange={e => { setReplaceQuery(e.target.value); setFindReplaceCount(null) }}
                          onKeyDown={e => { if (e.key === 'Enter') runFindReplace() }}
                          placeholder="Replace with…"
                          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 14, outline: 'none', flex: 1, minWidth: 140 }}
                        />
                        {findReplaceCount !== null && (
                          <span style={{ fontSize: 12, color: findReplaceCount > 0 ? '#34d399' : 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {findReplaceCount > 0 ? `${findReplaceCount} replaced` : 'Not found'}
                          </span>
                        )}
                        <button onClick={runFindReplace} disabled={!searchQuery.trim() || !activeFile}
                          style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: searchQuery.trim() ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)', color: searchQuery.trim() ? '#a5b4fc' : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: searchQuery.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                          Replace All
                        </button>
                      </div>
                    )}
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
                          <div style={{ position: 'absolute', top: textTarget.y, left: textTarget.x, zIndex: 1100 }}>
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

                        {/* Form field config popup */}
                        {pendingFormField && tool === 'formfield' && (
                          <div style={{
                            position: 'absolute',
                            top: Math.min(pendingFormField.y + pendingFormField.h + 8, (canvasDims?.h ?? 0) - 200),
                            left: Math.max(pendingFormField.x, 0),
                            zIndex: 1100, background: 'rgba(10,8,30,0.97)',
                            border: '1px solid rgba(59,130,246,0.4)', borderRadius: 10, padding: 12,
                            display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200,
                          }}>
                            <input autoFocus placeholder="Field name (required)" value={formFieldConfig.name}
                              onChange={e => setFormFieldConfig(c => ({ ...c, name: e.target.value }))}
                              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
                            {(formFieldType === 'dropdown' || formFieldType === 'radio') && (
                              <textarea placeholder="Options (one per line)" value={formFieldConfig.choices}
                                onChange={e => setFormFieldConfig(c => ({ ...c, choices: e.target.value }))}
                                rows={3} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)', fontSize: 12, outline: 'none', resize: 'vertical' }} />
                            )}
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button onClick={addFormField} disabled={!formFieldConfig.name.trim()}
                                style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.5)', background: formFieldConfig.name.trim() ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.1)', color: formFieldConfig.name.trim() ? '#93c5fd' : 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: formFieldConfig.name.trim() ? 'pointer' : 'default' }}>
                                Add Field
                              </button>
                              <button onClick={() => setPendingFormField(null)}
                                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
                                <X size={10} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Redact confirm overlay — shows whenever there are pending redacts */}
                        {pendingRedacts.length > 0 && (
                          <div style={{
                            position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                            zIndex: 1100, display: 'flex', gap: 5,
                            background: 'rgba(10,8,30,0.94)', border: '1px solid rgba(239,68,68,0.35)',
                            borderRadius: 8, padding: '5px 8px', whiteSpace: 'nowrap',
                          }}>
                            <button onClick={applyRedactions} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.18)', color: '#fca5a5', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                              <EyeOff size={10} /> Apply {pendingRedacts.length} Redaction{pendingRedacts.length !== 1 ? 's' : ''}
                            </button>
                            <button onClick={() => setPendingRedacts([])} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>
                              <X size={10} /> Clear
                            </button>
                          </div>
                        )}

                        {/* Crop confirm overlay */}
                        {pendingCrop && tool === 'crop' && (
                          <div style={{
                            position: 'absolute',
                            top: Math.min(pendingCrop.y + pendingCrop.h + 8, (canvasDims?.h ?? 0) - 44),
                            left: Math.max(pendingCrop.x, 0),
                            zIndex: 1100,
                            display: 'flex', gap: 5,
                            background: 'rgba(10,8,30,0.94)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 8, padding: '5px 8px',
                          }}>
                            <button onClick={applyCrop} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(99,102,241,0.5)', background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                              <Crop size={10} /> Apply
                            </button>
                            <button onClick={() => setPendingCrop(null)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>
                              <X size={10} /> Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </Document>
                  )}
                </div>
              </div>
            </div>

            {/* Right: tools sidebar */}
            <div className="glass" style={{ width: 210, borderRadius: 14, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: 10 }}>

                <SbSection title={`Annotate${pageAnnotCount > 0 ? ` · ${pageAnnotCount}` : ''}`}>
                  <SbTool icon={<MousePointer size={14} />} label="Select" sublabel="Pan & interact" active={tool === 'select'} onClick={() => setTool('select')} />
                  <SbTool icon={<Highlighter size={14} />} label="Highlight" sublabel="Drag to highlight text" active={tool === 'highlight'} onClick={() => setTool('highlight')} />
                  {tool === 'highlight' && <SbColorPicker color={color} onChange={setColor} />}
                  <SbTool icon={<PenLine size={14} />} label="Draw" sublabel="Freehand pen" active={tool === 'draw'} onClick={() => setTool('draw')} />
                  {tool === 'draw' && <>
                    <SbColorPicker color={color} onChange={setColor} />
                    <SbLineWidth lineWidth={lineWidth} onChange={setLineWidth} />
                  </>}
                  <SbTool icon={<Type size={14} />} label="Text" sublabel="Click to add a note" active={tool === 'text'} onClick={() => setTool('text')} />
                  {tool === 'text' && <SbColorPicker color={color} onChange={setColor} />}
                  <SbTool icon={<Eraser size={14} />} label="Erase" sublabel="Remove annotations" active={tool === 'erase'} onClick={() => setTool('erase')} />
                  <div style={{ display: 'flex', gap: 4, padding: '3px 10px 5px' }}>
                    <button onClick={undoAnnot} title="Undo (Ctrl+Z)"
                      style={{ flex: 1, padding: '4px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
                      ↩ Undo
                    </button>
                    <button onClick={redoAnnot} title="Redo (Ctrl+Y)"
                      style={{ flex: 1, padding: '4px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
                      ↪ Redo
                    </button>
                  </div>
                </SbSection>

                <SbSection title="Page">
                  <SbTool icon={<Crop size={14} />} label="Crop" sublabel="Trim current page" active={tool === 'crop'} onClick={() => setTool('crop')} />
                  <SbTool icon={<RotateCw size={14} />} label="Rotate" sublabel="Clockwise 90°" onClick={() => rotatePage('cw')} />
                  <SbTool icon={<FilePlus2 size={14} />} label="Insert Blank Page" sublabel={`Add blank page after p.${pageNumber}`} onClick={runInsertBlankPage} />
                  <SbTool icon={<Trash2 size={14} />} label="Delete Page" sublabel={numPages <= 1 ? 'Only one page' : `Remove page ${pageNumber}`} disabled={numPages <= 1} onClick={deletePage} />
                </SbSection>

                <SbSection title="Security">
                  <SbTool icon={<EyeOff size={14} />} label="Redact" sublabel="Permanently black out content" active={tool === 'redact'} onClick={() => setTool('redact')} />
                  <SbTool icon={<Lock size={14} />} label="Permissions" sublabel="Restrict print, copy, edit" active={showPermissions} onClick={() => setShowPermissions(o => !o)} />
                  <SbTool icon={<ScanText size={14} />} label="OCR" sublabel="Make scanned text searchable" active={showOcr} onClick={() => setShowOcr(o => !o)} />
                </SbSection>

                <SbSection title="Content">
                  <SbTool icon={<Layers size={14} />} label="Watermark & Stamp" sublabel="Headers, page numbers…" active={showContentTools} onClick={() => setShowContentTools(o => !o)} />
                  <SbTool icon={<Info size={14} />} label="Metadata" sublabel="Title, author, keywords…" active={showMetadata} onClick={() => setShowMetadata(o => !o)} />
                  <SbTool icon={<ImageDown size={14} />} label="Extract Images" sublabel="Save embedded images to folder" onClick={runExtractImages} />
                  <SbTool icon={<Layers2 size={14} />} label="Flatten PDF" sublabel="Bake annotations permanently" onClick={runFlatten} />
                </SbSection>

                <SbSection title={`AI${aiClassification ? ` · ${aiClassification}` : ''}`}>
                  <SbTool icon={<Sparkles size={14} />} label="Summarise" sublabel="AI bullet-point summary" onClick={runSummarise} />
                  <SbTool icon={<Languages size={14} />} label="Translate" sublabel="Translate full document" onClick={runTranslate} />
                  <SbTool icon={<UserCheck size={14} />} label="Smart Redact" sublabel="Find & redact PII with AI" onClick={runSmartRedact} />
                  <SbTool icon={<MessageSquare size={14} />} label="Chat with PDF" sublabel="Ask questions about the doc" onClick={() => setLeftTab('ai')} />
                </SbSection>

                <SbSection title="Forms">
                  <SbTool icon={<ClipboardList size={14} />} label="Add Field" sublabel="Draw a form field on page" active={tool === 'formfield'} onClick={() => setTool('formfield')} />
                  {tool === 'formfield' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '2px 10px 6px' }}>
                      {(['text', 'checkbox', 'dropdown', 'radio'] as const).map(ft => (
                        <button key={ft} onClick={() => setFormFieldType(ft)}
                          style={{ padding: '3px 7px', borderRadius: 5, border: `1px solid ${formFieldType === ft ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.1)'}`, background: formFieldType === ft ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', color: formFieldType === ft ? '#93c5fd' : 'var(--text-muted)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                          {ft === 'text' ? 'Text' : ft === 'checkbox' ? 'Check' : ft === 'dropdown' ? 'Drop' : 'Radio'}
                        </button>
                      ))}
                    </div>
                  )}
                </SbSection>

              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Right sidebar helpers ────────────────────────────────────────────────────

function SbSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '8px 12px 4px' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 6px' }}>
        {children}
      </div>
    </div>
  )
}

function SbTool({ icon, label, sublabel, active, disabled, onClick }: {
  icon: React.ReactNode; label: string; sublabel?: string
  active?: boolean; disabled?: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 8,
        width: '100%', textAlign: 'left', cursor: disabled ? 'default' : 'pointer',
        background: active ? 'rgba(99,102,241,0.2)' : 'transparent',
        border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!disabled && !active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
      onMouseLeave={e => { e.currentTarget.style.background = active ? 'rgba(99,102,241,0.2)' : 'transparent' }}
    >
      <div style={{ color: active ? '#a5b4fc' : disabled ? 'rgba(255,255,255,0.2)' : 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#c7d2fe' : disabled ? 'rgba(255,255,255,0.25)' : 'var(--text-secondary)', lineHeight: 1.3 }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontSize: 10, color: disabled ? 'rgba(255,255,255,0.15)' : 'var(--text-muted)', lineHeight: 1.3 }}>
            {sublabel}
          </span>
        )}
      </div>
    </button>
  )
}

function SbColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '3px 9px 7px' }}>
      {COLORS.map(c => (
        <button key={c} onClick={() => onChange(c)} title={c}
          style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: color === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
      ))}
    </div>
  )
}

function SbLineWidth({ lineWidth, onChange }: { lineWidth: number; onChange: (w: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '0 9px 7px' }}>
      {[2, 4, 7].map(w => (
        <button key={w} onClick={() => onChange(w)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, height: 24, borderRadius: 5, background: lineWidth === w ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)', border: `1px solid ${lineWidth === w ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer' }}>
          <div style={{ width: w + 6, height: w, background: 'white', borderRadius: 99 }} />
        </button>
      ))}
    </div>
  )
}

// ── Content Tools modal ───────────────────────────────────────────────────────

const STAMP_OPTIONS = ['DRAFT', 'APPROVED', 'CONFIDENTIAL', 'COPY', 'VOID'] as const
const STAMP_PILL: Record<string, string> = {
  DRAFT: '#b45309', APPROVED: '#16a34a', CONFIDENTIAL: '#dc2626', COPY: '#2563eb', VOID: '#7f1d1d',
}

function ContentToolsModal({ onClose, onApply }: {
  onClose: () => void
  onApply: (cmd: string, args: object) => Promise<void>
}) {
  const [tab, setTab] = useState<'watermark' | 'stamp' | 'header' | 'pagenum'>('watermark')
  const [busy, setBusy] = useState(false)

  const [wmText, setWmText]       = useState('DRAFT')
  const [wmOpacity, setWmOpacity] = useState(30)
  const [wmAngle, setWmAngle]     = useState(45)

  const [stamp, setStamp]       = useState('DRAFT')
  const [stampPos, setStampPos] = useState('top-right')

  const [headerText, setHeaderText] = useState('')
  const [footerText, setFooterText] = useState('')

  const [pnPos, setPnPos]   = useState('bottom-center')
  const [pnStart, setPnStart] = useState(1)

  const apply = async () => {
    setBusy(true)
    try {
      if (tab === 'watermark') {
        await onApply('add_watermark', { text: wmText, opacity: wmOpacity / 100, angle: wmAngle, font_size: 60 })
      } else if (tab === 'stamp') {
        await onApply('add_stamp', { stamp, position: stampPos, page_num: -1 })
      } else if (tab === 'header') {
        await onApply('add_header_footer', { header: headerText, footer: footerText, font_size: 10 })
      } else {
        await onApply('add_page_numbers', { position: pnPos, start: pnStart, font_size: 11 })
      }
    } catch (err) {
      alert(`Content tool failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const TABS = [
    { id: 'watermark', label: 'Watermark' },
    { id: 'stamp',     label: 'Stamp' },
    { id: 'header',    label: 'Header / Footer' },
    { id: 'pagenum',   label: 'Page Numbers' },
  ] as const

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000 }}
      />
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2001 }}>
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.14 }}
          style={{ width: 390, background: 'rgba(10,8,32,0.97)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 28px 64px rgba(0,0,0,0.55)' }}
        >
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
            <Layers size={14} color="#a5b4fc" />
            <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Content Tools</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={14} /></button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: '9px 2px', background: 'none', border: 'none', borderBottom: tab === id ? '2px solid #6366f1' : '2px solid transparent', color: tab === id ? '#a5b4fc' : 'var(--text-muted)', fontSize: 11, fontWeight: tab === id ? 700 : 400, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 13 }}>
            {tab === 'watermark' && <>
              <CtField label="Text">
                <CtInput value={wmText} onChange={e => setWmText(e.target.value)} placeholder="e.g. DRAFT" />
              </CtField>
              <CtField label={`Opacity — ${wmOpacity}%`}>
                <input type="range" min={5} max={75} value={wmOpacity} onChange={e => setWmOpacity(+e.target.value)} style={{ width: '100%', accentColor: '#6366f1' }} />
              </CtField>
              <CtField label={`Angle — ${wmAngle}°`}>
                <input type="range" min={0} max={90} value={wmAngle} onChange={e => setWmAngle(+e.target.value)} style={{ width: '100%', accentColor: '#6366f1' }} />
              </CtField>
            </>}

            {tab === 'stamp' && <>
              <CtField label="Stamp type">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {STAMP_OPTIONS.map(s => (
                    <button key={s} onClick={() => setStamp(s)} style={{ padding: '4px 10px', borderRadius: 6, border: `1.5px solid ${STAMP_PILL[s]}`, background: stamp === s ? STAMP_PILL[s] + '28' : 'transparent', color: STAMP_PILL[s], fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{s}</button>
                  ))}
                </div>
              </CtField>
              <CtField label="Position">
                <CtSelect value={stampPos} onChange={e => setStampPos(e.target.value)}>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                  <option value="center">Centre</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </CtSelect>
              </CtField>
            </>}

            {tab === 'header' && <>
              <CtField label="Header (top of every page)">
                <CtInput value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="Header text…" />
              </CtField>
              <CtField label="Footer (bottom of every page)">
                <CtInput value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="Footer text…" />
              </CtField>
            </>}

            {tab === 'pagenum' && <>
              <CtField label="Position">
                <CtSelect value={pnPos} onChange={e => setPnPos(e.target.value)}>
                  <option value="bottom-center">Bottom Centre</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-center">Top Centre</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </CtSelect>
              </CtField>
              <CtField label="Starting number">
                <CtInput type="number" min="1" value={String(pnStart)} onChange={e => setPnStart(Math.max(1, +e.target.value))} />
              </CtField>
            </>}
          </div>

          {/* Apply */}
          <div style={{ padding: '0 16px 16px' }}>
            <button onClick={apply} disabled={busy} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: busy ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
              {busy ? 'Applying…' : 'Apply to All Pages'}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  )
}

function CtField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
      {children}
    </div>
  )
}

function CtInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', ...props.style }} />
}

function CtSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ background: 'rgba(30,25,60,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: '100%', ...props.style }} />
}

// ── Forms panel ──────────────────────────────────────────────────────────────

interface FormFieldItem { name: string; type: string; value: string; page: number; rect: number[]; choices: string[] }

function FormsPanel({ sourceFile, workingFile, reloadKey, onApply, onExport, onImport }: {
  sourceFile: string | null; workingFile: string | null; reloadKey: number
  onApply: (fields: Record<string, string>) => Promise<void>
  onExport: (format: 'json' | 'csv') => Promise<void>
  onImport: () => Promise<void>
}) {
  const [fields, setFields]   = useState<FormFieldItem[]>([])
  const [values, setValues]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [dirty,   setDirty]   = useState(false)
  const [busy,    setBusy]    = useState(false)

  const effectiveFile = workingFile ?? sourceFile

  useEffect(() => {
    if (!effectiveFile) { setFields([]); return }
    setLoading(true)
    window.electronAPI?.pdfCommand('get_form_fields', { input: effectiveFile })
      .then(res => {
        const f = ((res as { fields?: FormFieldItem[] }).fields) ?? []
        setFields(f)
        const v: Record<string, string> = {}
        for (const field of f) v[field.name] = field.value ?? ''
        setValues(v); setDirty(false)
      })
      .catch(() => setFields([]))
      .finally(() => setLoading(false))
  }, [effectiveFile, reloadKey])

  if (!sourceFile) return <Empty>No PDF open</Empty>
  if (loading)     return <Empty>Loading…</Empty>
  if (fields.length === 0) return (
    <Empty>No form fields found.<br /><span style={{ fontSize: 11 }}>Use the Form Field tool (toolbar) to add one.</span></Empty>
  )

  const changed = (name: string, val: string) => { setValues(v => ({ ...v, [name]: val })); setDirty(true) }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fields.map(f => (
          <div key={f.name} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, paddingLeft: 1 }}>
              {f.name} <span style={{ fontWeight: 400, opacity: 0.65 }}>p.{f.page + 1}</span>
            </span>
            {f.type === 'CheckBox' ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', padding: '3px 4px' }}>
                <input type="checkbox" checked={values[f.name] === 'Yes'}
                  onChange={e => changed(f.name, e.target.checked ? 'Yes' : 'Off')}
                  style={{ accentColor: '#6366f1', width: 13, height: 13, cursor: 'pointer' }} />
                {values[f.name] === 'Yes' ? 'Checked' : 'Unchecked'}
              </label>
            ) : f.type === 'RadioButton' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
                {f.choices.map(c => (
                  <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <input type="radio" name={f.name} value={c} checked={values[f.name] === c}
                      onChange={() => changed(f.name, c)}
                      style={{ accentColor: '#6366f1', cursor: 'pointer' }} />
                    {c}
                  </label>
                ))}
              </div>
            ) : (f.type === 'ComboBox' || f.type === 'ListBox') && f.choices.length > 0 ? (
              <select value={values[f.name]} onChange={e => changed(f.name, e.target.value)}
                style={{ background: 'rgba(30,25,60,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}>
                <option value="">— Select —</option>
                {f.choices.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input value={values[f.name] ?? ''} onChange={e => changed(f.name, e.target.value)}
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 5, borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button onClick={async () => { setBusy(true); try { await onApply(values) } finally { setBusy(false) } }}
          disabled={!dirty || busy}
          style={{ padding: '6px', borderRadius: 7, border: 'none', background: (!dirty || busy) ? 'rgba(99,102,241,0.14)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: (!dirty || busy) ? 'var(--text-muted)' : 'white', fontSize: 11, fontWeight: 700, cursor: (!dirty || busy) ? 'default' : 'pointer' }}>
          {busy ? 'Applying…' : dirty ? 'Apply to PDF' : 'No changes'}
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onExport('json')} style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>JSON</button>
          <button onClick={() => onExport('csv')}  style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>CSV</button>
          <button onClick={onImport} style={{ flex: 1, padding: '5px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Import</button>
        </div>
      </div>
    </div>
  )
}

// ── Permissions modal ─────────────────────────────────────────────────────────

function PermissionsModal({ onClose, onApply }: {
  onClose: () => void
  onApply: (args: object) => Promise<void>
}) {
  const [allowPrint,    setAllowPrint]    = useState(true)
  const [allowCopy,     setAllowCopy]     = useState(true)
  const [allowModify,   setAllowModify]   = useState(true)
  const [allowAnnotate, setAllowAnnotate] = useState(true)
  const [allowForms,    setAllowForms]    = useState(true)
  const [userPw,        setUserPw]        = useState('')
  const [busy,          setBusy]          = useState(false)

  const allUnrestricted = allowPrint && allowCopy && allowModify && allowAnnotate && allowForms && !userPw

  const apply = async () => {
    setBusy(true)
    try {
      await onApply({ allow_print: allowPrint, allow_copy: allowCopy, allow_modify: allowModify, allow_annotate: allowAnnotate, allow_forms: allowForms, user_password: userPw })
    } catch (err) {
      alert(`Permissions failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const checkboxes: [string, boolean, React.Dispatch<React.SetStateAction<boolean>>][] = [
    ['Print',           allowPrint,    setAllowPrint],
    ['Copy text',       allowCopy,     setAllowCopy],
    ['Edit / modify',   allowModify,   setAllowModify],
    ['Add annotations', allowAnnotate, setAllowAnnotate],
    ['Fill form fields',allowForms,    setAllowForms],
  ]

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000 }} />
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2001 }}>
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.14 }}
          style={{ width: 360, background: 'rgba(10,8,32,0.97)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 28px 64px rgba(0,0,0,0.55)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
            <Lock size={14} color="#a5b4fc" />
            <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>PDF Permissions</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={14} /></button>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <CtField label="Password to open (leave blank = no password)">
              <CtInput type="password" value={userPw} onChange={e => setUserPw(e.target.value)} placeholder="Optional open password…" />
            </CtField>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Allow readers to…</span>
              {checkboxes.map(([label, val, setter]) => (
                <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} style={{ accentColor: '#6366f1', width: 14, height: 14, cursor: 'pointer' }} />
                  {label}
                </label>
              ))}
            </div>

            {!allUnrestricted && (
              <div style={{ fontSize: 11, color: '#fbbf24', lineHeight: 1.55, padding: '8px 10px', borderRadius: 7, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                Restrictions use AES-256 encryption. A random owner password is applied — only you can remove restrictions.
              </div>
            )}
          </div>

          <div style={{ padding: '0 16px 16px' }}>
            <button onClick={apply} disabled={busy || allUnrestricted} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: (busy || allUnrestricted) ? 'rgba(99,102,241,0.18)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: (busy || allUnrestricted) ? 'var(--text-muted)' : 'white', fontSize: 13, fontWeight: 700, cursor: (busy || allUnrestricted) ? 'default' : 'pointer' }}>
              {busy ? 'Saving…' : allUnrestricted ? 'Restrict at least one permission or set a password' : 'Save Protected PDF'}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  )
}

// ── Outline panel (Bookmarks tab) ────────────────────────────────────────────

interface OutlineItem { level: number; title: string; page: number }

function OutlinePanel({ sourceFile, onPageClick, onSplitByBookmarks }: {
  sourceFile: string | null
  onPageClick: (p: number) => void
  onSplitByBookmarks: () => void
}) {
  const [outline, setOutline] = useState<OutlineItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sourceFile) { setOutline([]); return }
    setLoading(true)
    window.electronAPI?.pdfCommand('get_outline', { input: sourceFile })
      .then(res => {
        const r = res as { outline?: OutlineItem[] }
        setOutline(r.outline ?? [])
      })
      .catch(() => setOutline([]))
      .finally(() => setLoading(false))
  }, [sourceFile])

  if (!sourceFile) return <Empty>No PDF open</Empty>
  if (loading) return <Empty>Loading…</Empty>
  if (outline.length === 0) return <Empty>No bookmarks in this PDF</Empty>

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, padding: '4px 4px' }}>
      {outline.map((item, i) => (
        <button
          key={i}
          onClick={() => onPageClick(item.page)}
          title={`${item.title} — p.${item.page}`}
          style={{
            display: 'flex', alignItems: 'baseline', gap: 4,
            paddingLeft: (item.level - 1) * 10 + 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4,
            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: 5, width: '100%',
            color: item.level === 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: item.level === 1 ? 12 : 11, fontWeight: item.level === 1 ? 600 : 400,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{item.page}</span>
        </button>
      ))}
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '7px 6px 4px', flexShrink: 0 }}>
        <button onClick={onSplitByBookmarks}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', cursor: 'pointer', fontSize: 11, fontWeight: 600, width: '100%' }}>
          <Scissors size={11} /> Split by bookmarks
        </button>
      </div>
    </div>
  )
}

// ── Comments panel (Annotations list tab) ────────────────────────────────────

function CommentsPanel({ annotations, pageNumber, onPageClick, onAddReply }: {
  annotations: Map<number, Annot[]>
  pageNumber: number
  onPageClick: (p: number) => void
  onAddReply: (annotId: string, content: string) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  const all = Array.from(annotations.entries())
    .sort(([a], [b]) => a - b)
    .flatMap(([pg, annots]) => annots.map(a => ({ ...a, pg })))

  if (all.length === 0) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
        No annotations yet.<br />
        <span style={{ fontSize: 11 }}>Use Highlight, Draw or Text tools.</span>
      </div>
    )
  }

  const submitReply = (annotId: string) => {
    if (!replyText.trim()) return
    onAddReply(annotId, replyText)
    setReplyText('')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 6px' }}>
      {all.map(a => {
        const isCurrent = a.pg === pageNumber
        const isExpanded = expandedId === a.id
        const TypeIcon = a.type === 'highlight' ? Highlighter : a.type === 'draw' ? PenLine : Type
        const preview = a.type === 'text' ? a.content : a.type === 'highlight' ? 'Highlight' : 'Drawing'
        const replyCount = a.replies?.length ?? 0
        return (
          <div key={a.id} style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${isExpanded ? 'rgba(99,102,241,0.3)' : 'transparent'}` }}>
            <button
              onClick={() => {
                onPageClick(a.pg)
                setExpandedId(isExpanded ? null : a.id)
                setReplyText('')
              }}
              style={{
                display: 'flex', flexDirection: 'column', gap: 3, width: '100%',
                padding: '6px 8px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: isCurrent ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                borderLeft: `3px solid ${a.color}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = isCurrent ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.09)' }}
              onMouseLeave={e => { e.currentTarget.style.background = isCurrent ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <TypeIcon size={10} color={a.color} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Page {a.pg}</span>
                {replyCount > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: '#a5b4fc', background: 'rgba(99,102,241,0.2)', padding: '1px 5px', borderRadius: 99 }}>
                    {replyCount} repl{replyCount === 1 ? 'y' : 'ies'}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</span>
            </button>

            {/* Thread: replies + reply input */}
            {isExpanded && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 8px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(a.replies ?? []).map(r => (
                  <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 8, borderLeft: '2px solid rgba(255,255,255,0.12)' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{r.content}</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
                  <input
                    autoFocus
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); submitReply(a.id) }
                      if (e.key === 'Escape') { setExpandedId(null); setReplyText('') }
                    }}
                    placeholder="Add reply… (Enter to send)"
                    style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 5, padding: '4px 7px', color: 'var(--text-primary)', fontSize: 11, outline: 'none' }}
                  />
                  <button onClick={() => submitReply(a.id)}
                    style={{ padding: '4px 8px', borderRadius: 5, border: 'none', background: 'rgba(99,102,241,0.3)', color: '#a5b4fc', fontSize: 11, cursor: 'pointer' }}>
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 14, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>{children}</div>
}

// ── Thumbnail panel (Pages tab) ──────────────────────────────────────────────

function ThumbnailPanel({
  pdfData, numPages, pageNumber, onPageClick,
  selectedPages, onToggleSelect,
  dragPage, onDragPage, dragOverPage, onDragOverPage, onReorder,
  onExtract, onInsert,
}: {
  pdfData: string | null
  numPages: number
  pageNumber: number
  onPageClick: (p: number) => void
  selectedPages: Set<number>
  onToggleSelect: (p: number) => void
  dragPage: number | null
  onDragPage: (p: number | null) => void
  dragOverPage: number | null
  onDragOverPage: (p: number | null) => void
  onReorder: (from: number, to: number) => void
  onExtract: () => void
  onInsert: () => void
}) {
  if (!pdfData) return <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>No PDF open</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Document file={pdfData} loading={null} error={null}>
          {Array.from({ length: numPages }, (_, i) => i + 1).map(p => {
            const isCurrent = p === pageNumber
            const isSelected = selectedPages.has(p)
            const isDragOver = dragOverPage === p
            return (
              <div
                key={p}
                draggable
                onDragStart={() => onDragPage(p)}
                onDragOver={e => { e.preventDefault(); onDragOverPage(p) }}
                onDrop={e => { e.preventDefault(); if (dragPage && dragPage !== p) onReorder(dragPage, p); onDragPage(null); onDragOverPage(null) }}
                onDragEnd={() => { onDragPage(null); onDragOverPage(null) }}
                onClick={e => { if (e.ctrlKey || e.metaKey) onToggleSelect(p); else onPageClick(p) }}
                style={{
                  cursor: 'grab',
                  borderRadius: 6,
                  border: isDragOver ? '2px dashed rgba(99,102,241,0.8)'
                    : isCurrent ? '2px solid #6366f1'
                    : isSelected ? '2px solid #22c55e'
                    : '2px solid transparent',
                  background: isSelected ? 'rgba(34,197,94,0.08)' : isCurrent ? 'rgba(99,102,241,0.1)' : 'transparent',
                  padding: 3,
                  position: 'relative',
                  userSelect: 'none',
                }}
              >
                <Page
                  pageNumber={p}
                  width={148}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={<div style={{ width: 148, height: 190, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />}
                />
                <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: isCurrent ? '#a5b4fc' : 'var(--text-muted)', fontWeight: isCurrent ? 700 : 400, pointerEvents: 'none' }}>
                  {p}
                </div>
                {isSelected && (
                  <div style={{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <CheckSquare size={9} color="white" />
                  </div>
                )}
              </div>
            )
          })}
        </Document>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '8px 0 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {selectedPages.size > 0 && (
          <button onClick={onExtract} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: '#4ade80', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            <CheckSquare size={11} /> Extract {selectedPages.size} page{selectedPages.size !== 1 ? 's' : ''}
          </button>
        )}
        <button onClick={onInsert} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
          <FilePlus size={11} /> Insert PDF
        </button>
      </div>
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

function ToolBarBtn({ onClick, accent, title, children }: { onClick: () => void; accent?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onClick} title={title}
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

// ── Metadata modal ───────────────────────────────────────────────────────────

function MetadataModal({ sourceFile, onClose, onApply }: {
  sourceFile: string
  onClose: () => void
  onApply: (meta: Record<string, string>) => Promise<void>
}) {
  const [meta, setMeta] = useState<Record<string, string>>({ title: '', author: '', subject: '', keywords: '', creator: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.electronAPI?.pdfCommand('get_metadata', { input: sourceFile })
      .then(res => {
        const m = (res as { metadata: Record<string, string> }).metadata ?? {}
        setMeta({ title: m.title ?? '', author: m.author ?? '', subject: m.subject ?? '', keywords: m.keywords ?? '', creator: m.creator ?? '' })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sourceFile])

  const fields: [string, string][] = [['title', 'Title'], ['author', 'Author'], ['subject', 'Subject'], ['keywords', 'Keywords'], ['creator', 'Creator']]

  const apply = async () => {
    setBusy(true)
    try { await onApply(meta) } catch (e) { alert(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000 }} />
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2001 }}>
        <motion.div onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.14 }}
          style={{ width: 380, background: 'rgba(10,8,32,0.97)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 28px 64px rgba(0,0,0,0.55)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
            <Info size={14} color="#a5b4fc" />
            <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Document Metadata</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={14} /></button>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 8 }}>Loading…</div> : (
              fields.map(([key, label]) => (
                <CtField key={key} label={label}>
                  <CtInput value={meta[key]} onChange={e => setMeta(m => ({ ...m, [key]: e.target.value }))} placeholder={`Enter ${label.toLowerCase()}…`} />
                </CtField>
              ))
            )}
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            <button onClick={apply} disabled={busy || loading}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: (busy || loading) ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: 13, fontWeight: 700, cursor: (busy || loading) ? 'default' : 'pointer' }}>
              {busy ? 'Saving…' : 'Apply Metadata'}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  )
}

// ── Shortcuts modal ──────────────────────────────────────────────────────────

const SHORTCUTS = [
  ['Ctrl + F',           'Search in document'],
  ['Ctrl + H',           'Find & Replace'],
  ['Ctrl + S',           'Save PDF'],
  ['Ctrl + P',           'Print'],
  ['Ctrl + Z',           'Undo annotation'],
  ['Ctrl + Y / ⇧Z',     'Redo annotation'],
  ['← / →',             'Previous / Next page'],
  ['?',                  'Show this panel'],
  ['Esc',                'Close search / cancel tool'],
]

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000 }} />
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2001 }}>
        <motion.div onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.14 }}
          style={{ width: 360, background: 'rgba(10,8,32,0.97)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 28px 64px rgba(0,0,0,0.55)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
            <HelpCircle size={14} color="#a5b4fc" />
            <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Keyboard Shortcuts</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={14} /></button>
          </div>
          <div style={{ padding: '10px 16px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <kbd style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', fontSize: 11, fontFamily: 'monospace', color: '#c7d2fe', whiteSpace: 'nowrap', flexShrink: 0, minWidth: 110, textAlign: 'center' }}>
                  {key}
                </kbd>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  )
}

// ── AI Chat Panel ────────────────────────────────────────────────────────────

function suggestedQuestions(classification: string | null): string[] {
  const c = (classification ?? '').toLowerCase()
  if (c.includes('contract') || c.includes('agreement') || c.includes('legal'))
    return ['Who are the parties?', 'What are the key obligations?', 'Are there any red flags?', 'What are the key dates?']
  if (c.includes('invoice') || c.includes('financial') || c.includes('report'))
    return ['What is the total amount?', 'What are the key figures?', 'Who is the payee?', 'What period does this cover?']
  if (c.includes('cv') || c.includes('resume'))
    return ['What are the key skills?', 'What roles have they held?', 'What is their education?', 'How many years of experience?']
  return ['Summarise this document', 'What are the key points?', 'Who is this for?', 'What action items are mentioned?']
}

function AIChatPanel({ messages, input, loading, error, hasFile, classification, chatEndRef, onInputChange, onSend, onClear }: {
  messages: AIMessage[]
  input: string
  loading: boolean
  error: string | null
  hasFile: boolean
  classification: string | null
  chatEndRef: React.RefObject<HTMLDivElement>
  onInputChange: (v: string) => void
  onSend: () => void
  onClear: () => void
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px 4px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Sparkles size={11} /> AI Chat
        </span>
        {messages.length > 0 && (
          <button onClick={onClear} title="Clear conversation"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}>
            <RotateCcw size={11} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>
              {hasFile ? 'Ask anything, or try a suggestion:' : 'Open a PDF to start chatting with AI.'}
            </div>
            {hasFile && suggestedQuestions(classification).map(q => (
              <button key={q} onClick={() => { onInputChange(q); setTimeout(onSend, 0) }}
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, textAlign: 'left', lineHeight: 1.3 }}>
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            padding: '7px 10px', borderRadius: 8, fontSize: 12, lineHeight: 1.55,
            background: m.role === 'user' ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${m.role === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
            color: m.role === 'user' ? '#c7d2fe' : 'var(--text-primary)',
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '92%',
            whiteSpace: 'pre-wrap',
          }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11, alignSelf: 'flex-start' }}>
            <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Thinking…
          </div>
        )}
        {error && (
          <div style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: 11, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '6px 8px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
            placeholder="Ask a question… (Enter to send)"
            rows={2}
            style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '6px 8px', color: 'var(--text-primary)', fontSize: 12, resize: 'none', outline: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={onSend} disabled={!input.trim() || loading}
            style={{ padding: '7px 9px', borderRadius: 7, border: 'none', background: input.trim() && !loading ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)', color: input.trim() && !loading ? '#a5b4fc' : 'var(--text-muted)', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}>
            <Send size={13} />
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── OCR modal ────────────────────────────────────────────────────────────────

const OCR_LANGUAGES = [
  { value: 'eng', label: 'English' },
  { value: 'fra', label: 'French' },
  { value: 'deu', label: 'German' },
  { value: 'spa', label: 'Spanish' },
  { value: 'por', label: 'Portuguese' },
  { value: 'ita', label: 'Italian' },
  { value: 'rus', label: 'Russian' },
  { value: 'chi_sim', label: 'Chinese (Simplified)' },
  { value: 'chi_tra', label: 'Chinese (Traditional)' },
  { value: 'jpn', label: 'Japanese' },
  { value: 'kor', label: 'Korean' },
  { value: 'ara', label: 'Arabic' },
]

function OcrModal({ onClose, onRun }: {
  onClose: () => void
  onRun: (lang: string, dpi: number) => Promise<void>
}) {
  const [lang, setLang] = useState('eng')
  const [dpi, setDpi] = useState(300)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const DPI_OPTIONS = [
    { value: 150, label: '150 DPI — fast, draft quality' },
    { value: 300, label: '300 DPI — recommended' },
    { value: 600, label: '600 DPI — high quality, slow' },
  ]

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      await onRun(lang, dpi)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000 }} />
      <div onClick={busy ? undefined : onClose} style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2001 }}>
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.14 }}
          style={{ width: 380, background: 'rgba(10,8,32,0.97)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 28px 64px rgba(0,0,0,0.55)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
            <ScanText size={14} color="#a5b4fc" />
            <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>OCR — Make Searchable</span>
            <button onClick={onClose} disabled={busy} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: busy ? 'default' : 'pointer', padding: 2, display: 'flex' }}><X size={14} /></button>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <CtField label="Document language">
              <CtSelect value={lang} onChange={e => setLang(e.target.value)} disabled={busy}>
                {OCR_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </CtSelect>
            </CtField>

            <CtField label="Resolution">
              <CtSelect value={String(dpi)} onChange={e => setDpi(+e.target.value)} disabled={busy}>
                {DPI_OPTIONS.map(o => <option key={o.value} value={String(o.value)}>{o.label}</option>)}
              </CtSelect>
            </CtField>

            {busy && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 7, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div style={{ width: 14, height: 14, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                Running OCR… this may take a minute for large documents.
              </div>
            )}

            {error && (
              <div style={{ fontSize: 11, color: '#f87171', lineHeight: 1.6, padding: '8px 10px', borderRadius: 7, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', whiteSpace: 'pre-wrap' }}>{error}</div>
            )}

            {!busy && !error && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Requires <strong style={{ color: 'var(--text-secondary)' }}>Tesseract</strong> installed on your system. After OCR, scanned pages become searchable with Ctrl+F.
              </div>
            )}
          </div>

          <div style={{ padding: '0 16px 16px' }}>
            <button onClick={run} disabled={busy} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: busy ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer' }}>
              {busy ? 'Processing…' : 'Run OCR'}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  )
}
