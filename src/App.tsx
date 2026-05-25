import React, { useState, useEffect, useRef } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'
import './App.css'
import Reader from './Reader'
import TitleBar from './TitleBar'

interface FolderData { name: string; coverPath: string | null }
type SortMode = 'alpha' | 'random' | 'rating' | 'unread'
type ReadingDir = 'rtl' | 'ltr'

const coverCache = new Map<string, string | 'empty'>()

const MangaCard = ({ folder, parentPath, onClick, convertFileSrc }: any) => {
  const fullPath = parentPath + '\\' + folder.name
  const [cover, setCover] = useState<string | null>(coverCache.get(fullPath) || null)
  const [progress, setProgress] = useState<string | null>(null)
  const [rating, setRating] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check progress
    const savedPage = localStorage.getItem(`progress:${fullPath}`)
    if (savedPage && savedPage !== '1') {
      setProgress(savedPage)
    }

    // Check rating
    const savedRating = localStorage.getItem(`rating:${fullPath}`)
    if (savedRating && savedRating !== '0') {
      setRating(savedRating)
    }

    let isActive = true
    let timeoutId: any

    if (!coverCache.has(fullPath)) {
      timeoutId = setTimeout(() => {
        if (!isActive) return
        (window as any).api.getCover(fullPath).then((path: string | null) => {
          if (!isActive) return
          const result = path ? convertFileSrc(path) : 'empty'
          setCover(result)
          coverCache.set(fullPath, result)
        })
      }, 150)
    }

    return () => {
      isActive = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [fullPath])

return (
    <div className="grid-cell" onClick={onClick} ref={cardRef}>
      <div className="manga-card">
        <div className="card-image-area">
          {cover && cover !== 'empty' ? (
            <img src={cover} className="card-image" loading="lazy" decoding="async" />
          ) : cover === 'empty' ? (
            <span style={{ fontSize: '32px', opacity: 0.2 }}>📁</span>
          ) : (
            <div className="skeleton"></div>
          )}
          
          {/* Rating Badge */}
          {rating && (
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#FFD700',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
              border: '1px solid #444',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              ★ {rating}
            </div>
          )}

          {/* Progress Badge */}
          {progress && (
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
              border: '1px solid #444',
              backdropFilter: 'blur(4px)'
            }}>
              Page {progress}
            </div>
          )}
        </div>
        <div className="card-title">
          <span className="title-text">{folder.name}</span>
        </div>
      </div>
    </div>
  )
}

function App(): JSX.Element {
  // DATA
  const [currentPath, setCurrentPath] = useState<string>('')
  const [folders, setFolders] = useState<FolderData[]>([])
  const [pathHistory, setPathHistory] = useState<string[]>([])
  
  // UI
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [readingFolder, setReadingFolder] = useState<string | null>(null)
  const [gridColumns, setGridColumns] = useState<number>(() => parseInt(localStorage.getItem('gridColumns') || '4'))

  // SEARCH & SORT
  const [searchTerm, setSearchTerm] = useState<string>('') 
  const [activeSearch, setActiveSearch] = useState<string>('') 
  const [sortMode, setSortMode] = useState<SortMode>('alpha')

  // SETTINGS
  const [isLightMode, setIsLightMode] = useState(localStorage.getItem('theme') === 'light')
  const [readingDir, setReadingDir] = useState<ReadingDir>(
    (localStorage.getItem('readingDir') as ReadingDir) || 'ltr'
  )
  const [scrollSpeed, setScrollSpeed] = useState<number>(() => parseInt(localStorage.getItem('scrollSpeed') || '15'))
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const libraryScrollRef = useRef<HTMLDivElement>(null)
  const virtuosoRef = useRef<any>(null)
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null)
  const lastLibraryScrollTopRef = useRef(0)
  const [isLibraryScrolled, setIsLibraryScrolled] = useState(false)

  // PERSISTENCE & THEME
  useEffect(() => {
    const savedPath = localStorage.getItem('lastLibraryPath')
    const savedHistory = localStorage.getItem('pathHistory')
    
    if (savedHistory) setPathHistory(JSON.parse(savedHistory))
    if (savedPath) loadPath(savedPath)
  }, [])

  useEffect(() => {
    if (libraryScrollRef.current) {
      setScrollParent(libraryScrollRef.current)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('pathHistory', JSON.stringify(pathHistory))
  }, [pathHistory])

  useEffect(() => { localStorage.setItem('gridColumns', gridColumns.toString()) }, [gridColumns])

  useEffect(() => {
    document.body.className = isLightMode ? 'light-theme' : ''
    localStorage.setItem('theme', isLightMode ? 'light' : 'dark')
  }, [isLightMode])
  useEffect(() => { localStorage.setItem('readingDir', readingDir) }, [readingDir])
  useEffect(() => { localStorage.setItem('scrollSpeed', scrollSpeed.toString()) }, [scrollSpeed])

  const handleLibraryScroll = () => {
    const scrollTop = libraryScrollRef.current?.scrollTop ?? 0
    const nextIsScrolled = scrollTop > 0
    setIsLibraryScrolled(prev => prev === nextIsScrolled ? prev : nextIsScrolled)
  }

  // LOGIC
  const loadPath = async (path: string) => {
    const result = await (window as any).api.readFolder(path)
    if (result) {
      setCurrentPath(result.path)
      setFolders(result.subfolders)
      localStorage.setItem('lastLibraryPath', result.path)
    }
  }

  const handleSelectFolder = async () => {
    const result = await (window as any).api.selectFolder()
    if (result) {
      setPathHistory([])
      setCurrentPath(result.path)
      setFolders(result.subfolders)
      localStorage.setItem('lastLibraryPath', result.path)
    }
  }

  const handleFolderClick = async (folderName: string) => {
    const separator = currentPath.endsWith('\\') || currentPath.endsWith('/') 
      ? '' 
      : (currentPath.includes('\\') ? '\\' : '/')
    const targetPath = currentPath + separator + folderName
    
    const result = await (window as any).api.readFolder(targetPath)
    
    if (result) {
      if (result.subfolders.length > 0) {
        setPathHistory(prev => [...prev, currentPath])
        setCurrentPath(result.path)
        setFolders(result.subfolders)
        localStorage.setItem('lastLibraryPath', result.path)
      } else {
        lastLibraryScrollTopRef.current = libraryScrollRef.current?.scrollTop ?? 0
        setReadingFolder(targetPath)
      }
    }
  }

  const handleBack = async () => {
    if (pathHistory.length === 0) return
    const newHistory = [...pathHistory]
    const prevPath = newHistory.pop()! // Get the last path
    
    const result = await (window as any).api.readFolder(prevPath)
    if (result) {
      setCurrentPath(result.path)
      setFolders(result.subfolders)
      setPathHistory(newHistory)
      localStorage.setItem('lastLibraryPath', result.path)
    }
  }

  const convertFileSrc = (path: string) => `media:///${encodeURI(path.replace(/\\/g, '/'))}`

  const getFolderPath = (folderName: string) => {
    const separator = currentPath.endsWith('\\') || currentPath.endsWith('/')
      ? ''
      : (currentPath.includes('\\') ? '\\' : '/')
    return currentPath + separator + folderName
  }

  const compareByName = (a: FolderData, b: FolderData) => (
    a.name.localeCompare(b.name, undefined, { numeric: true })
  )

  const getRatingValue = (folder: FolderData) => {
    const rating = parseInt(localStorage.getItem(`rating:${getFolderPath(folder.name)}`) || '0')
    return isNaN(rating) ? 0 : rating
  }

  const isUnread = (folder: FolderData) => {
    const folderPath = getFolderPath(folder.name)
    const rating = parseInt(localStorage.getItem(`rating:${folderPath}`) || '0')
    const isRated = !isNaN(rating) && rating > 0
    const isFinished = localStorage.getItem(`finished:${folderPath}`) === 'true'
    return !isRated && !isFinished
  }

  const getProcessedFolders = () => {
    let processed = folders.filter(f => f.name.toLowerCase().includes(activeSearch.toLowerCase()))
    if (sortMode === 'random') processed = [...processed].sort(() => Math.random() - 0.5)
    else if (sortMode === 'rating') {
      processed.sort((a, b) => {
        const ratingDiff = getRatingValue(b) - getRatingValue(a)
        return ratingDiff || compareByName(a, b)
      })
    } else if (sortMode === 'unread') {
      processed.sort((a, b) => {
        const unreadDiff = Number(isUnread(b)) - Number(isUnread(a))
        return unreadDiff || compareByName(a, b)
      })
    } else processed.sort(compareByName)
    return processed
  }

  const chapterPaths = folders.map(folder => getFolderPath(folder.name))
  const currentChapterIndex = readingFolder ? chapterPaths.indexOf(readingFolder) : -1
  const previousChapterPath = currentChapterIndex > 0 ? chapterPaths[currentChapterIndex - 1] : null
  const nextChapterPath = currentChapterIndex >= 0 && currentChapterIndex < chapterPaths.length - 1
    ? chapterPaths[currentChapterIndex + 1]
    : null

  const settingsModal = isSettingsOpen && (
    <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0 }}>Settings</h3>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <span>Theme:</span>
          <button onClick={() => setIsLightMode(!isLightMode)} style={{ padding: '5px 10px', cursor: 'pointer' }}>
            {isLightMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={readingDir === 'rtl'} onChange={(e) => setReadingDir(e.target.checked ? 'rtl' : 'ltr')} />
          Right to Left Reading
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span>Scroll speed: {scrollSpeed}</span>
          <input
            type="range"
            min="5"
            max="45"
            step="1"
            value={scrollSpeed}
            onChange={(e) => setScrollSpeed(parseInt(e.target.value))}
            style={{ cursor: 'pointer' }}
          />
        </label>

        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setIsSettingsOpen(false)} style={{ padding: '5px 15px', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {readingFolder && (
        <Reader
          key={readingFolder}
          folderPath={readingFolder}
          onClose={() => setReadingFolder(null)}
          onSettingsClick={() => setIsSettingsOpen(true)}
          readingDir={readingDir}
          scrollSpeed={scrollSpeed}
          previousChapterPath={previousChapterPath}
          nextChapterPath={nextChapterPath}
          onOpenChapter={setReadingFolder}
        />
      )}

      {settingsModal}

      <div style={{ display: readingFolder ? 'none' : 'flex', flexDirection: 'column', height: '100vh' }}>
        
        {/* TITLE BAR */}
        <TitleBar 
          title="Terraside" 
          showHome={false} 
          onSettingsClick={() => setIsSettingsOpen(true)}
        />

      {/* MAIN CONTENT */}
      <div ref={libraryScrollRef} onScroll={handleLibraryScroll} style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {/* CONTROLS */}
        <div className={`toolbar ${isLibraryScrolled ? 'toolbar-scrolled' : ''}`} style={{ borderRadius: '8px', marginBottom: '20px' }}>
          
          {/* SEARCH */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
              <input 
                type="text" 
                placeholder="Search library..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setActiveSearch(searchTerm)}
                className="input-dark"
                style={{ width: '100%', paddingLeft: '30px' }} 
              />
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
              {activeSearch && (
                 <button onClick={() => { setSearchTerm(''); setActiveSearch('') }} 
                 style={{ position: 'absolute', right: '5px', top: '5px', background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}>✕</button>
              )}
            </div>
          </div>

          {/* TOOLS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '20px' }}>
            <span style={{ fontSize: '12px', color: '#888' }}>Size</span>
            <input 
              type="range" 
              min="2" 
              max="8" 
              step="1"
              value={gridColumns} 
              onChange={(e) => {                  
                const val = parseInt(e.target.value)
                setGridColumns(val)
                localStorage.setItem('gridColumns', val.toString())
              }}
              style={{ cursor: 'pointer', width: '100px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            
            <select 
              value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="input-dark"
              style={{ cursor: 'pointer', fontSize: '15px' }}
            >
              <option value="alpha">A-Z</option>
              <option value="rating">Rating</option>
              <option value="unread">Unread</option>
              <option value="random">Random</option>
            </select>

            <div style={{ width: '1px', height: '20px', background: '#333' }}></div> {/* Divider */}

            <button onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} className="btn-icon" title="Toggle View">
              {viewMode === 'grid' ? '☰' : '⊞'}
            </button>
            
            <div style={{ width: '1px', height: '20px', background: '#333' }}></div> {/* Divider */}

            <button onClick={handleSelectFolder} className="btn-primary">
              📂 Open Folder
            </button>
          </div>
        </div>

        {currentPath && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            {pathHistory.length > 0 && (
              <button onClick={handleBack} className="btn-primary" style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>◀</span> Back
              </button>
            )}
            <p style={{ opacity: 0.6, fontSize: '12px', margin: 0 }}>{currentPath}</p>
          </div>
        )}

        {/* LIBRARY GRID */}
        {scrollParent && (
          <VirtuosoGrid
            ref={virtuosoRef}
            useWindowScroll={false}
            customScrollParent={scrollParent}
            data={getProcessedFolders()}
            components={{
              List: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
                <div 
                  {...props} 
                  ref={ref} 
                  className="library-grid" 
                  style={{ 
                    ...props.style,
                    display: viewMode === 'grid' ? 'grid' : 'block',
                    gridTemplateColumns: viewMode === 'grid' ? `repeat(${gridColumns}, 1fr)` : 'none'
                  }} 
                />
              ))
            }}
            itemContent={(_index, folder) => (
              viewMode === 'grid' ? (
                <MangaCard 
                  folder={folder} 
                  parentPath={currentPath}
                  onClick={() => handleFolderClick(folder.name)}
                  convertFileSrc={convertFileSrc}
                />
              ) : (
                <div onClick={() => handleFolderClick(folder.name)}
                  style={{ padding: '15px', background: 'var(--bg-panel)', marginBottom: '5px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: '6px' }}
                >
                  📁 {folder.name}
                </div>
              )
            )}
          />
        )}
      </div>
    </div>
    </>
  )
}

export default App
