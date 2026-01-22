import { useEffect, useState, useRef } from 'react'
import TitleBar from './TitleBar'

interface ReaderProps {
  folderPath: string
  onClose: () => void
}

export default function Reader({ folderPath, onClose }: ReaderProps) {
  const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>(
    (localStorage.getItem('viewMode') as any) || 'horizontal'
  )
  const [readingDir, setReadingDir] = useState<'rtl' | 'ltr'>(
    (localStorage.getItem('readingDir') as any) || 'ltr'
  )
  
  // DEFAULT
  const [imageWidth, setImageWidth] = useState<number>(viewMode === 'horizontal' ? 100 : 40)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [tempZoom, setTempZoom] = useState<string>(imageWidth.toString())
  const [tempPage, setTempPage] = useState<string>('1')
  
  const containerRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef<boolean>(false)

  // LOAD
  useEffect(() => {
    (window as any).api.getImages(folderPath).then(setPages)
  }, [folderPath])

  // PERSISTENCE
  useEffect(() => { localStorage.setItem('viewMode', viewMode) }, [viewMode])
  useEffect(() => { localStorage.setItem('readingDir', readingDir) }, [readingDir])
  useEffect(() => { setTempZoom(imageWidth.toString()) }, [imageWidth])
  useEffect(() => {
    const key = `progress:${folderPath}`
    localStorage.setItem(key, currentPage.toString())
  }, [folderPath, currentPage])
  useEffect(() => {
    const key = `progress:${folderPath}`
    const savedPage = localStorage.getItem(key)
    if (savedPage) {
      const pageNum = parseInt(savedPage)
      if (!isNaN(pageNum) && pageNum > 1) {
        setCurrentPage(pageNum)
        setTempPage(savedPage)
      }
    }
  }, [])

  // KEYBOARD
  useEffect(() => {
    const keys = new Set<string>()
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      keys.add(k)
      if (['a','arrowleft'].includes(k)) handleMoveLeft()
      if (['d','arrowright'].includes(k)) handleMoveRight()
    }
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
    
    const loop = () => {
      if (containerRef.current && !isAutoScrolling.current) {
        let speed = 0
        if (keys.has('w') || keys.has('arrowup')) speed = -15
        if (keys.has('s') || keys.has('arrowdown')) speed = 15
        if (speed !== 0) containerRef.current.scrollBy({ top: speed })
      }
      requestAnimationFrame(loop)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    const frame = requestAnimationFrame(loop)
    return () => { 
      window.removeEventListener('keydown', onDown) 
      window.removeEventListener('keyup', onUp)
      cancelAnimationFrame(frame)
    }
  }, [viewMode, currentPage, readingDir, pages])

  // HELPERS
  const handleMoveLeft = () => commitPage(readingDir === 'ltr' ? currentPage - 1 : currentPage + 1)
  const handleMoveRight = () => commitPage(readingDir === 'ltr' ? currentPage + 1 : currentPage - 1)

  const commitPage = (val: number, fromScroll = false) => {
    if (val < 1) val = 1
    if (pages.length && val > pages.length) val = pages.length
    
    if (val !== currentPage) {
      setCurrentPage(val)
      setTempPage(val.toString())

      if (!fromScroll && viewMode === 'vertical') {
        isAutoScrolling.current = true
        setTimeout(() => {
           const img = document.getElementById(`page-${val}`)
           img?.scrollIntoView({ block: 'start' })
           setTimeout(() => isAutoScrolling.current = false, 300)
        }, 10)
      }
    }
  }

  const commitZoom = (val: number) => {
    if (val < 10) val = 10
    if (val > 200) val = 200
    setImageWidth(val)
    setTempZoom(val.toString())
  }

  const toggleViewMode = () => {
    const newMode = viewMode === 'vertical' ? 'horizontal' : 'vertical'
    setViewMode(newMode)
    if (newMode === 'horizontal') commitZoom(100)
    else commitZoom(40)
  }

  const handleScroll = () => {
    if (viewMode !== 'vertical' || isAutoScrolling.current || !containerRef.current) return
    const containerTop = containerRef.current.scrollTop
    const containerHeight = containerRef.current.clientHeight
    const center = containerTop + (containerHeight / 3)

    for (let i = 0; i < pages.length; i++) {
        const img = document.getElementById(`page-${i+1}`)
        if (img) {
            const { offsetTop, offsetHeight } = img
            if (center >= offsetTop && center <= offsetTop + offsetHeight) {
                if (currentPage !== i + 1) {
                    commitPage(i + 1, true)
                }
                break
            }
        }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000', color: '#ccc' }}>
      <TitleBar 
        title={folderPath.split('\\').pop() || 'Reader'} 
        onHomeClick={onClose} 
        onSettingsClick={() => setIsSettingsOpen(true)} 
      />

      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0 }}>Reader Settings</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={readingDir === 'rtl'} onChange={(e) => setReadingDir(e.target.checked ? 'rtl' : 'ltr')} />
              Right to Left Reading
            </label>
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsSettingsOpen(false)} style={{ padding: '5px 15px', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEWER AREA */}
      <div 
        ref={containerRef} 
        onScroll={handleScroll}
        style={{ 
          flex: 1, 
          overflow: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: viewMode === 'horizontal' ? 'center' : 'flex-start' 
      }}>
        {pages.map((src, i) => {
          if (viewMode === 'horizontal' && i + 1 !== currentPage) return null
          
          return (
            <img 
              key={i} id={`page-${i+1}`}
              src={`media:///${encodeURI(src.replace(/\\/g, '/'))}`}
              style={{
                display: 'block',
                width: viewMode === 'horizontal' ? (imageWidth === 100 ? 'auto' : `${imageWidth}%`) : `${imageWidth}%`,
                maxWidth: viewMode === 'horizontal' && imageWidth === 100 ? '100%' : 'none',
                maxHeight: viewMode === 'horizontal' && imageWidth === 100 ? '100%' : 'none',
                objectFit: 'contain',
                marginBottom: viewMode === 'vertical' ? '0' : 'auto',
                marginTop: viewMode === 'horizontal' ? 'auto' : '0'
              }}
            />
          )
        })}
      </div>

      {/* BOTTOM CONTROLS */}
      <div style={{ 
        height: '50px', 
        background: '#1e1e1e',
        borderTop: '1px solid #333', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: '24px' 
      }}>
        
        {/* View Toggle */}
        <button onClick={toggleViewMode} className="btn-icon" style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', border: '1px solid #333' }}>
          {viewMode === 'vertical' ? 'Height Fit' : 'Page Flip'}
        </button>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#121212', padding: '4px', borderRadius: '8px', border: '1px solid #333' }}>
          <button onClick={() => commitZoom(imageWidth - 10)} className="btn-icon" style={{ width: '24px', height: '24px' }}>−</button>
          <input 
            type="number" 
            value={tempZoom} 
            onChange={(e) => setTempZoom(e.target.value)} 
            onBlur={() => commitZoom(Number(tempZoom))}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="input-dark"
            style={{ width: '40px', textAlign: 'center', padding: '2px', border: 'none', background: 'transparent' }} 
          />
          <button onClick={() => commitZoom(imageWidth + 10)} className="btn-icon" style={{ width: '24px', height: '24px' }}>+</button>
          <span style={{ fontSize: '12px', color: '#666', paddingRight: '5px' }}>%</span>
        </div>

        {/* Page Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#121212', padding: '4px', borderRadius: '8px', border: '1px solid #333' }}>
          <button onClick={handleMoveLeft} className="btn-icon" style={{ width: '24px', height: '24px' }}>❮</button>
          <input 
            type="number" 
            value={tempPage} 
            onChange={(e) => setTempPage(e.target.value)} 
            onBlur={() => commitPage(Number(tempPage))}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="input-dark"
            style={{ width: '40px', textAlign: 'center', padding: '2px', border: 'none', background: 'transparent' }} 
          />
          <span style={{ fontSize: '12px', color: '#666' }}>/ {pages.length}</span>
          <button onClick={handleMoveRight} className="btn-icon" style={{ width: '24px', height: '24px' }}>❯</button>
        </div>
      </div>
    </div>
  )
}

const miniBtn = { width: '25px', height: '25px', cursor: 'pointer', background: '#444', color: 'white', border: 'none', borderRadius: '4px' }