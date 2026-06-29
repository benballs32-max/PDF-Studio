import { useState } from 'react'
import { Minus, Square, X } from 'lucide-react'

const CONTROLS = [
  { icon: <Minus size={10} />, action: 'minimize', hoverBg: 'rgba(255,255,255,0.1)' },
  { icon: <Square size={9} />, action: 'maximize', hoverBg: 'rgba(255,255,255,0.1)' },
  { icon: <X size={11} />,     action: 'close',    hoverBg: '#e81123' },
]

export default function TitleBar() {
  const api = window.electronAPI
  const [hoveredAction, setHoveredAction] = useState<string | null>(null)

  return (
    <div
      className="glass-sm"
      style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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
      {/* App title */}
      <span style={{
        paddingLeft: 16,
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: '0.04em',
        userSelect: 'none',
        pointerEvents: 'none',
      }}>
        PDF Studio
      </span>

      {/* Windows-style controls — right side */}
      <div
        style={{ display: 'flex', WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {CONTROLS.map(({ icon, action, hoverBg }) => (
          <button
            key={action}
            onClick={() => {
              if (action === 'close') api?.close()
              else if (action === 'minimize') api?.minimize()
              else api?.maximize()
            }}
            onMouseEnter={() => setHoveredAction(action)}
            onMouseLeave={() => setHoveredAction(null)}
            style={{
              width: 46,
              height: 36,
              border: 'none',
              cursor: 'pointer',
              background: hoveredAction === action ? hoverBg : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: hoveredAction === action && action === 'close'
                ? '#ffffff'
                : 'rgba(255,255,255,0.65)',
              transition: 'background 0.1s, color 0.1s',
              flexShrink: 0,
            }}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  )
}
