import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, FolderOpen, Play, Check, AlertCircle, X,
  FileText, Zap, Layers, Hash, Image,
} from 'lucide-react'

type Operation = 'compress' | 'add_watermark' | 'add_page_numbers' | 'to_image'
type FileStatus = 'pending' | 'running' | 'done' | 'error'

interface BatchFile {
  path: string
  name: string
  status: FileStatus
  error?: string
}

const OPS: { id: Operation; icon: React.ReactNode; label: string; desc: string; color: string }[] = [
  { id: 'compress',         icon: <Zap size={15} />,    label: 'Compress',      desc: 'Reduce file size',        color: '#10b981' },
  { id: 'add_watermark',    icon: <Layers size={15} />, label: 'Watermark',     desc: 'Add text to every page', color: '#6366f1' },
  { id: 'add_page_numbers', icon: <Hash size={15} />,   label: 'Page Numbers',  desc: 'Number every page',      color: '#f59e0b' },
  { id: 'to_image',         icon: <Image size={15} />,  label: 'Convert → PNG', desc: 'Export pages as images', color: '#3b82f6' },
]

export default function Batch() {
  const navigate = useNavigate()
  const [files, setFiles] = useState<BatchFile[]>([])
  const [op, setOp] = useState<Operation>('compress')
  const [outDir, setOutDir] = useState('')
  const [running, setRunning] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [wmText, setWmText] = useState('DRAFT')
  const [wmOpacity, setWmOpacity] = useState(30)

  const addPaths = (paths: string[]) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.path))
      const news = paths
        .filter(p => !existing.has(p))
        .map(p => ({ path: p, name: p.split(/[\\/]/).pop() ?? p, status: 'pending' as FileStatus }))
      return [...prev, ...news]
    })
  }

  const pickFiles = async () => {
    const paths = await window.electronAPI?.openPDF()
    if (paths?.length) addPaths(paths)
  }

  const pickOutDir = async () => {
    const dir = await window.electronAPI?.selectDir()
    if (dir) setOutDir(dir)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    const paths = Array.from(e.dataTransfer.files)
      .filter(f => f.name.toLowerCase().endsWith('.pdf'))
      .map(f => window.electronAPI!.getPathForFile(f))
      .filter(Boolean)
    if (paths.length) addPaths(paths)
  }

  const done = files.filter(f => f.status === 'done').length
  const errCount = files.filter(f => f.status === 'error').length
  const canRun = files.length > 0 && outDir.length > 0 && !running

  const run = async () => {
    if (!canRun) return
    setRunning(true)
    setFiles(prev => prev.map(f => ({ ...f, status: 'pending', error: undefined })))

    for (const f of files) {
      setFiles(prev => prev.map(x => x.path === f.path ? { ...x, status: 'running' } : x))
      try {
        const base = f.name.replace(/\.pdf$/i, '')
        const ext = op === 'to_image' ? 'png' : 'pdf'
        const suffix = op === 'compress' ? '_compressed'
          : op === 'add_watermark' ? '_watermarked'
          : op === 'add_page_numbers' ? '_numbered'
          : '_images'
        const outPath = outDir + '\\' + base + suffix + '.' + ext

        const args: Record<string, unknown> = { input: f.path, output: outPath }
        if (op === 'add_watermark') {
          Object.assign(args, { text: wmText, opacity: wmOpacity / 100, angle: 45 })
        } else if (op === 'add_page_numbers') {
          Object.assign(args, { position: 'bottom-center', start: 1 })
        } else if (op === 'to_image') {
          Object.assign(args, { format: 'png', dpi: 150 })
        }

        await window.electronAPI?.pdfCommand(op, args)
        setFiles(prev => prev.map(x => x.path === f.path ? { ...x, status: 'done' } : x))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setFiles(prev => prev.map(x => x.path === f.path ? { ...x, status: 'error', error: msg } : x))
      }
    }
    setRunning(false)
  }

  const currentOp = OPS.find(o => o.id === op)!

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: 10 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={14} /> Back
        </motion.button>
        <span style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Batch Operations</span>
        {outDir && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
            → {outDir.split(/[\\/]/).pop()}
          </span>
        )}
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={pickOutDir}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)' }}>
          <FolderOpen size={13} /> {outDir ? 'Change folder' : 'Output folder'}
        </motion.button>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
          onClick={run} disabled={!canRun}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 8, border: 'none', cursor: canRun ? 'pointer' : 'default', fontSize: 13, fontWeight: 700, background: canRun ? `linear-gradient(135deg,${currentOp.color},${currentOp.color}bb)` : 'rgba(255,255,255,0.08)', color: canRun ? 'white' : 'var(--text-muted)', boxShadow: canRun ? `0 0 20px ${currentOp.color}44` : 'none' }}>
          <Play size={13} style={{ fill: canRun ? 'white' : 'none' }} />
          Run {files.length > 0 ? `(${files.length})` : ''}
        </motion.button>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 10, overflow: 'hidden' }}>

        {/* Left: operation picker */}
        <div className="glass" style={{ width: 210, borderRadius: 14, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: 10, gap: 2 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '4px 6px 8px' }}>
            Operation
          </div>
          {OPS.map(o => (
            <button key={o.id} onClick={() => setOp(o.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, border: `1px solid ${op === o.id ? o.color + '55' : 'transparent'}`, background: op === o.id ? o.color + '18' : 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <div style={{ color: op === o.id ? o.color : 'var(--text-muted)', flexShrink: 0 }}>{o.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: op === o.id ? 600 : 400, color: op === o.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{o.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{o.desc}</div>
              </div>
            </button>
          ))}

          <AnimatePresence>
            {op === 'add_watermark' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 8px 4px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Watermark text</div>
                <input value={wmText} onChange={e => setWmText(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Opacity — {wmOpacity}%</div>
                <input type="range" min={5} max={75} value={wmOpacity} onChange={e => setWmOpacity(+e.target.value)} style={{ accentColor: '#6366f1', width: '100%' }} />
              </motion.div>
            )}
          </AnimatePresence>

          {!outDir && (
            <div style={{ marginTop: 'auto', padding: '10px 6px 4px', fontSize: 11, color: '#fbbf24', lineHeight: 1.5 }}>
              ⚠ Pick an output folder before running.
            </div>
          )}
        </div>

        {/* Right: file list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragActive(true) }}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={handleDrop}
            className="glass"
            onClick={pickFiles}
            style={{ borderRadius: 12, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, cursor: 'pointer', border: isDragActive ? '2px dashed rgba(99,102,241,0.7)' : undefined }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Upload size={16} color="#6366f1" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{isDragActive ? 'Drop PDFs here' : 'Add PDF files'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Drag & drop or click to pick files</div>
            </div>
            {files.length > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 12, flexShrink: 0 }}>
                <span style={{ color: 'var(--text-muted)' }}>{files.length} file{files.length !== 1 ? 's' : ''}</span>
                {done > 0 && <span style={{ color: '#34d399' }}>{done} done</span>}
                {errCount > 0 && <span style={{ color: '#f87171' }}>{errCount} failed</span>}
              </div>
            )}
          </div>

          {/* File list */}
          <div className="glass" style={{ flex: 1, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {files.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, gap: 10 }}>
                <FileText size={30} style={{ opacity: 0.15 }} />
                <span>No files added yet</span>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {files.map(f => (
                  <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: f.status === 'done' ? 'rgba(52,211,153,0.08)' : f.status === 'error' ? 'rgba(239,68,68,0.08)' : f.status === 'running' ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${f.status === 'done' ? 'rgba(52,211,153,0.22)' : f.status === 'error' ? 'rgba(239,68,68,0.2)' : f.status === 'running' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {f.status === 'done'    && <Check size={14} color="#34d399" />}
                      {f.status === 'error'   && <AlertCircle size={14} color="#f87171" />}
                      {f.status === 'running' && <div style={{ width: 14, height: 14, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                      {f.status === 'pending' && <FileText size={14} color="var(--text-muted)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: f.status === 'done' ? '#a7f3d0' : f.status === 'error' ? '#fca5a5' : 'var(--text-secondary)' }}>
                        {f.name}
                      </div>
                      {f.error && (
                        <div style={{ fontSize: 10, color: '#f87171', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.error}</div>
                      )}
                    </div>
                    {!running && (
                      <button onClick={() => setFiles(prev => prev.filter(x => x.path !== f.path))}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0 }}>
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
