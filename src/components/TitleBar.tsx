import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  const api = window.electronAPI

  return (
    <div
      className="glass-sm"
      style={{
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        WebkitAppRegion: 'drag' as never,
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        flexShrink: 0,
        position: 'relative',
        zIndex: 100,
      } as React.CSSProperties}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
        PDF Studio
      </span>

      <div
        style={{ display: 'flex', gap: 8, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {[
          { icon: <Minus size={12} />, action: () => api?.minimize(), color: '#f59e0b' },
          { icon: <Square size={10} />, action: () => api?.maximize(), color: '#22c55e' },
          { icon: <X size={12} />, action: () => api?.close(), color: '#ef4444' },
        ].map(({ icon, action, color }, i) => (
          <button
            key={i}
            onClick={action}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: `1px solid ${color}55`,
              background: `${color}22`,
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = `${color}44`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = `${color}22`)}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}
