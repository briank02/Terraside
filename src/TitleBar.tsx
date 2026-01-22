import React, { useEffect, useState } from 'react'

interface TitleBarProps {
  title: string
  onSettingsClick?: () => void
  onHomeClick?: () => void
  showHome?: boolean
}

export default function TitleBar({ title, onSettingsClick, onHomeClick, showHome = true }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(true)

  useEffect(() => {
      const handleStateChange = (state: boolean) => setIsMaximized(state);
      (window as any).api.on('window:state-change', handleStateChange)
      return () => (window as any).api.off('window:state-change')
  }, [])

  const handleMin = () => (window as any).api.minimize()
  const handleMax = () => (window as any).api.toggleMaximize()
  const handleClose = () => (window as any).api.close()

  return (
    <div style={{
      height: '40px',
      background: '#222', 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 10px',
      borderBottom: '1px solid #333',
      userSelect: 'none',
      ...({ WebkitAppRegion: 'drag' } as any)
    }}>
      
      {/* LEFT */}
      <div style={{ display: 'flex', gap: '15px', ...({ WebkitAppRegion: 'no-drag' } as any) }}>
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
      <div style={{ display: 'flex', ...({ WebkitAppRegion: 'no-drag' } as any) }}>
        <button onClick={handleMin} style={winBtnStyle}>─</button>
        {/* Swap Icon based on state */}
        <button onClick={handleMax} style={{ ...winBtnStyle, fontSize: isMaximized ? '16px' : '14px' }}>
            {isMaximized ? '❐' : '☐'}
        </button>
        <button onClick={handleClose} style={{...winBtnStyle, ':hover': { background: 'red' } } as any}>✕</button>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#ccc', 
  fontSize: '18px', cursor: 'pointer', padding: '5px'
}

const winBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#ccc', 
  width: '40px', height: '40px', fontSize: '14px',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
}