import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import { ArrowLeft, Upload, ChevronLeft, ChevronRight, X, GitCompare, Loader } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', window.location.href).href

function PdfPane({ label, file, pdfData, numPages, page, onLoad, onPageChange, onPickFile }: {
  label: string
  file: string | null
  pdfData: string | null
  numPages: number
  page: number
  onLoad: (n: number) => void
  onPageChange: (p: number) => void
  onPickFile: () => void
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden', minWidth: 0 }}>
      {/* Pane header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>
          {label}
        </span>
        {file && (
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {file.split(/[\\/]/).pop()}
          </span>
        )}
        <motion.button whileHover={{ scale: 1.04 }} onClick={onPickFile}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
          <Upload size={11} /> {file ? 'Change' : 'Open PDF'}
        </motion.button>
        {numPages > 1 && (
          <>
            <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
              style={{ background: 'none', border: 'none', color: page <= 1 ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: page <= 1 ? 'default' : 'pointer', padding: '2px 3px', display: 'flex' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{page} / {numPages}</span>
            <button onClick={() => onPageChange(Math.min(numPages, page + 1))} disabled={page >= numPages}
              style={{ background: 'none', border: 'none', color: page >= numPages ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: page >= numPages ? 'default' : 'pointer', padding: '2px 3px', display: 'flex' }}>
              <ChevronRight size={14} />
            </button>
          </>
        )}
      </div>

      {/* PDF viewer */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
        {pdfData ? (
          <Document file={pdfData} onLoadSuccess={({ numPages: n }) => onLoad(n)} loading={null} error={null}>
            <div style={{ background: 'white', boxShadow: '0 8px 40px rgba(0,0,0,0.6)', borderRadius: 2 }}>
              <Page pageNumber={page} width={360} renderTextLayer={false} renderAnnotationLayer={false} />
            </div>
          </Document>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13, height: 200 }}>
            <Upload size={24} style={{ opacity: 0.2 }} />
            <span>No PDF selected</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Compare() {
  const navigate = useNavigate()

  const [fileA, setFileA] = useState<string | null>(null)
  const [fileB, setFileB] = useState<string | null>(null)
  const [pdfA, setPdfA] = useState<string | null>(null)
  const [pdfB, setPdfB] = useState<string | null>(null)
  const [numPagesA, setNumPagesA] = useState(0)
  const [numPagesB, setNumPagesB] = useState(0)
  const [pageA, setPageA] = useState(1)
  const [pageB, setPageB] = useState(1)
  const [syncPages, setSyncPages] = useState(true)

  const [diffImage, setDiffImage] = useState<string | null>(null)
  const [diffPct, setDiffPct] = useState<number | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const [diffBusy, setDiffBusy] = useState(false)

  const pickFile = async (which: 'a' | 'b') => {
    const paths = await window.electronAPI?.openPDF()
    if (!paths?.[0]) return
    const path = paths[0]
    const data = (await window.electronAPI!.readFile(path)) as string
    if (which === 'a') { setFileA(path); setPdfA(data); setNumPagesA(0); setPageA(1) }
    else { setFileB(path); setPdfB(data); setNumPagesB(0); setPageB(1) }
    setDiffImage(null); setDiffPct(null)
  }

  const goA = (p: number) => {
    setPageA(p)
    if (syncPages) setPageB(Math.min(p, numPagesB || p))
  }
  const goB = (p: number) => {
    setPageB(p)
    if (syncPages) setPageA(Math.min(p, numPagesA || p))
  }

  const runDiff = async () => {
    if (!fileA || !fileB) return
    setDiffBusy(true)
    setDiffImage(null)
    setDiffPct(null)
    try {
      const tmpBase = await window.electronAPI!.makeTempCopy(fileA)
      const outPath = tmpBase.replace(/\.[^.]+$/, '_diff.png')
      const res = await window.electronAPI!.pdfCommand('compare_pages', {
        input_a: fileA, input_b: fileB,
        output: outPath,
        page_a: pageA - 1, page_b: pageB - 1, dpi: 150,
      }) as { success: boolean; changed_pct: number }
      const imgData = (await window.electronAPI!.readFile(outPath)) as string
      setDiffImage(imgData)
      setDiffPct(res.changed_pct)
      setShowDiff(true)
      await window.electronAPI!.deleteTempFile(tmpBase)
      await window.electronAPI!.deleteTempFile(outPath)
    } catch (err) {
      alert('Diff failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setDiffBusy(false)
    }
  }

  const bothLoaded = !!fileA && !!fileB

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 10 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={14} /> Back
        </motion.button>
        <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Compare PDFs</span>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
          <input type="checkbox" checked={syncPages} onChange={e => setSyncPages(e.target.checked)} style={{ accentColor: '#6366f1' }} />
          Sync pages
        </label>

        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
          onClick={runDiff} disabled={!bothLoaded || diffBusy}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: 'none', cursor: (bothLoaded && !diffBusy) ? 'pointer' : 'default', fontSize: 13, fontWeight: 700, background: (bothLoaded && !diffBusy) ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.08)', color: (bothLoaded && !diffBusy) ? 'white' : 'var(--text-muted)', boxShadow: (bothLoaded && !diffBusy) ? '0 0 20px rgba(99,102,241,0.3)' : 'none' }}>
          {diffBusy
            ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
            : <GitCompare size={13} />
          }
          {diffBusy ? 'Comparing…' : 'Show Diff'}
          {diffPct !== null && !diffBusy && (
            <span style={{ fontSize: 11, opacity: 0.75 }}>({diffPct}% changed)</span>
          )}
        </motion.button>
      </div>

      {/* Side-by-side panes */}
      <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden' }}>
        <PdfPane
          label="Document A"
          file={fileA} pdfData={pdfA} numPages={numPagesA} page={pageA}
          onLoad={setNumPagesA} onPageChange={goA} onPickFile={() => pickFile('a')}
        />
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', flexShrink: 0, alignSelf: 'stretch' }} />
        <PdfPane
          label="Document B"
          file={fileB} pdfData={pdfB} numPages={numPagesB} page={pageB}
          onLoad={setNumPagesB} onPageChange={goB} onPickFile={() => pickFile('b')}
        />
      </div>

      {/* Diff modal */}
      <AnimatePresence>
        {showDiff && diffImage && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 2000 }} />
            <div onClick={() => setShowDiff(false)}
              style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2001, padding: 32 }}>
              <motion.div onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.14 }}
                style={{ background: 'rgba(10,8,32,0.97)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, overflow: 'hidden', maxWidth: '88vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 28px 64px rgba(0,0,0,0.55)' }}>
                {/* Modal header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <GitCompare size={14} color="#a5b4fc" />
                  <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>
                    Visual Diff
                    {diffPct !== null && (
                      <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 400, color: diffPct === 0 ? '#34d399' : diffPct < 5 ? '#fbbf24' : '#f87171' }}>
                        {diffPct === 0 ? '— identical pages' : `— ${diffPct}% of pixels differ`}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,100,100,0.7)', marginRight: 8 }}>Red = changed</span>
                  <button onClick={() => setShowDiff(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}>
                    <X size={14} />
                  </button>
                </div>
                <div style={{ overflow: 'auto', padding: 20 }}>
                  <img src={diffImage} alt="PDF diff" style={{ maxWidth: '100%', display: 'block', borderRadius: 4, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
