import { useEffect, useState, type CSSProperties } from 'react'

type ElectronCSSProperties = CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag'
}

interface TitleBarProps {
  title: string
  onSettingsClick?: () => void
  onHomeClick?: () => void
  showHome?: boolean
}

export default function TitleBar({ title, onSettingsClick, onHomeClick, showHome = true }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState<boolean | null>(null)

  useEffect(() => {
    let isActive = true
    let receivedStateChange = false
    const removeStateListener = window.api.onWindowStateChange((state) => {
      receivedStateChange = true
      setIsMaximized(state)
    })

    window.api.isMaximized().then((state) => {
      if (isActive && !receivedStateChange) setIsMaximized(state)
    }).catch(() => undefined)

    return () => {
      isActive = false
      removeStateListener()
    }
  }, [])

  const handleMin = () => window.api.minimize()
  const handleMax = () => window.api.toggleMaximize()
  const handleClose = () => window.api.close()

  return (
    <div style={titleBarStyle}>
      
      {/* LEFT */}
      <div style={leftControlsStyle}>
        {showHome && (
          <button className="title-bar-action-button" onClick={onHomeClick} style={btnStyle} title="Home" aria-label="Home">
            <HomeIcon />
          </button>
        )}
        {onSettingsClick && (
          <button className="title-bar-action-button" onClick={onSettingsClick} style={btnStyle} title="Settings" aria-label="Settings">
            <SettingsIcon />
          </button>
        )}
      </div>

      {/* CENTER */}
      <div style={titleStyle} title={title}>
        {title}
      </div>

      {/* RIGHT */}
      <div style={rightControlsStyle}>
        <button className="title-bar-window-button" onClick={handleMin} style={winBtnStyle} title="Minimize" aria-label="Minimize">
          <MinimizeIcon />
        </button>
        <button
          className="title-bar-window-button"
          onClick={handleMax}
          style={winBtnStyle}
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>
        <button className="title-bar-window-button title-bar-close-button" onClick={handleClose} style={winBtnStyle} title="Close" aria-label="Close">
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
}

const HomeIcon = () => (
  <svg {...iconProps}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V21h13V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
)

const SettingsIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.1 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.3V9.6h.1A1.7 1.7 0 0 0 4.1 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.56 3.7l.06.06A1.7 1.7 0 0 0 8.5 4.1a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2.3h4.04v.1A1.7 1.7 0 0 0 15 4.1a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.5a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.1v4.04h-.1A1.7 1.7 0 0 0 19.4 15Z" />
  </svg>
)

const MinimizeIcon = () => (
  <svg {...iconProps}><path d="M5 12h14" /></svg>
)

const MaximizeIcon = () => (
  <svg {...iconProps}><rect x="5" y="5" width="14" height="14" rx="1" /></svg>
)

const RestoreIcon = () => (
  <svg {...iconProps}>
    <path d="M8 8V5h11v11h-3" />
    <rect x="5" y="8" width="11" height="11" rx="1" />
  </svg>
)

const CloseIcon = () => (
  <svg {...iconProps}>
    <path d="m6 6 12 12" />
    <path d="M18 6 6 18" />
  </svg>
)

const titleBarStyle: ElectronCSSProperties = {
  height: '40px',
  background: 'var(--bg-panel)',
  display: 'grid',
  gridTemplateColumns: '120px minmax(0, 1fr) 120px',
  alignItems: 'center',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
  userSelect: 'none',
  WebkitAppRegion: 'drag'
}

const leftControlsStyle: ElectronCSSProperties = {
  display: 'flex',
  WebkitAppRegion: 'no-drag'
}

const rightControlsStyle: ElectronCSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  WebkitAppRegion: 'no-drag'
}

const titleStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  fontWeight: 500,
  color: 'var(--text-main)',
  fontSize: '14px'
}

const btnStyle: CSSProperties = {
  width: '40px', height: '40px', padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center'
}

const winBtnStyle: CSSProperties = {
  width: '40px', height: '40px', padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center'
}
