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
  const [isMaximized, setIsMaximized] = useState(true)

  useEffect(() => {
    const handleStateChange = (state: boolean) => setIsMaximized(state)
    return window.api.onWindowStateChange(handleStateChange)
  }, [])

  const handleMin = () => window.api.minimize()
  const handleMax = () => window.api.toggleMaximize()
  const handleClose = () => window.api.close()

  return (
    <div style={titleBarStyle}>
      
      {/* LEFT */}
      <div style={leftControlsStyle}>
        {showHome && (
          <button onClick={onHomeClick} style={btnStyle} title="Home">🏠</button>
        )}
        {onSettingsClick && (
          <button onClick={onSettingsClick} style={btnStyle} title="Settings">⚙️</button>
        )}
      </div>

      {/* CENTER */}
      <div style={{ fontWeight: 500, color: '#eee', fontSize: '14px' }}>
        {title}
      </div>

      {/* RIGHT */}
      <div style={rightControlsStyle}>
        <button className="title-bar-window-button" onClick={handleMin} style={winBtnStyle}>─</button>
        {/* Swap Icon based on state */}
        <button className="title-bar-window-button" onClick={handleMax} style={{ ...winBtnStyle, fontSize: isMaximized ? '16px' : '14px' }}>
            {isMaximized ? '❐' : '☐'}
        </button>
        <button className="title-bar-window-button title-bar-close-button" onClick={handleClose} style={winBtnStyle}>✕</button>
      </div>
    </div>
  )
}

const titleBarStyle: ElectronCSSProperties = {
  height: '40px',
  background: '#222',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 10px',
  borderBottom: '1px solid #333',
  userSelect: 'none',
  WebkitAppRegion: 'drag'
}

const leftControlsStyle: ElectronCSSProperties = {
  display: 'flex',
  gap: '15px',
  WebkitAppRegion: 'no-drag'
}

const rightControlsStyle: ElectronCSSProperties = {
  display: 'flex',
  WebkitAppRegion: 'no-drag'
}

const btnStyle: CSSProperties = {
  background: 'none', border: 'none', color: '#ccc', 
  fontSize: '18px', cursor: 'pointer', padding: '5px'
}

const winBtnStyle: CSSProperties = {
  width: '40px', height: '40px', fontSize: '14px',
  display: 'flex', alignItems: 'center', justifyContent: 'center'
}
