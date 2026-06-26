import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Upload, FileType, FileSpreadsheet, FileImage,
  Globe, FileText, CheckCircle, Loader, AlertCircle,
  Merge, Scissors, RotateCw, X, ArrowRightLeft, Shield,
  Lock, Unlock, Eye, EyeOff,
} from 'lucide-react'
import { addRecentFile } from '../utils/recentFiles'

type Status = 'idle' | 'running' | 'done' | 'error'
type Tab = 'convert' | 'merge' | 'split' | 'compress' | 'security'

const formats = [
  { id: 'docx', label: 'Word Document',     ext: 'docx', icon: <FileType size={18} />,        color: '#2b7cd3', cmd: 'to_docx' },
  { id: 'xlsx', label: 'Excel Spreadsheet', ext: 'xlsx', icon: <FileSpreadsheet size={18} />, color: '#217346', cmd: 'to_xlsx' },
  { id: 'png',  label: 'PNG Image',         ext: 'png',  icon: <FileImage size={18} />,        color: '#f59e0b', cmd: 'to_image' },
  { id: 'jpg',  label: 'JPEG Image',        ext: 'jpg',  icon: <FileImage size={18} />,        color: '#ec4899', cmd: 'to_image' },
  { id: 'html', label: 'HTML Page',         ext: 'html', icon: <Globe size={18} />,             color: '#f97316', cmd: 'to_html' },
  { id: 'txt',  label: 'Plain Text',        ext: 'txt',  icon: <FileText size={18} />,          color: '#94a3b8', cmd: 'to_text' },
]

export default function Converter() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'convert')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 40px', gap: 20, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/')}
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
        >
          <ArrowLeft size={14} /> Back
        </motion.button>
        <h2 style={{ fontWeight: 600, fontSize: 20 }}>PDF Tools</h2>
      </div>

      <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4, flexShrink: 0 }}>
        {([
          ['convert',  'Convert',  <ArrowRightLeft size={12} />],
          ['merge',    'Merge',    <Merge size={12} />],
          ['split',    'Split',    <Scissors size={12} />],
          ['compress', 'Compress', <RotateCw size={12} />],
          ['security', 'Security', <Shield size={12} />],
        ] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => (
          <button
            key={id} onClick={() => setTab(id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '7px 8px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              background: tab === id ? 'rgba(99,102,241,0.25)' : 'transparent',
              color: tab === id ? '#a5b4fc' : 'var(--text-muted)',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
        >
          {tab === 'convert'  && <ConvertTab />}
          {tab === 'merge'    && <MergeTab />}
          {tab === 'split'    && <SplitTab />}
          {tab === 'compress' && <CompressTab />}
          {tab === 'security' && <SecurityTab />}
        </motion.div>
      </AnimatePresence>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Convert ───────────────────────────────────────────────────────────────────

function ConvertTab() {
  const [inputFile, setInputFile] = useState<string | null>(null)
  const [fmt, setFmt] = useState(formats[0])
  const [status, setStatus] = useState<Status>('idle')
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!inputFile) return
    setStatus('running'); setError(null)
    const out = await window.electronAPI?.savePath(fmt.ext)
    if (!out) { setStatus('idle'); return }
    try {
      await window.electronAPI?.pdfCommand(fmt.cmd, { input: inputFile, output: out, format: fmt.id })
      setOutputPath(out); setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setStatus('error')
    }
  }

  return (
    <>
      <Step number={1} label="Choose your PDF">
        {inputFile
          ? <FilePill path={inputFile} onRemove={() => setInputFile(null)} />
          : <DropZone hint="Drag & drop a PDF or click to browse" onFiles={([p]) => { setInputFile(p); addRecentFile(p) }} />}
      </Step>
      <Step number={2} label="Choose output format">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {formats.map(f => (
            <motion.button
              key={f.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => setFmt(f)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                background: fmt.id === f.id ? `${f.color}20` : 'rgba(255,255,255,0.06)',
                border: fmt.id === f.id ? `1px solid ${f.color}55` : '1px solid rgba(255,255,255,0.1)',
                color: fmt.id === f.id ? f.color : 'var(--text-secondary)',
                transition: 'all 0.15s', fontWeight: 500, fontSize: 13,
              }}
            >
              <span style={{ color: f.color }}>{f.icon}</span>{f.label}
            </motion.button>
          ))}
        </div>
      </Step>
      <ActionArea
        ready={!!inputFile && status === 'idle'} status={status} error={error} outputPath={outputPath}
        actionLabel={`Convert to ${fmt.label}`} onAction={run}
        onReset={() => { setStatus('idle'); setOutputPath(null) }}
      />
    </>
  )
}

// ── Merge ─────────────────────────────────────────────────────────────────────

function MergeTab() {
  const [files, setFiles] = useState<string[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const addFiles = (paths: string[]) => {
    paths.forEach(addRecentFile)
    setFiles(prev => [...prev, ...paths.filter(p => !prev.includes(p))])
  }

  const run = async () => {
    if (files.length < 2) return
    setStatus('running'); setError(null)
    const out = await window.electronAPI?.savePath('pdf')
    if (!out) { setStatus('idle'); return }
    try {
      await window.electronAPI?.pdfCommand('merge', { inputs: files, output: out })
      setOutputPath(out); setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setStatus('error')
    }
  }

  return (
    <>
      <Step number={1} label="Add PDFs to merge (in order)">
        <DropZone hint="Drag & drop PDFs or click to browse" multiple onFiles={addFiles} />
        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {files.map((f, i) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <FileText size={13} color="#6366f1" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{f.split(/[\\/]/).pop()}</span>
                <button onClick={() => setFiles(p => p.filter(x => x !== f))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </Step>
      <ActionArea
        ready={files.length >= 2 && status === 'idle'} status={status} error={error} outputPath={outputPath}
        actionLabel={files.length >= 2 ? `Merge ${files.length} PDFs into one` : 'Add at least 2 PDFs'}
        onAction={run} onReset={() => { setStatus('idle'); setOutputPath(null) }}
      />
    </>
  )
}

// ── Split ─────────────────────────────────────────────────────────────────────

function SplitTab() {
  const [inputFile, setInputFile] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [outputFiles, setOutputFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!inputFile) return
    setStatus('running'); setError(null)
    const outDir = await window.electronAPI?.selectDir()
    if (!outDir) { setStatus('idle'); return }
    try {
      const res = await window.electronAPI?.pdfCommand('split', { input: inputFile, output: outDir }) as { files: string[] }
      setOutputFiles(res.files); setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setStatus('error')
    }
  }

  return (
    <>
      <Step number={1} label="Choose PDF to split">
        {inputFile
          ? <FilePill path={inputFile} onRemove={() => { setInputFile(null); setStatus('idle') }} />
          : <DropZone hint="Drag & drop a PDF or click to browse" onFiles={([p]) => { setInputFile(p); addRecentFile(p) }} />}
      </Step>
      <AnimatePresence>
        {inputFile && status === 'idle' && (
          <motion.button key="btn" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={run}
            style={{ padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 30px rgba(99,102,241,0.35)' }}>
            Split into individual pages
          </motion.button>
        )}
        {status === 'running' && <RunningRow key="run" text="Splitting pages…" />}
        {status === 'done' && (
          <SuccessRow key="done" text={`Split into ${outputFiles.length} pages`}>
            <ShowBtn onClick={() => window.electronAPI?.showItem(outputFiles[0])} />
          </SuccessRow>
        )}
        {status === 'error' && <ErrorRow key="err" text={error} />}
      </AnimatePresence>
    </>
  )
}

// ── Compress ──────────────────────────────────────────────────────────────────

function CompressTab() {
  const [inputFile, setInputFile] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [sizes, setSizes] = useState<{ before_kb: number; after_kb: number } | null>(null)
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!inputFile) return
    setStatus('running'); setError(null)
    const out = await window.electronAPI?.savePath('pdf')
    if (!out) { setStatus('idle'); return }
    try {
      const res = await window.electronAPI?.pdfCommand('compress', { input: inputFile, output: out }) as { before_kb: number; after_kb: number }
      setSizes(res); setOutputPath(out); setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setStatus('error')
    }
  }

  const savedPct = sizes ? Math.max(0, Math.round((1 - sizes.after_kb / sizes.before_kb) * 100)) : 0

  return (
    <>
      <Step number={1} label="Choose PDF to compress">
        {inputFile
          ? <FilePill path={inputFile} onRemove={() => { setInputFile(null); setStatus('idle'); setSizes(null) }} />
          : <DropZone hint="Drag & drop a PDF or click to browse" onFiles={([p]) => { setInputFile(p); addRecentFile(p) }} />}
      </Step>
      <AnimatePresence>
        {inputFile && status === 'idle' && (
          <motion.button key="btn" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={run}
            style={{ padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 30px rgba(99,102,241,0.35)' }}>
            Compress PDF
          </motion.button>
        )}
        {status === 'running' && <RunningRow key="run" text="Compressing…" />}
        {status === 'done' && sizes && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <SizeStat label="Original"   value={`${sizes.before_kb} KB`} />
              <SizeStat label="Compressed" value={`${sizes.after_kb} KB`}  accent />
              <SizeStat label="Saved"      value={`${savedPct}%`}           highlight />
            </div>
            <SuccessRow text="Compression complete!">
              <ShowBtn onClick={() => window.electronAPI?.showItem(outputPath!)} />
            </SuccessRow>
          </motion.div>
        )}
        {status === 'error' && <ErrorRow key="err" text={error} />}
      </AnimatePresence>
    </>
  )
}

// ── Security ──────────────────────────────────────────────────────────────────

function SecurityTab() {
  const [mode, setMode] = useState<'protect' | 'unlock'>('protect')
  const [inputFile, setInputFile] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [outputPath, setOutputPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setInputFile(null); setPassword(''); setConfirmPw('')
    setStatus('idle'); setOutputPath(null); setError(null)
  }

  const switchMode = (m: 'protect' | 'unlock') => { setMode(m); reset() }

  const pwMismatch = mode === 'protect' && !!password && !!confirmPw && password !== confirmPw
  const canRun = !!inputFile && !!password && !pwMismatch && status === 'idle'

  const run = async () => {
    if (!canRun) return
    setStatus('running'); setError(null)
    const out = await window.electronAPI?.savePath('pdf')
    if (!out) { setStatus('idle'); return }
    try {
      await window.electronAPI?.pdfCommand(mode === 'protect' ? 'encrypt_pdf' : 'decrypt_pdf', {
        input: inputFile, output: out, password,
      })
      setOutputPath(out); setStatus('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setStatus('error')
    }
  }

  return (
    <>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {([['protect', 'Add Password', <Lock size={13} />], ['unlock', 'Remove Password', <Unlock size={13} />]] as const).map(([m, label, icon]) => (
          <button key={m} onClick={() => switchMode(m)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '10px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: mode === m ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
              border: mode === m ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.1)',
              color: mode === m ? '#a5b4fc' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            } as React.CSSProperties}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <Step number={1} label="Choose your PDF">
        {inputFile
          ? <FilePill path={inputFile} onRemove={() => setInputFile(null)} />
          : <DropZone hint="Drag & drop a PDF or click to browse" onFiles={([p]) => { setInputFile(p); addRecentFile(p) }} />}
      </Step>

      <Step number={2} label={mode === 'protect' ? 'Set a password' : 'Enter the current password'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PasswordInput value={password} onChange={setPassword} placeholder={mode === 'protect' ? 'New password…' : 'Current password…'} />
          {mode === 'protect' && (
            <PasswordInput value={confirmPw} onChange={setConfirmPw} placeholder="Confirm password…" />
          )}
          {pwMismatch && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>Passwords don't match</p>}
        </div>
      </Step>

      <ActionArea
        ready={canRun} status={status} error={error} outputPath={outputPath}
        actionLabel={mode === 'protect' ? 'Protect PDF' : 'Unlock PDF'}
        onAction={run} onReset={reset}
      />
    </>
  )
}

// ── Shared components ─────────────────────────────────────────────────────────

function DropZone({ hint, multiple, onFiles }: { hint: string; multiple?: boolean; onFiles: (paths: string[]) => void }) {
  const [drag, setDrag] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const paths = Array.from(e.dataTransfer.files)
      .filter(f => f.name.toLowerCase().endsWith('.pdf'))
      .map(f => (f as unknown as { path: string }).path)
      .filter(Boolean)
    if (paths.length) onFiles(multiple ? paths : [paths[0]])
  }

  const openDialog = async () => {
    const paths = await window.electronAPI?.openPDF()
    if (paths?.length) onFiles(multiple ? paths : [paths[0]])
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={openDialog}
      className="glass-sm"
      style={{
        borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
        border: drag ? '2px dashed rgba(99,102,241,0.8)' : '2px dashed rgba(255,255,255,0.1)',
        background: drag ? 'rgba(99,102,241,0.06)' : undefined, transition: 'all 0.2s',
      }}
    >
      <Upload size={24} color="#6366f1" style={{ display: 'block', margin: '0 auto 10px' }} />
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>{drag ? 'Drop here' : hint}</p>
    </div>
  )
}

function FilePill({ path, onRemove }: { path: string; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10 }}>
      <FileText size={16} color="#6366f1" />
      <span style={{ fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{path.split(/[\\/]/).pop()}</span>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Change</button>
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 40px 10px 14px', borderRadius: 9, fontSize: 14,
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
          color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
        }}
      />
      <button
        type="button" onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

function ActionArea({ ready, status, error, outputPath, actionLabel, onAction, onReset }: {
  ready: boolean; status: Status; error: string | null; outputPath: string | null
  actionLabel: string; onAction: () => void; onReset: () => void
}) {
  return (
    <AnimatePresence>
      {ready && (
        <motion.button key="btn" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onAction}
          style={{ padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 30px rgba(99,102,241,0.35)' }}>
          {actionLabel}
        </motion.button>
      )}
      {status === 'running' && <RunningRow key="run" text="Processing…" />}
      {status === 'done' && outputPath && (
        <SuccessRow key="done" text="Done!">
          <ShowBtn onClick={() => window.electronAPI?.showItem(outputPath)} />
          <button onClick={onReset} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 14px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
            Again
          </button>
        </SuccessRow>
      )}
      {status === 'error' && <ErrorRow key="err" text={error} />}
    </AnimatePresence>
  )
}

function Step({ number, label, children }: { number: number; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#6366f1', flexShrink: 0 }}>
          {number}
        </div>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
      </div>
      {children}
    </div>
  )
}

function RunningRow({ text }: { text: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: 'rgba(99,102,241,0.1)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.3)' }}>
      <Loader size={18} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
      <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{text}</span>
    </motion.div>
  )
}

function SuccessRow({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(34,197,94,0.1)', borderRadius: 12, border: '1px solid rgba(34,197,94,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <CheckCircle size={18} color="#22c55e" />
        <span style={{ fontSize: 14, color: '#22c55e', fontWeight: 500 }}>{text}</span>
      </div>
      {children && <div style={{ display: 'flex', gap: 8 }}>{children}</div>}
    </motion.div>
  )
}

function ErrorRow({ text }: { text: string | null }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', background: 'rgba(239,68,68,0.1)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)' }}>
      <AlertCircle size={18} color="#ef4444" />
      <span style={{ fontSize: 14, color: '#ef4444' }}>{text || 'Something went wrong'}</span>
    </motion.div>
  )
}

function ShowBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '6px 14px', color: '#22c55e', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
      Show in Explorer
    </button>
  )
}

function SizeStat({ label, value, accent, highlight }: { label: string; value: string; accent?: boolean; highlight?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '14px 16px', borderRadius: 10, textAlign: 'center',
      background: highlight ? 'rgba(99,102,241,0.15)' : accent ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.06)',
      border: `1px solid ${highlight ? 'rgba(99,102,241,0.3)' : accent ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight ? '#a5b4fc' : accent ? '#22c55e' : 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}
