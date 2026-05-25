import { useEffect, useState, useRef, type WheelEvent } from 'react'
import TitleBar from './TitleBar'

type ReadingDir = 'rtl' | 'ltr'

interface ReaderProps {
  folderPath: string
  onClose: () => void
  onSettingsClick: () => void
  readingDir: ReadingDir
  scrollSpeed: number
  previousChapterPath: string | null
  nextChapterPath: string | null
  onOpenChapter: (folderPath: string) => void
}

export default function Reader({
  folderPath,
  onClose,
  onSettingsClick,
  readingDir,
  scrollSpeed,
  previousChapterPath,
  nextChapterPath,
  onOpenChapter
}: ReaderProps) {
  const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>(
    (localStorage.getItem('viewMode') as any) || 'horizontal'
  )
  
  const [imageWidth, setImageWidth] = useState<number>(viewMode === 'horizontal' ? 100 : 40)
  const [isPreviewMode, setIsPreviewMode] = useState(false)

  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [tempZoom, setTempZoom] = useState<string>(imageWidth.toString())
  const [tempPage, setTempPage] = useState<string>('1')
  
  const [rating, setRating] = useState<number>(() => {
    const saved = localStorage.getItem(`rating:${folderPath}`)
    return saved ? parseInt(saved) : 0
  })
  
  const containerRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef<boolean>(false)

  // LOAD
  useEffect(() => {
    (window as any).api.getImages(folderPath).then(setPages)
  }, [folderPath])

  // PERSISTENCE
  useEffect(() => { localStorage.setItem('viewMode', viewMode) }, [viewMode])
  useEffect(() => { setTempZoom(imageWidth.toString()) }, [imageWidth])
  useEffect(() => {
    const key = `progress:${folderPath}`
    localStorage.setItem(key, currentPage.toString())
  }, [folderPath, currentPage])
  useEffect(() => {
    if (pages.length > 0 && currentPage >= pages.length) {
      localStorage.setItem(`finished:${folderPath}`, 'true')
    }
  }, [currentPage, folderPath, pages.length])
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
    
    let frameId: number; // Store the updating frame ID
    
    const loop = () => {
      if (containerRef.current && !isAutoScrolling.current) {
        let speed = 0
        if (keys.has('w') || keys.has('arrowup')) speed = -scrollSpeed
        if (keys.has('s') || keys.has('arrowdown')) speed = scrollSpeed
        if (speed !== 0) containerRef.current.scrollBy({ top: speed })
      }
      frameId = requestAnimationFrame(loop) // Update frameId continuously
    }
    
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    frameId = requestAnimationFrame(loop)
    
    return () => { 
      window.removeEventListener('keydown', onDown) 
      window.removeEventListener('keyup', onUp)
      cancelAnimationFrame(frameId) // Properly kills the active loop
    }
  }, [viewMode, currentPage, readingDir, pages, scrollSpeed])

  // Rating Handler
  const handleRating = (val: number) => {
    // Toggle off if clicking the same star
    const newRating = val === rating ? 0 : val
    setRating(newRating)
    localStorage.setItem(`rating:${folderPath}`, newRating.toString())
  }

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

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (scrollSpeed === 15 || !containerRef.current) return
    e.preventDefault()
    const multiplier = scrollSpeed / 15
    containerRef.current.scrollBy({
      top: e.deltaY * multiplier,
      left: e.deltaX * multiplier
    })
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-app)', color: 'var(--text-main)' }}>
      <TitleBar 
        title={folderPath.split('\\').pop() || 'Reader'} 
        onHomeClick={onClose} 
        onSettingsClick={onSettingsClick}
      />

      {/* VIEWER AREA */}
      <div 
        ref={containerRef} 
        onScroll={handleScroll}
        onWheel={handleWheel}
        style={{ 
          flex: 1, 
          overflow: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: isPreviewMode ? 'stretch' : 'center',
          justifyContent: viewMode === 'horizontal' && !isPreviewMode ? 'center' : 'flex-start'
      }}>
        {isPreviewMode ? (
          <div className="preview-grid">
            {pages.map((src, i) => (
              <button
                key={src}
                className={`preview-thumb-button ${currentPage === i + 1 ? 'active' : ''}`}
                onClick={() => {
                  setIsPreviewMode(false)
                  commitPage(i + 1)
                }}
                title={`Page ${i + 1}`}
              >
                <img
                  src={`media:///${encodeURI(src.replace(/\\/g, '/'))}`}
                  className="preview-thumb"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        ) : pages.map((src, i) => {
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
        height: '58px',
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border)', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: '12px',
        padding: '0 12px'
      }}>
        <button
          onClick={() => previousChapterPath && onOpenChapter(previousChapterPath)}
          disabled={!previousChapterPath}
          className="btn-icon reader-bar-button"
          style={{ opacity: previousChapterPath ? 1 : 0.35 }}
        >
          &lt; Previous Chapter
        </button>

        <button onClick={() => setIsPreviewMode(!isPreviewMode)} className="btn-icon reader-bar-button">
          {isPreviewMode ? 'Close Preview' : 'Preview Mode'}
        </button>
        
        {/* View Toggle */}
        <button onClick={toggleViewMode} className="btn-icon reader-bar-button">
          {viewMode === 'vertical' ? 'Height Fit' : 'Page Flip'}
        </button>

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-app)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-app)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
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
        
        {/* NEW: Rating Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-app)', padding: '4px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => handleRating(star)}
              className="btn-icon"
              style={{
                width: 'auto',
                height: 'auto',
                padding: '0 2px',
                color: rating >= star ? '#FFD700' : '#444',
                fontSize: '18px',
                transition: 'color 0.2s',
              }}
            >
              ★
            </button>
          ))}
        </div>

        <button
          onClick={() => nextChapterPath && onOpenChapter(nextChapterPath)}
          disabled={!nextChapterPath}
          className="btn-icon reader-bar-button"
          style={{ opacity: nextChapterPath ? 1 : 0.35 }}
        >
          Next Chapter &gt;
        </button>

      </div>
    </div>
  )
}
