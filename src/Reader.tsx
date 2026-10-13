import React, { useCallback, useEffect, useState, useRef, type WheelEvent } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import { parseSavedPage } from './reader-utils'

type ReadingDir = 'rtl' | 'ltr'
type ViewMode = 'scroll' | 'pageFlip'

const PAGE_FLIP_ZOOM = 100
const SCROLL_VIEW_ZOOM = 40

interface ReaderProps {
  folderPath: string
  readingDir: ReadingDir
  scrollSpeed: number
  previousChapterPath: string | null
  nextChapterPath: string | null
  onOpenChapter: (folderPath: string) => void
}

const getSavedPage = (folderPath: string) => {
  return parseSavedPage(localStorage.getItem(`progress:${folderPath}`))
}

const readerIconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
}

const ChevronLeftIcon = () => (
  <svg {...readerIconProps}><path d="m15 18-6-6 6-6" /></svg>
)

const ChevronRightIcon = () => (
  <svg {...readerIconProps}><path d="m9 18 6-6-6-6" /></svg>
)

const ThumbnailsIcon = () => (
  <svg {...readerIconProps}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

const StarIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg {...readerIconProps} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.03l-5.5 2.89 1.05-6.12L3.1 9.47l6.15-.9L12 3Z" />
  </svg>
)

export default function Reader({
  folderPath,
  readingDir,
  scrollSpeed,
  previousChapterPath,
  nextChapterPath,
  onOpenChapter
}: ReaderProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const savedMode = localStorage.getItem('viewMode')

    // Keep existing preferences working after renaming the reader modes.
    return savedMode === 'scroll' || savedMode === 'vertical' ? 'scroll' : 'pageFlip'
  })
  
  const [imageWidth, setImageWidth] = useState<number>(
    viewMode === 'pageFlip' ? PAGE_FLIP_ZOOM : SCROLL_VIEW_ZOOM
  )
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [isRatingOpen, setIsRatingOpen] = useState(false)

  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState<number>(() => getSavedPage(folderPath))
  const [tempZoom, setTempZoom] = useState<string>(imageWidth.toString())
  const [tempPage, setTempPage] = useState<string>(() => currentPage.toString())

  const [rating, setRating] = useState<number>(() => {
    const saved = localStorage.getItem(`rating:${folderPath}`)
    return saved ? parseInt(saved) : 0
  })
  
  const containerRef = useRef<HTMLDivElement>(null)
  const ratingPopoverRef = useRef<HTMLDivElement>(null)
  const isAutoScrolling = useRef<boolean>(false)
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (containerRef.current) setScrollParent(containerRef.current)
  }, [isPreviewMode])

  useEffect(() => {
    if (!isRatingOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!ratingPopoverRef.current?.contains(event.target as Node)) {
        setIsRatingOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsRatingOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isRatingOpen])

  // LOAD
  useEffect(() => {
    let isActive = true

    window.api.getImages(folderPath).then((loadedPages) => {
      if (!isActive) return

      const savedPage = getSavedPage(folderPath)
      const page = loadedPages.length > 0 ? Math.min(savedPage, loadedPages.length) : 1
      setPages(loadedPages)
      setCurrentPage(page)
      setTempPage(page.toString())
    })

    return () => {
      isActive = false
    }
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

  // PAGE NAVIGATION
  const commitPage = useCallback((val: number, fromScroll = false) => {
    if (val < 1) val = 1
    if (pages.length && val > pages.length) val = pages.length

    if (val !== currentPage) {
      setCurrentPage(val)
      setTempPage(val.toString())

      if (!fromScroll && viewMode === 'scroll') {
        isAutoScrolling.current = true
        setTimeout(() => {
          const img = document.getElementById(`page-${val}`)
          img?.scrollIntoView({ block: 'start' })
          setTimeout(() => isAutoScrolling.current = false, 300)
        }, 10)
      }
    }
  }, [currentPage, pages.length, viewMode])

  const handleMoveLeft = useCallback(() => {
    commitPage(readingDir === 'ltr' ? currentPage - 1 : currentPage + 1)
  }, [commitPage, currentPage, readingDir])

  const handleMoveRight = useCallback(() => {
    commitPage(readingDir === 'ltr' ? currentPage + 1 : currentPage - 1)
  }, [commitPage, currentPage, readingDir])

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
  }, [handleMoveLeft, handleMoveRight, scrollSpeed])

  // Rating Handler
  const handleRating = (val: number) => {
    // Toggle off if clicking the same star
    const newRating = val === rating ? 0 : val
    setRating(newRating)
    localStorage.setItem(`rating:${folderPath}`, newRating.toString())
  }

  const commitZoom = (val: number) => {
    if (val < 10) val = 10
    if (val > 200) val = 200
    setImageWidth(val)
    setTempZoom(val.toString())
  }

  const selectViewMode = (nextMode: ViewMode) => {
    if (nextMode === viewMode) return
    setViewMode(nextMode)
    commitZoom(nextMode === 'pageFlip' ? PAGE_FLIP_ZOOM : SCROLL_VIEW_ZOOM)
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
    if (viewMode !== 'scroll' || isAutoScrolling.current || !containerRef.current) return
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--bg-app)', color: 'var(--text-main)' }}>
      {/* VIEWER AREA */}
      <div 
        ref={containerRef} 
        onScroll={handleScroll}
        onWheel={handleWheel}
        style={{ 
          flex: 1, 
          minHeight: 0,
          overflow: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: isPreviewMode ? 'stretch' : 'center',
          justifyContent: 'flex-start'
      }}>
        {isPreviewMode ? (
          scrollParent && (
            <VirtuosoGrid
              useWindowScroll={false}
              customScrollParent={scrollParent}
              data={pages}
              components={{
                List: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
                  <div {...props} ref={ref} className="preview-grid" />
                ))
              }}
              itemContent={(i, src) => (
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
                    src={`thumb:///${encodeURI(src.replace(/\\/g, '/'))}`}
                    className="preview-thumb"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              )}
            />
          )
        ) : pages.map((src, i) => {
          if (viewMode === 'pageFlip' && i + 1 !== currentPage) return null

          const isPageFlip = viewMode === 'pageFlip'
          
          return (
            <img 
              key={i} id={`page-${i+1}`}
              src={`media:///${encodeURI(src.replace(/\\/g, '/'))}`}
              style={{
                display: 'block',
                width: isPageFlip ? 'auto' : `${imageWidth}%`,
                height: isPageFlip ? `${imageWidth}%` : 'auto',
                maxWidth: isPageFlip ? `${imageWidth}%` : 'none',
                maxHeight: 'none',
                flexShrink: 0,
                objectFit: 'contain',
                objectPosition: 'center top',
                alignSelf: 'safe center',
                margin: 0
              }}
            />
          )
        })}
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="reader-controls">
        <div className="reader-controls-zone reader-controls-left">
          <button
            onClick={() => previousChapterPath && onOpenChapter(previousChapterPath)}
            disabled={!previousChapterPath}
            className="btn-icon reader-control-button reader-chapter-button"
            title="Previous chapter"
            aria-label="Previous chapter"
          >
            <ChevronLeftIcon />
            <span className="reader-control-label">Chapter</span>
          </button>
        </div>

        <div className="reader-controls-center">
          <button
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`btn-icon reader-control-button${isPreviewMode ? ' active' : ''}`}
            title={isPreviewMode ? 'Close thumbnails' : 'Show thumbnails'}
            aria-label={isPreviewMode ? 'Close thumbnails' : 'Show thumbnails'}
            aria-pressed={isPreviewMode}
          >
            <ThumbnailsIcon />
          </button>

          <div className="reader-view-selector" role="group" aria-label="Reader view">
            <button
              onClick={() => selectViewMode('pageFlip')}
              className={viewMode === 'pageFlip' ? 'active' : ''}
              aria-pressed={viewMode === 'pageFlip'}
            >
              Page
            </button>
            <button
              onClick={() => selectViewMode('scroll')}
              className={viewMode === 'scroll' ? 'active' : ''}
              aria-pressed={viewMode === 'scroll'}
            >
              Scroll
            </button>
          </div>

          <div className="reader-page-control" aria-label="Page navigation">
            <button onClick={handleMoveLeft} className="btn-icon" title="Previous page" aria-label="Previous page">
              <ChevronLeftIcon />
            </button>
            <input
              type="number"
              value={tempPage}
              onChange={(e) => setTempPage(e.target.value)}
              onBlur={() => commitPage(Number(tempPage))}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="input-dark"
              aria-label="Page number"
            />
            <span>/ {pages.length}</span>
            <button onClick={handleMoveRight} className="btn-icon" title="Next page" aria-label="Next page">
              <ChevronRightIcon />
            </button>
          </div>

          <div className="reader-zoom-control" aria-label="Zoom controls">
            <button
              onClick={() => commitZoom(imageWidth - 10)}
              className="btn-icon reader-zoom-step"
              title="Zoom out"
              aria-label="Zoom out"
            >
              −
            </button>
            <input
              type="number"
              value={tempZoom}
              onChange={(e) => setTempZoom(e.target.value)}
              onBlur={() => commitZoom(Number(tempZoom))}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="input-dark"
              aria-label="Zoom percentage"
            />
            <span>%</span>
            <button
              onClick={() => commitZoom(imageWidth + 10)}
              className="btn-icon reader-zoom-step"
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>

          <div className="reader-rating-control" ref={ratingPopoverRef}>
            <button
              onClick={() => setIsRatingOpen(!isRatingOpen)}
              className={`btn-icon reader-control-button${rating > 0 ? ' active' : ''}`}
              title={rating > 0 ? `Rating: ${rating} out of 5` : 'Rate this chapter'}
              aria-label={rating > 0 ? `Rating: ${rating} out of 5` : 'Rate this chapter'}
              aria-expanded={isRatingOpen}
            >
              <StarIcon filled={rating > 0} />
              {rating > 0 && <span>{rating}</span>}
            </button>

            {isRatingOpen && (
              <div className="reader-rating-popover" role="dialog" aria-label="Choose rating">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => {
                      handleRating(star)
                      setIsRatingOpen(false)
                    }}
                    className={`btn-icon${rating >= star ? ' active' : ''}`}
                    title={`${star} star${star === 1 ? '' : 's'}`}
                    aria-label={`${star} star${star === 1 ? '' : 's'}`}
                  >
                    <StarIcon filled={rating >= star} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="reader-controls-zone reader-controls-right">
          <button
            onClick={() => nextChapterPath && onOpenChapter(nextChapterPath)}
            disabled={!nextChapterPath}
            className="btn-icon reader-control-button reader-chapter-button"
            title="Next chapter"
            aria-label="Next chapter"
          >
            <span className="reader-control-label">Chapter</span>
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
