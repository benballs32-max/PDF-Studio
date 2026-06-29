import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Wand2, ArrowRightLeft, Scissors, Merge, RotateCw,
  FileImage, FileType, FileSpreadsheet, Globe, Clock, X, Plus,
  ShieldCheck, Upload, Package, Columns, Settings, Bot,
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
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.055, duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

interface Tool {
  icon: React.ReactNode
  label: string
  description: string
  route: string
  color: string
  glow: string
}

interface CreateTool {
  icon: React.ReactNode
  label: string
  description: string
  route: string
  color: string
}

const tools: Tool[] = [
  {
    icon: <Wand2 size={19} />,
    label: 'Edit PDF',
    description: 'Annotate, redact, forms, OCR & more',
    route: '/editor',
    color: '#f43f5e',
    glow: 'rgba(244,63,94,0.28)',
  },
  {
    icon: <ArrowRightLeft size={19} />,
    label: 'Convert',
    description: 'PDF to Word, Excel, image & HTML',
    route: '/convert',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.28)',
  },
  {
    icon: <Merge size={19} />,
    label: 'Merge',
    description: 'Combine multiple PDFs into one',
    route: '/convert?tab=merge',
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.28)',
  },
  {
    icon: <Scissors size={19} />,
    label: 'Split',
    description: 'Extract pages into separate files',
    route: '/convert?tab=split',
    color: '#f97316',
    glow: 'rgba(249,115,22,0.28)',
  },
  {
    icon: <RotateCw size={19} />,
    label: 'Compress',
    description: 'Shrink file size, preserve quality',
    route: '/convert?tab=compress',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.28)',
  },
  {
    icon: <ShieldCheck size={19} />,
    label: 'Protect',
    description: 'Password-protect or unlock PDFs',
    route: '/convert?tab=security',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.28)',
  },
  {
    icon: <Package size={19} />,
    label: 'Batch',
    description: 'Process an entire folder at once',
    route: '/batch',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.28)',
  },
  {
    icon: <Columns size={19} />,
    label: 'Compare',
    description: 'Side-by-side diff of two PDFs',
    route: '/compare',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.28)',
  },
  {
    icon: <Bot size={19} />,
    label: 'AI Studio',
    description: 'Chat, analyse, search & extract with AI',
    route: '/ai-studio',
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.32)',
  },
]

const createTools: CreateTool[] = [
  {
    icon: <FileImage size={18} />,
    label: 'Images → PDF',
    description: 'PNG, JPG, BMP, TIFF, WebP',
    route: '/import?tab=images',
    color: '#f59e0b',
  },
  {
    icon: <FileType size={18} />,
    label: 'Office → PDF',
    description: 'Word, Excel, PowerPoint',
    route: '/import?tab=office',
    color: '#3b82f6',
  },
  {
    icon: <Globe size={18} />,
    label: 'Web → PDF',
    description: 'Capture any webpage as PDF',
    route: '/import?tab=web',
    color: '#10b981',
  },
]

const formats = [
  { icon: <FileType size={12} />, label: 'Word', color: '#60a5fa' },
  { icon: <FileSpreadsheet size={12} />, label: 'Excel', color: '#34d399' },
  { icon: <FileImage size={12} />, label: 'PNG / JPG', color: '#fbbf24' },
  { icon: <Globe size={12} />, label: 'HTML', color: '#fb923c' },
  { icon: <FileText size={12} />, label: 'Plain Text', color: '#94a3b8' },
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
    <div style={{ height: '100%', overflowY: 'auto', padding: '30px 36px', display: 'flex', flexDirection: 'column', gap: 26, position: 'relative' }}>

      {/* Decorative background glows */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: -140, right: -100, width: 520, height: 520, background: 'radial-gradient(circle, rgba(244,63,94,0.16) 0%, transparent 68%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -80, left: -80, width: 460, height: 460, background: 'radial-gradient(circle, rgba(59,130,246,0.13) 0%, transparent 68%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '45%', left: '35%', width: 360, height: 360, background: 'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      {/* All content sits above glows */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 26 }}>

        {/* ── Hero ── */}
        <motion.div initial="hidden" animate="show" custom={0} variants={fadeUp}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="glass-pill"><FileText size={11} /> PDF Studio</span>
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }} onClick={() => navigate('/settings')}
              title="Settings"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>
              <Settings size={13} /> Settings
            </motion.button>
          </div>
          <h1 style={{
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.08,
            marginBottom: 14,
            background: 'linear-gradient(135deg, #ffffff 0%, #fda4af 30%, #c084fc 62%, #93c5fd 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Everything PDF.<br />Done beautifully.
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', maxWidth: 400, lineHeight: 1.65 }}>
            Edit, convert, redact and compress — locally on your machine, no uploads.
          </p>
        </motion.div>

        {/* ── CTA buttons ── */}
        <motion.div initial="hidden" animate="show" custom={1} variants={fadeUp} style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <HeroBtn primary onClick={() => navigate('/editor')}><Upload size={14} /> Open PDF</HeroBtn>
          <HeroBtn onClick={() => navigate('/convert')}><ArrowRightLeft size={14} /> Convert</HeroBtn>
          <HeroBtn onClick={() => navigate('/import')}><Plus size={14} /> Create PDF</HeroBtn>
        </motion.div>

        {/* ── 2-column: tool grid + recent files ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 268px', gap: 16, alignItems: 'start' }}>

          {/* Tool grid */}
          <div>
            <SectionLabel label="Tools" index={2} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
              {tools.map((tool, i) => (
                <ToolCard key={tool.label} tool={tool} index={i + 3} onClick={() => navigate(tool.route)} />
              ))}
            </div>
          </div>

          {/* Recent files */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <SectionLabel label="Recent" index={3} icon={<Clock size={10} />} />
              {recent.length > 0 && (
                <motion.button initial="hidden" animate="show" custom={3} variants={fadeUp}
                  onClick={() => { clearRecentFiles(); setRecent([]) }}
                  style={{ background: 'none', border: 'none', fontSize: 11, color: 'rgba(255,255,255,0.28)', cursor: 'pointer', marginBottom: 10 }}>
                  Clear all
                </motion.button>
              )}
            </div>

            {recent.length === 0 ? (
              <motion.div initial="hidden" animate="show" custom={4} variants={fadeUp}
                style={{ borderRadius: 12, padding: '22px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.22)', fontSize: 12, lineHeight: 1.7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <FileText size={20} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.25 }} />
                No recent files yet.<br />Open a PDF to get started.
              </motion.div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {recent.map((f, i) => (
                  <motion.div
                    key={f.path}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + i * 0.05 }}
                    onClick={() => openRecent(f.path)}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 10, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', transition: 'background 0.15s, border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.borderColor = 'rgba(244,63,94,0.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(244,63,94,0.14)', border: '1px solid rgba(244,63,94,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={12} color="#f43f5e" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.82)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>{relativeTime(f.openedAt)}</div>
                    </div>
                    <button onClick={e => deleteRecent(f.path, e)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', padding: 2, display: 'flex', flexShrink: 0, lineHeight: 0 }}>
                      <X size={10} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Create PDF ── */}
        <div>
          <SectionLabel label="Create PDF" index={9} icon={<Plus size={10} />} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
            {createTools.map((tool, i) => (
              <CreateCard key={tool.label} tool={tool} index={i + 10} onClick={() => navigate(tool.route)} />
            ))}
          </div>
        </div>

        {/* ── Export formats strip ── */}
        <motion.div initial="hidden" animate="show" custom={13} variants={fadeUp}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.25)', flexShrink: 0, marginRight: 2 }}>
            Export to
          </span>
          {formats.map(f => (
            <div key={f.label}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: f.color, fontWeight: 500 }}>
              {f.icon} {f.label}
            </div>
          ))}
        </motion.div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ label, index, icon }: { label: string; index: number; icon?: React.ReactNode }) {
  return (
    <motion.p
      initial="hidden" animate="show" custom={index} variants={fadeUp}
      style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}
    >
      {icon}{label}
    </motion.p>
  )
}

function ToolCard({ tool, index, onClick }: { tool: Tool; index: number; onClick: () => void }) {
  return (
    <motion.button
      initial="hidden" animate="show" custom={index} variants={fadeUp}
      onClick={onClick}
      whileHover={{ y: -5, scale: 1.025 }}
      whileTap={{ scale: 0.975 }}
      style={{
        borderRadius: 16, padding: '17px 16px',
        textAlign: 'left', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 13,
        background: `linear-gradient(150deg, ${tool.color}12 0%, rgba(255,255,255,0.025) 70%)`,
        border: `1px solid ${tool.color}25`,
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        transition: 'border-color 0.22s, box-shadow 0.22s, background 0.22s, transform 0.22s',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.08)`,
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${tool.color}55`
        e.currentTarget.style.background = `linear-gradient(150deg, ${tool.color}1e 0%, rgba(255,255,255,0.045) 70%)`
        e.currentTarget.style.boxShadow = `0 18px 52px ${tool.glow}, 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.14)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = `${tool.color}25`
        e.currentTarget.style.background = `linear-gradient(150deg, ${tool.color}12 0%, rgba(255,255,255,0.025) 70%)`
        e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.08)`
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
        background: `linear-gradient(145deg, ${tool.color}38, ${tool.color}18)`,
        border: `1px solid ${tool.color}45`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: tool.color,
        boxShadow: `0 4px 16px ${tool.color}30, inset 0 1px 0 ${tool.color}35`,
      }}>
        {tool.icon}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,0.92)', marginBottom: 4, letterSpacing: '-0.01em' }}>{tool.label}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>{tool.description}</div>
      </div>
    </motion.button>
  )
}

function CreateCard({ tool, index, onClick }: { tool: CreateTool; index: number; onClick: () => void }) {
  return (
    <motion.button
      initial="hidden" animate="show" custom={index} variants={fadeUp}
      onClick={onClick}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      style={{
        borderRadius: 12,
        padding: '13px 14px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.09)'
        e.currentTarget.style.borderColor = `${tool.color}44`
        e.currentTarget.style.boxShadow = `0 4px 20px ${tool.color}22`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${tool.color}1c`,
        border: `1px solid ${tool.color}32`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: tool.color, flexShrink: 0,
      }}>
        {tool.icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.label}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.35 }}>{tool.description}</div>
      </div>
    </motion.button>
  )
}

function HeroBtn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05, y: -1 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '10px 22px', borderRadius: 11, cursor: 'pointer',
        fontSize: 13, fontWeight: 600,
        background: primary
          ? 'linear-gradient(135deg, #f43f5e 0%, #c026d3 50%, #7c3aed 100%)'
          : 'rgba(255,255,255,0.09)',
        border: primary
          ? '1px solid rgba(244,63,94,0.45)'
          : '1px solid rgba(255,255,255,0.15)',
        color: 'white',
        boxShadow: primary ? '0 4px 22px rgba(244,63,94,0.38)' : 'none',
      }}
    >
      {children}
    </motion.button>
  )
}
