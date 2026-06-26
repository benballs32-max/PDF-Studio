import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Wand2, ArrowRightLeft, Scissors, Merge, RotateCw,
  FileImage, FileType, FileSpreadsheet, Globe, ChevronRight, Clock, X,
} from 'lucide-react'
import { getRecentFiles, addRecentFile, removeRecentFile, clearRecentFiles, type RecentFile } from '../utils/recentFiles'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const tools = [
  {
    icon: <Wand2 size={22} />,
    label: 'Edit PDF',
    description: 'Annotate, reorder pages, add text & images',
    route: '/editor',
    color: '#6366f1',
  },
  {
    icon: <ArrowRightLeft size={22} />,
    label: 'Convert',
    description: 'Transform to Word, Excel, image, HTML & more',
    route: '/convert',
    color: '#8b5cf6',
  },
  {
    icon: <Merge size={22} />,
    label: 'Merge PDFs',
    description: 'Combine multiple PDFs into one document',
    route: '/convert?tab=merge',
    color: '#06b6d4',
  },
  {
    icon: <Scissors size={22} />,
    label: 'Split PDF',
    description: 'Extract pages or split into separate files',
    route: '/convert?tab=split',
    color: '#f59e0b',
  },
  {
    icon: <RotateCw size={22} />,
    label: 'Compress',
    description: 'Reduce file size while preserving quality',
    route: '/convert?tab=compress',
    color: '#22c55e',
  },
  {
    icon: <FileText size={22} />,
    label: 'PDF to Text',
    description: 'Extract all text content from your PDF',
    route: '/convert',
    color: '#ec4899',
  },
]

const conversions = [
  { icon: <FileType size={16} />, label: 'Word (.docx)', color: '#2b7cd3' },
  { icon: <FileSpreadsheet size={16} />, label: 'Excel (.xlsx)', color: '#217346' },
  { icon: <FileImage size={16} />, label: 'PNG / JPG', color: '#f59e0b' },
  { icon: <Globe size={16} />, label: 'HTML', color: '#f97316' },
  { icon: <FileText size={16} />, label: 'Plain Text', color: '#94a3b8' },
  { icon: <FileText size={16} />, label: 'Markdown', color: '#a5b4fc' },
]

export default function Home() {
  const navigate = useNavigate()
  const [recent, setRecent] = useState<RecentFile[]>(getRecentFiles)

  const openRecent = (path: string) => {
    addRecentFile(path)
    navigate('/editor', { state: { file: path } })
  }

  const deleteRecent = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeRecentFile(path)
    setRecent(getRecentFiles())
  }

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      padding: '32px 40px',
      display: 'flex',
      flexDirection: 'column',
      gap: 32,
    }}>

      {/* Hero */}
      <motion.div
        initial="hidden"
        animate="show"
        custom={0}
        variants={fadeUp}
        style={{ textAlign: 'center', paddingBottom: 8 }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="glass-pill">
            <FileText size={11} />
            PDF Studio
          </span>
        </div>
        <h1 style={{
          fontSize: 48,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 50%, #c4b5fd 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 14,
        }}>
          Everything for your PDFs.<br />All in one place.
        </h1>
        <p style={{ fontSize: 17, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto' }}>
          Edit, convert, merge, split and compress PDF files — beautifully and locally.
        </p>
      </motion.div>

      {/* Quick open CTA */}
      <motion.div
        initial="hidden"
        animate="show"
        custom={1}
        variants={fadeUp}
        style={{ display: 'flex', justifyContent: 'center', gap: 12 }}
      >
        <OpenButton primary onClick={() => navigate('/editor')}>
          <FileText size={16} /> Open PDF
        </OpenButton>
        <OpenButton onClick={() => navigate('/convert')}>
          <ArrowRightLeft size={16} /> Convert
        </OpenButton>
      </motion.div>

      {/* Tool cards grid */}
      <div>
        <motion.p
          initial="hidden" animate="show" custom={2} variants={fadeUp}
          style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}
        >
          Tools
        </motion.p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {tools.map((tool, i) => (
            <ToolCard key={tool.label} tool={tool} index={i + 3} onClick={() => navigate(tool.route)} />
          ))}
        </div>
      </div>

      {/* Recent files */}
      {recent.length > 0 && (
        <motion.div initial="hidden" animate="show" custom={9} variants={fadeUp}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={12} /> Recent
            </p>
            <button
              onClick={() => { clearRecentFiles(); setRecent([]) }}
              style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              Clear all
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {recent.map((f, i) => (
              <motion.div
                key={f.path}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => openRecent(f.path)}
                className="glass-hover"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <FileText size={14} color="#6366f1" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{f.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{relativeTime(f.openedAt)}</span>
                <button
                  onClick={e => deleteRecent(f.path, e)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0, opacity: 0.6 }}
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Conversion formats strip */}
      <motion.div
        initial="hidden" animate="show" custom={10} variants={fadeUp}
        className="glass glass-shimmer"
        style={{ borderRadius: 16, padding: '20px 24px' }}
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, fontWeight: 500 }}>
          Supported output formats
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {conversions.map((c) => (
            <div
              key={c.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: 13, color: c.color, fontWeight: 500,
              }}
            >
              {c.icon} {c.label}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function ToolCard({ tool, index, onClick }: {
  tool: typeof tools[0]; index: number; onClick: () => void
}) {
  return (
    <motion.button
      initial="hidden"
      animate="show"
      custom={index}
      variants={fadeUp}
      onClick={onClick}
      className="glass glass-hover glass-shimmer"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        borderRadius: 16,
        padding: '20px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: undefined,
        border: undefined,
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: `${tool.color}22`,
        border: `1px solid ${tool.color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: tool.color,
      }}>
        {tool.icon}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4 }}>
          {tool.label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {tool.description}
        </div>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--text-muted)', marginTop: 'auto', alignSelf: 'flex-end' }} />
    </motion.button>
  )
}

function OpenButton({ children, onClick, primary }: {
  children: React.ReactNode; onClick: () => void; primary?: boolean
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 24px', borderRadius: 12, cursor: 'pointer',
        fontSize: 15, fontWeight: 600,
        background: primary ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.1)',
        border: primary ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.2)',
        color: 'white',
        boxShadow: primary ? '0 0 30px rgba(99,102,241,0.4)' : 'none',
        backdropFilter: 'blur(12px)',
      }}
    >
      {children}
    </motion.button>
  )
}
