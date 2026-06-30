import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Upload, X, FileImage, FileType, Globe,
  CheckCircle, AlertCircle, FolderOpen,
} from 'lucide-react'

type Tab = 'images' | 'office' | 'web'
type Status = 'idle' | 'working' | 'done' | 'error'

const TABS: { id: Tab; label: string; icon: React.ReactNode; color: string; accent: string }[] = [
  { id: 'images', label: 'Images → PDF', icon: <FileImage size={14} />, color: '#f59e0b', accent: 'rgba(245,158,11,' },
  { id: 'office', label: 'Office → PDF', icon: <FileType  size={14} />, color: '#3b82f6', accent: 'rgba(59,130,246,' },
  { id: 'web',    label: 'Web → PDF',    icon: <Globe     size={14} />, color: '#10b981', accent: 'rgba(16,185,129,' },
]

const IMG_FILTERS  = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'webp'] }]
const OFF_FILTERS  = [{ name: 'Office Files', extensions: ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'] }]

export default function ImportPDF() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) ?? 'images')

  const [images,     setImages]     = useState<string[]>([])
  const [imgDrag,    setImgDrag]    = useState(false)
  const [officeFile, setOfficeFile] = useState<string | null>(null)
  const [offDrag,    setOffDrag]    = useState(false)
  const [url,        setUrl]        = useState('')

  const [status,    setStatus]    = useState<Status>('idle')
  const [statusMsg, setStatusMsg] = useState('')

  const run = async (cmd: string, args: object) => {
    const out = await window.electronAPI?.savePath('pdf')
    if (!out) return
    setStatus('working'); setStatusMsg('')
    try {
      await window.electronAPI?.pdfCommand(cmd, { output: out, ...args })
      setStatus('done'); setStatusMsg('PDF saved!')
      window.electronAPI?.showItem(out)
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setStatus('error')
      setStatusMsg(err instanceof Error ? err.message : String(err))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }

  // Use webUtils.getPathForFile (via preload) — File.path is not available with contextIsolation
  const pathsFromDrop = (e: React.DragEvent, exts: RegExp): string[] =>
    Array.from(e.dataTransfer.files)
      .map(f => window.electronAPI!.getPathForFile(f))
      .filter(p => p && exts.test(p))

  const selectImages = async () => {
    const paths = await window.electronAPI?.openFiles(IMG_FILTERS, true) ?? []
    if (paths.length) setImages(prev => [...prev, ...paths])
  }

  const selectOffice = async () => {
    const paths = await window.electronAPI?.openFiles(OFF_FILTERS, false) ?? []
    if (paths.length) setOfficeFile(paths[0])
  }

  const activeTab = TABS.find(t => t.id === tab)!

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Back
        </motion.button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>Create PDF</span>
      </div>

      {/* Tab bar */}
      <div className="glass" style={{ borderRadius: 14, padding: 5, display: 'flex', gap: 4, flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '9px 12px', borderRadius: 10, border: tab === t.id ? `1px solid ${t.accent}0.4)` : '1px solid transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            background: tab === t.id ? `${t.accent}0.12)` : 'transparent',
            color: tab === t.id ? t.color : 'var(--text-muted)',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Main panel */}
      <div className="glass" style={{ flex: 1, borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>

        {/* Status */}
        <AnimatePresence>
          {status !== 'idle' && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 10, fontSize: 13,
                background: status === 'done' ? 'rgba(34,197,94,0.1)' : status === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
                border: `1px solid ${status === 'done' ? 'rgba(34,197,94,0.3)' : status === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)'}` }}>
              {status === 'done'    ? <CheckCircle size={14} color="#22c55e" style={{ flexShrink: 0, marginTop: 1 }} />
               : status === 'error' ? <AlertCircle  size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
               : <Spinner />}
              <span style={{ color: status === 'done' ? '#4ade80' : status === 'error' ? '#fca5a5' : '#a5b4fc', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {status === 'working' ? 'Converting…' : statusMsg}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Images tab ── */}
        {tab === 'images' && (
          <>
            <DropZone
              active={imgDrag} color={activeTab.color}
              onDragEnter={e => { e.preventDefault(); setImgDrag(true) }}
              onDragOver={e => { e.preventDefault(); setImgDrag(true) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setImgDrag(false) }}
              onDrop={e => {
                e.preventDefault(); setImgDrag(false)
                const p = pathsFromDrop(e, /\.(png|jpe?g|bmp|tiff?|webp)$/i)
                if (p.length) setImages(prev => [...prev, ...p])
              }}
            >
              <Upload size={26} color={activeTab.color} />
              <p style={{ fontWeight: 600, fontSize: 14 }}>Drag images here</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>PNG, JPG, BMP, TIFF, WebP</p>
            </DropZone>

            <SelectBtn color={activeTab.color} onClick={selectImages} label="Select Images" />

            {images.length > 0 && (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {images.map((img, i) => (
                  <FileRow key={i} name={img.split(/[\\/]/).pop()!} color={activeTab.color}
                    icon={<FileImage size={13} />}
                    onRemove={() => setImages(p => p.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}

            <ApplyBtn color={activeTab.color} disabled={images.length === 0 || status === 'working'} busy={status === 'working'}
              onClick={() => run('images_to_pdf', { images })}
              label={images.length === 0 ? 'Add images above' : `Create PDF from ${images.length} image${images.length !== 1 ? 's' : ''}`} />
          </>
        )}

        {/* ── Office tab ── */}
        {tab === 'office' && (
          <>
            <DropZone
              active={offDrag} color={activeTab.color}
              onDragEnter={e => { e.preventDefault(); setOffDrag(true) }}
              onDragOver={e => { e.preventDefault(); setOffDrag(true) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOffDrag(false) }}
              onDrop={e => {
                e.preventDefault(); setOffDrag(false)
                const p = pathsFromDrop(e, /\.(docx?|pptx?|xlsx?)$/i)
                if (p.length) setOfficeFile(p[0])
              }}
            >
              <Upload size={26} color={activeTab.color} />
              <p style={{ fontWeight: 600, fontSize: 14 }}>Drop an Office file here</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Word (.docx), PowerPoint (.pptx), Excel (.xlsx)</p>
            </DropZone>

            <SelectBtn color={activeTab.color} onClick={selectOffice} label="Select File" />

            {officeFile && (
              <FileRow name={officeFile.split(/[\\/]/).pop()!} color={activeTab.color}
                icon={<FileType size={13} />} onRemove={() => setOfficeFile(null)} />
            )}

            <Note>Requires <b>LibreOffice</b> (free, add to PATH) or <b>Microsoft Office</b> + <code>pip install docx2pdf</code></Note>

            <ApplyBtn color={activeTab.color} disabled={!officeFile || status === 'working'} busy={status === 'working'}
              onClick={() => run('office_to_pdf', { input: officeFile! })}
              label="Convert to PDF" />
          </>
        )}

        {/* ── Web tab ── */}
        {tab === 'web' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Page URL</label>
              <input
                value={url} onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && url.trim() && run('url_to_pdf', { url: url.trim() })}
                placeholder="https://example.com"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '11px 14px', color: 'var(--text-primary)', fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <Note>
              Renders the page using the built-in browser — no extra installs required.
              JavaScript, images, and CSS are all supported.
            </Note>

            <ApplyBtn color={activeTab.color} disabled={!url.trim() || status === 'working'} busy={status === 'working'}
              onClick={() => run('url_to_pdf', { url: url.trim() })}
              label="Convert to PDF" />
          </>
        )}
      </div>
    </div>
  )
}

function DropZone({ active, color, children, onDragEnter, onDragOver, onDragLeave, onDrop }: {
  active: boolean; color: string; children: React.ReactNode
  onDragEnter: React.DragEventHandler; onDragOver: React.DragEventHandler
  onDragLeave: React.DragEventHandler; onDrop: React.DragEventHandler
}) {
  return (
    <div onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{ borderRadius: 12, border: `2px dashed ${active ? color : 'rgba(255,255,255,0.15)'}`, padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transition: 'border-color 0.15s', background: active ? `${color}11` : 'transparent', textAlign: 'center' }}>
      {/* pointer-events: none stops children stealing drag events from the parent */}
      <div style={{ pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

function SelectBtn({ color, onClick, label }: { color: string; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
      padding: '9px 14px', borderRadius: 9, cursor: 'pointer',
      background: 'rgba(255,255,255,0.06)', border: `1px solid ${color}44`,
      color, fontSize: 13, fontWeight: 500,
    }}>
      <FolderOpen size={14} /> {label}
    </button>
  )
}

function FileRow({ name, color, icon, onRemove }: { name: string; color: string; icon: React.ReactNode; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <span style={{ color, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{name}</span>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={11} /></button>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 13px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65 }}>
      {children}
    </div>
  )
}

function ApplyBtn({ color, disabled, busy, onClick, label }: { color: string; disabled: boolean; busy: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      marginTop: 'auto', padding: '11px', borderRadius: 10, border: 'none',
      fontWeight: 700, fontSize: 13, cursor: disabled ? 'default' : 'pointer',
      background: disabled ? 'rgba(255,255,255,0.07)' : color,
      color: disabled ? 'var(--text-muted)' : 'white',
      boxShadow: disabled ? 'none' : `0 0 24px ${color}55`,
    }}>
      {busy ? 'Converting…' : label}
    </button>
  )
}

function Spinner() {
  return (
    <>
      <div style={{ width: 14, height: 14, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, marginTop: 1 }} />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
