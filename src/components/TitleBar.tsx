import { useState } from 'react'
import { Minus, Square, X } from 'lucide-react'

const CONTROLS = [
  { icon: <X size={9} />,     action: 'close',    color: '#ff5f57', hover: '#ff3b30' },
  { icon: <Minus size={9} />, action: 'minimize', color: '#febc2e', hover: '#ffb900' },
  { icon: <Square size={8} />,action: 'maximize', color: '#28c840', hover: '#24b835' },
]

export default function TitleBar() {
  const api = window.electronAPI
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="glass-sm"
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
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
      {/* Traffic lights */}
      <div
        style={{ display: 'flex', gap: 8, WebkitAppRegion: 'no-drag', alignItems: 'center' } as React.CSSProperties}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {CONTROLS.map(({ icon, action, color, hover }) => (
          <button
            key={action}
            onClick={() => {
              if (action === 'close') api?.close()
              else if (action === 'minimize') api?.minimize()
              else api?.maximize()
            }}
            style={{
              width: 13, height: 13, borderRadius: '50%',
              border: 'none', cursor: 'pointer',
              background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(0,0,0,0.65)',
              transition: 'background 0.12s, transform 0.1s',
              flexShrink: 0,
              boxShadow: `0 0 0 0.5px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = hover; e.currentTarget.style.transform = 'scale(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = color; e.currentTarget.style.transform = 'scale(1)' }}
          >
            <span style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.1s', lineHeight: 0 }}>{icon}</span>
          </button>
        ))}
      </div>

      {/* Centered title */}
      <span style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)',
        letterSpacing: '0.04em', userSelect: 'none', pointerEvents: 'none',
      }}>
        PDF Studio
      </span>

      {/* Right spacer to balance traffic lights */}
      <div style={{ width: 53 }} />
    </div>
  )
}
