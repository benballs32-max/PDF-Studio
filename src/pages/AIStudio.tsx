import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, FileSearch, MessageSquare, Search, BookMarked, Tag,
  Loader2, Send, RotateCcw, FileText, Download, Settings,
  AlertTriangle, Calendar, DollarSign, Users, Sparkles, Table2,
  CheckCircle2, Plus, X,
} from 'lucide-react'
import { askAI, hasAIConfigured, truncateForContext, type AIMessage } from '../utils/ai'
import { getSettings, defaultModel } from '../utils/settings'

type ToolId = 'contract' | 'chat' | 'search' | 'tables' | 'bookmarks' | 'rename'

const TOOLS: { id: ToolId; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: 'contract',  label: 'Contract Analysis', sub: 'Parties, dates, obligations & red flags',  icon: <FileSearch size={15} /> },
  { id: 'chat',      label: 'Document Chat',      sub: 'Ask questions across multiple PDFs',       icon: <MessageSquare size={15} /> },
  { id: 'search',    label: 'Semantic Search',    sub: 'Find by meaning, not exact words',          icon: <Search size={15} /> },
  { id: 'tables',    label: 'Table Extractor',    sub: 'Pull tables out as CSV',                    icon: <Table2 size={15} /> },
  { id: 'bookmarks', label: 'Auto Bookmarks',     sub: 'AI-generated document outline',             icon: <BookMarked size={15} /> },
  { id: 'rename',    label: 'AI Rename',          sub: 'Suggest descriptive filenames',             icon: <Tag size={15} /> },
]

async function extractText(file: string): Promise<string> {
  const res = await window.electronAPI?.pdfCommand('extract_text_full', { input: file }) as { full_text: string }
  return res.full_text
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function FilePicker({ files, multi, onAdd, onRemove }: {
  files: string[]; multi: boolean; onAdd: (p: string[]) => void; onRemove: (p: string) => void
}) {
  const pick = async () => {
    const paths = await window.electronAPI?.openFiles([{ name: 'PDF', extensions: ['pdf'] }], multi)
    if (paths?.length) onAdd(paths)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {files.map(f => (
        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <FileText size={13} color="#818cf8" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#c7d2fe' }}>{f.split(/[\\/]/).pop()}</span>
          <button onClick={() => onRemove(f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}><X size={11} /></button>
        </div>
      ))}
      <button onClick={pick} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
        <Plus size={13} /> {files.length ? (multi ? 'Add another PDF' : 'Change PDF') : 'Select PDF'}
      </button>
    </div>
  )
}

function AiBtn({ onClick, loading, disabled, children }: {
  onClick: () => void; loading: boolean; disabled?: boolean; children: React.ReactNode
}) {
  const off = disabled || loading
  return (
    <motion.button whileHover={!off ? { scale: 1.02 } : {}} whileTap={!off ? { scale: 0.97 } : {}}
      onClick={onClick} disabled={off}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 9, border: `1px solid ${off ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.5)'}`, background: off ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.2)', color: off ? 'var(--text-muted)' : '#a5b4fc', cursor: off ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}>
      {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
      {children}
    </motion.button>
  )
}

function ErrBox({ msg }: { msg: string }) {
  return <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: 12, lineHeight: 1.5 }}>{msg}</div>
}

function ResultCard({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${color}33`, background: `${color}11`, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color, marginBottom: 8, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{icon} {title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
    </div>
  )
}

// ── Contract Analysis ─────────────────────────────────────────────────────────

interface ContractAnalysis {
  document_type: string; parties: string[]
  key_dates: { date: string; description: string }[]
  monetary_values: { amount: string; context: string }[]
  obligations: string[]; red_flags: string[]; summary: string
}

function ContractTool() {
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ContractAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyse = async () => {
    if (!files[0]) return
    setLoading(true); setError(null); setResult(null)
    try {
      const text = await extractText(files[0])
      const sys = `You are a legal and business document analyst. Return ONLY a JSON object — no markdown, no explanation:
{"document_type":"string","parties":["string"],"key_dates":[{"date":"string","description":"string"}],"monetary_values":[{"amount":"string","context":"string"}],"obligations":["string"],"red_flags":["string"],"summary":"2-3 sentence overview"}`
      const raw = await askAI([{ role: 'user', content: truncateForContext(text) }], sys)
      setResult(JSON.parse(raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')))
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilePicker files={files} multi={false} onAdd={p => { setFiles([p[0]]); setResult(null) }} onRemove={() => { setFiles([]); setResult(null) }} />
      <AiBtn onClick={analyse} loading={loading} disabled={!files[0]}>Analyse Document</AiBtn>
      {error && <ErrBox msg={error} />}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#a5b4fc', fontSize: 12, fontWeight: 700 }}>{result.document_type}</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)' }}>{result.summary}</p>
          {result.parties.length > 0 && <ResultCard icon={<Users size={13} />} title="Parties" color="#818cf8">{result.parties.map((p, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• {p}</div>)}</ResultCard>}
          {result.key_dates.length > 0 && <ResultCard icon={<Calendar size={13} />} title="Key Dates" color="#34d399">{result.key_dates.map((d, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}><span style={{ color: '#6ee7b7', fontWeight: 600 }}>{d.date}</span> — {d.description}</div>)}</ResultCard>}
          {result.monetary_values.length > 0 && <ResultCard icon={<DollarSign size={13} />} title="Monetary Values" color="#fbbf24">{result.monetary_values.map((m, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}><span style={{ color: '#fde68a', fontWeight: 600 }}>{m.amount}</span> — {m.context}</div>)}</ResultCard>}
          {result.obligations.length > 0 && <ResultCard icon={<CheckCircle2 size={13} />} title="Key Obligations" color="#60a5fa">{result.obligations.map((o, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>• {o}</div>)}</ResultCard>}
          {result.red_flags.length > 0 && <ResultCard icon={<AlertTriangle size={13} />} title="Red Flags" color="#f87171">{result.red_flags.map((f, i) => <div key={i} style={{ fontSize: 12, color: '#fca5a5' }}>⚠ {f}</div>)}</ResultCard>}
        </div>
      )}
    </div>
  )
}

// ── Document Chat ─────────────────────────────────────────────────────────────

function ChatTool() {
  const [files, setFiles] = useState<string[]>([])
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cachedText, setCachedText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const buildContext = async () => {
    if (cachedText) return cachedText
    const parts = await Promise.all(files.map(async f => {
      const t = await extractText(f); return `=== ${f.split(/[\\/]/).pop()} ===\n${truncateForContext(t, 25000)}`
    }))
    const combined = parts.join('\n\n')
    setCachedText(combined); return combined
  }

  const send = async () => {
    const content = input.trim(); if (!content || loading || !files.length) return
    setInput('')
    const updated: AIMessage[] = [...messages, { role: 'user', content }]
    setMessages(updated); setLoading(true); setError(null)
    try {
      const ctx = await buildContext()
      const reply = await askAI(updated, `You are a helpful assistant answering questions about PDF documents. Base all answers on the document text provided.\n\nDocuments:\n\n${ctx}`)
      setMessages(m => [...m, { role: 'assistant', content: reply }])
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '0 0 16px', flexShrink: 0 }}>
        <FilePicker files={files} multi onAdd={p => { setFiles(prev => [...prev, ...p.filter(x => !prev.includes(x))]); setCachedText('') }} onRemove={p => { setFiles(prev => prev.filter(x => x !== p)); setCachedText('') }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {messages.length === 0 && !loading && <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 32 }}>{files.length ? 'Ask anything about your documents.' : 'Add PDFs above, then start chatting.'}</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ padding: '9px 13px', borderRadius: 10, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: m.role === 'user' ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.06)', border: `1px solid ${m.role === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`, color: m.role === 'user' ? '#c7d2fe' : 'var(--text-primary)', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%' }}>
            {m.content}
          </div>
        ))}
        {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-muted)', fontSize: 12 }}><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />Thinking…</div>}
        {error && <ErrBox msg={error} />}
        <div ref={endRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {messages.length > 0 && <button onClick={() => { setMessages([]); setError(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px', display: 'flex', alignItems: 'center' }}><RotateCcw size={14} /></button>}
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} disabled={!files.length} placeholder={files.length ? 'Ask a question… (Enter)' : 'Add PDFs first'}
          style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '9px 13px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
        <button onClick={send} disabled={!input.trim() || loading || !files.length}
          style={{ padding: '9px 14px', borderRadius: 9, border: 'none', background: input.trim() && files.length && !loading ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)', color: input.trim() && files.length && !loading ? '#a5b4fc' : 'var(--text-muted)', cursor: input.trim() && files.length && !loading ? 'pointer' : 'default', display: 'flex' }}>
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Semantic Search ───────────────────────────────────────────────────────────

interface SearchResult { passage: string; page: string; relevance: string; file: string }

function SearchTool() {
  const [files, setFiles] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    if (!query.trim() || !files.length) return
    setLoading(true); setError(null); setResults(null)
    try {
      const parts = await Promise.all(files.map(async f => ({ name: f.split(/[\\/]/).pop() ?? f, text: await extractText(f) })))
      const docsStr = parts.map(p => `=== ${p.name} ===\n${truncateForContext(p.text, 20000)}`).join('\n\n')
      const sys = `Find the most relevant passages in the documents for the given query. Return ONLY a JSON array (no markdown): [{"passage":"exact quote","page":"page number or unknown","relevance":"one sentence why relevant","file":"filename"}]. Up to 6 results. If nothing relevant, return [].`
      const raw = await askAI([{ role: 'user', content: `Query: "${query}"\n\n${docsStr}` }], sys)
      setResults(JSON.parse(raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')))
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilePicker files={files} multi onAdd={p => { setFiles(prev => [...prev, ...p.filter(x => !prev.includes(x))]) }} onRemove={p => setFiles(prev => prev.filter(x => x !== p))} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search() }}
          placeholder="e.g. 'liability clauses', 'payment terms', 'cancellation policy'"
          style={{ flex: 1, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, padding: '9px 13px', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
        <AiBtn onClick={search} loading={loading} disabled={!query.trim() || !files.length}>Search</AiBtn>
      </div>
      {error && <ErrBox msg={error} />}
      {results !== null && results.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No relevant passages found for that query.</div>}
      {results?.map((r, i) => (
        <div key={i} style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>{r.file}</span>
            {r.page !== 'unknown' && <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: 10 }}>p. {r.page}</span>}
          </div>
          <p style={{ margin: '0 0 7px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>"{r.passage}"</p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>{r.relevance}</p>
        </div>
      ))}
    </div>
  )
}

// ── Table Extractor ───────────────────────────────────────────────────────────

interface ExtractedTable { page: number; table_index: number; rows: number; cols: number; data: string[][] }

function TableTool() {
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [tables, setTables] = useState<ExtractedTable[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const extract = async () => {
    if (!files[0]) return
    setLoading(true); setError(null); setTables(null)
    try {
      const res = await window.electronAPI?.pdfCommand('extract_tables', { input: files[0] }) as { tables: ExtractedTable[] }
      setTables(res.tables)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }

  const downloadCsv = (t: ExtractedTable) => {
    const csv = t.data.map(row => row.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `table_p${t.page}_${t.table_index}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilePicker files={files} multi={false} onAdd={p => { setFiles([p[0]]); setTables(null) }} onRemove={() => { setFiles([]); setTables(null) }} />
      <AiBtn onClick={extract} loading={loading} disabled={!files[0]}>Extract Tables</AiBtn>
      {error && <ErrBox msg={error} />}
      {tables !== null && tables.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No tables found in this PDF.</div>}
      {tables !== null && tables.length > 0 && <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{tables.length} table{tables.length !== 1 ? 's' : ''} found</div>}
      {tables?.map((t, i) => (
        <div key={i} style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Page {t.page} · Table {t.table_index} · {t.rows}×{t.cols}</span>
            <button onClick={() => downloadCsv(t)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>
              <Download size={11} /> CSV
            </button>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 240 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
              <tbody>
                {t.data.slice(0, 10).map((row, ri) => (
                  <tr key={ri} style={{ background: ri === 0 ? 'rgba(99,102,241,0.1)' : ri % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{ padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: ri === 0 ? '#a5b4fc' : 'var(--text-secondary)', fontWeight: ri === 0 ? 600 : 400, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cell ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {t.rows > 10 && <div style={{ padding: '5px 12px', fontSize: 11, color: 'var(--text-muted)' }}>+{t.rows - 10} more rows in download</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Auto Bookmarks ────────────────────────────────────────────────────────────

interface BookmarkEntry { level: number; title: string; page: number }

function BookmarksTool() {
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)

  const generate = async () => {
    if (!files[0]) return
    setLoading(true); setError(null); setBookmarks(null); setApplied(false)
    try {
      const text = await extractText(files[0])
      const sys = `Analyse the document structure and create a table of contents. Return ONLY a JSON array (no markdown): [{"level":1,"title":"Section Title","page":1}]. Level 1 = top-level chapters, 2 = sections, 3 = subsections. Pages are integers starting from 1. Only include headings that genuinely exist in the document.`
      const raw = await askAI([{ role: 'user', content: truncateForContext(text) }], sys)
      setBookmarks(JSON.parse(raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')))
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }

  const apply = async () => {
    if (!files[0] || !bookmarks?.length) return
    const outPath = await window.electronAPI?.savePath('pdf')
    if (!outPath) return
    setApplying(true)
    try {
      await window.electronAPI?.pdfCommand('set_bookmarks', { input: files[0], output: outPath, toc: bookmarks })
      setApplied(true)
      window.electronAPI?.showItem(outPath)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setApplying(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilePicker files={files} multi={false} onAdd={p => { setFiles([p[0]]); setBookmarks(null); setApplied(false) }} onRemove={() => { setFiles([]); setBookmarks(null); setApplied(false) }} />
      <AiBtn onClick={generate} loading={loading} disabled={!files[0]}>Generate Bookmarks</AiBtn>
      {error && <ErrBox msg={error} />}
      {bookmarks !== null && bookmarks.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Could not identify a clear structure in this document.</div>}
      {bookmarks !== null && bookmarks.length > 0 && (
        <>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{bookmarks.length} entries — review then apply</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto' }}>
            {bookmarks.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 6 }} >
                <span style={{ display: 'inline-block', width: (b.level - 1) * 16, flexShrink: 0 }} />
                <span style={{ fontSize: 12, flex: 1, color: b.level === 1 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: b.level === 1 ? 600 : 400 }}>{b.title}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>p.{b.page}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <motion.button whileHover={{ scale: 1.02 }} onClick={apply} disabled={applying}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.15)', color: '#6ee7b7', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {applying ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={13} />}
              Apply to PDF
            </motion.button>
            {applied && <span style={{ fontSize: 13, color: '#34d399', display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={13} /> Saved</span>}
          </div>
        </>
      )}
    </div>
  )
}

// ── AI Rename ─────────────────────────────────────────────────────────────────

interface RenameSuggestion { path: string; original: string; suggested: string; status: 'pending' | 'done' | 'error' }

function RenameTool() {
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<RenameSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)

  const suggest = async () => {
    if (!files.length) return
    setLoading(true); setError(null); setSuggestions([])
    try {
      const results = await Promise.all(files.map(async f => {
        const res = await window.electronAPI?.pdfCommand('extract_text_full', { input: f }) as { full_text: string }
        const reply = await askAI(
          [{ role: 'user', content: `Document text (first 3000 chars):\n${res.full_text.slice(0, 3000)}` }],
          'Suggest a clear, descriptive filename for this PDF. Return ONLY the filename without extension — max 60 chars, no special characters except hyphens and underscores. Examples: "Q3-2024-Financial-Report", "Employment-Contract-John-Smith", "Product-Spec-v2"'
        )
        const safe = reply.trim().replace(/[<>:"/\\|?*]/g, '-').replace(/\.pdf$/i, '').slice(0, 60)
        return { path: f, original: f.split(/[\\/]/).pop() ?? f, suggested: safe + '.pdf', status: 'pending' as const }
      }))
      setSuggestions(results)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }

  const applyRename = async (s: RenameSuggestion) => {
    const dir = s.path.includes('\\') ? s.path.split('\\').slice(0, -1).join('\\') : s.path.split('/').slice(0, -1).join('/')
    const sep = s.path.includes('\\') ? '\\' : '/'
    const newPath = dir + sep + s.suggested
    try {
      await window.electronAPI?.renameFile(s.path, newPath)
      setSuggestions(prev => prev.map(x => x.path === s.path ? { ...x, status: 'done', path: newPath } : x))
    } catch (e) {
      setSuggestions(prev => prev.map(x => x.path === s.path ? { ...x, status: 'error' } : x))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilePicker files={files} multi onAdd={p => { setFiles(prev => [...prev, ...p.filter(x => !prev.includes(x))]); setSuggestions([]) }} onRemove={p => { setFiles(prev => prev.filter(x => x !== p)); setSuggestions(prev => prev.filter(s => s.path !== p)) }} />
      <AiBtn onClick={suggest} loading={loading} disabled={!files.length}>Suggest Names</AiBtn>
      {error && <ErrBox msg={error} />}
      {suggestions.map((s, i) => (
        <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.07em', marginBottom: 3 }}>Current</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.original}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#34d399', letterSpacing: '0.07em', marginBottom: 3 }}>Suggested</div>
            <div style={{ fontSize: 13, color: '#6ee7b7', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.suggested}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {s.status === 'pending' && (
              <motion.button whileHover={{ scale: 1.02 }} onClick={() => applyRename(s)}
                style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.12)', color: '#6ee7b7', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Rename
              </motion.button>
            )}
            {s.status === 'done' && <span style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Renamed</span>}
            {s.status === 'error' && <span style={{ fontSize: 12, color: '#f87171' }}>Rename failed — file may be open elsewhere</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main AI Studio page ───────────────────────────────────────────────────────

export default function AIStudio() {
  const navigate = useNavigate()
  const [activeTool, setActiveTool] = useState<ToolId>('contract')
  const s = getSettings()
  const modelLabel = s.model || defaultModel(s.provider)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 16, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>
          <ArrowLeft size={14} /> Back
        </motion.button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>AI Studio</h2>
            {hasAIConfigured()
              ? <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399', fontWeight: 600 }}>{s.provider} · {modelLabel}</span>
              : <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', fontWeight: 600 }}>No AI configured</span>
            }
          </div>
        </div>
        {!hasAIConfigured() && (
          <motion.button whileHover={{ scale: 1.04 }} onClick={() => navigate('/settings')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            <Settings size={13} /> Configure AI
          </motion.button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', gap: 14, overflow: 'hidden' }}>
        {/* Tool list */}
        <div className="glass" style={{ width: 220, borderRadius: 14, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0, overflowY: 'auto' }}>
          {TOOLS.map(t => (
            <motion.button key={t.id} onClick={() => setActiveTool(t.id)} whileHover={{ scale: 1.01 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, border: `1px solid ${activeTool === t.id ? 'rgba(99,102,241,0.45)' : 'transparent'}`, background: activeTool === t.id ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ color: activeTool === t.id ? '#a5b4fc' : 'var(--text-muted)', flexShrink: 0 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: activeTool === t.id ? '#c7d2fe' : 'var(--text-primary)' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.3 }}>{t.sub}</div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Tool content — all rendered, inactive ones hidden to preserve state */}
        <div className="glass" style={{ flex: 1, borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {TOOLS.map(t => {
            const active = activeTool === t.id
            return (
              <div key={t.id} style={{ display: active ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#818cf8' }}>{t.icon}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{t.label}</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{t.sub}</p>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                  {t.id === 'contract'  && <ContractTool />}
                  {t.id === 'chat'      && <ChatTool />}
                  {t.id === 'search'    && <SearchTool />}
                  {t.id === 'tables'    && <TableTool />}
                  {t.id === 'bookmarks' && <BookmarksTool />}
                  {t.id === 'rename'    && <RenameTool />}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
