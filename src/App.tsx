import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  VirtuosoGrid,
  type GridScrollSeekPlaceholderProps,
  type ScrollSeekConfiguration
} from 'react-virtuoso'
import './App.css'
import Reader from './Reader'
import TitleBar from './TitleBar'

interface FolderData { name: string; coverPath: string | null }
type SortMode = 'alpha' | 'random' | 'rating' | 'unread'
type ReadingDir = 'rtl' | 'ltr'

const coverCache = new Map<string, string | 'empty'>()
const pendingCoverRequests = new Map<string, Promise<string | 'empty'>>()
const coverRequestQueue: Array<{
  fullPath: string
  resolve: (cover: string | 'empty') => void
}> = []
const MAX_CONCURRENT_COVER_REQUESTS = 3
let activeCoverRequests = 0

interface LibraryItem extends FolderData {
  fullPath: string
  lowerName: string
  progress: string | null
  rating: number
  unread: boolean
}

interface MangaCardProps {
  item: LibraryItem
  onOpen: (folderName: string) => void
}

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const convertCoverSrc = (filePath: string) => `cover:///${encodeURI(filePath.replace(/\\/g, '/'))}`

const joinPath = (parentPath: string, name: string) => {
  const separator = parentPath.endsWith('\\') || parentPath.endsWith('/')
    ? ''
    : (parentPath.includes('\\') ? '\\' : '/')
  return parentPath + separator + name
}

// A stable pseudo-random rank keeps Random view fixed until a new seed is chosen.
const getRandomRank = (value: string, seed: number) => {
  let hash = (2166136261 ^ seed) >>> 0
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x7feb352d)
  hash ^= hash >>> 15
  hash = Math.imul(hash, 0x846ca68b)
  return (hash ^ (hash >>> 16)) >>> 0
}

const pumpCoverQueue = () => {
  while (activeCoverRequests < MAX_CONCURRENT_COVER_REQUESTS && coverRequestQueue.length > 0) {
    const request = coverRequestQueue.shift()!
    activeCoverRequests += 1

    window.api.getCover(request.fullPath)
      .then((filePath) => request.resolve(filePath ? convertCoverSrc(filePath) : 'empty'))
      .catch(() => request.resolve('empty'))
      .finally(() => {
        activeCoverRequests -= 1
        pumpCoverQueue()
      })
  }
}

const requestCover = (fullPath: string) => {
  const cached = coverCache.get(fullPath)
  if (cached) return Promise.resolve(cached)

  const pending = pendingCoverRequests.get(fullPath)
  if (pending) return pending

  const request = new Promise<string | 'empty'>((resolve) => {
    coverRequestQueue.push({ fullPath, resolve })
    pumpCoverQueue()
  }).then((cover) => {
    coverCache.set(fullPath, cover)
    pendingCoverRequests.delete(fullPath)
    return cover
  })

  pendingCoverRequests.set(fullPath, request)
  return request
}

const LibraryGrid = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => <div {...props} ref={ref} className="library-grid" />
)
LibraryGrid.displayName = 'LibraryGrid'

const ScrollSeekPlaceholder = ({ height, width }: GridScrollSeekPlaceholderProps) => (
  <div className="scroll-seek-placeholder" style={{ height, width }} />
)

const libraryGridComponents = {
  List: LibraryGrid,
  ScrollSeekPlaceholder
}
const libraryScrollSeekConfiguration: ScrollSeekConfiguration = {
  enter: (velocity) => Math.abs(velocity) > 700,
  exit: (velocity) => Math.abs(velocity) < 120
}
const libraryOverscan = { main: 200, reverse: 100 }
const getLibraryItemKey = (_index: number, item: LibraryItem) => item.fullPath

const MangaCard = memo(({ item, onOpen }: MangaCardProps) => {
  const [cover, setCover] = useState<string | null>(() => coverCache.get(item.fullPath) ?? null)

  useEffect(() => {
    let isActive = true
    const cached = coverCache.get(item.fullPath)
    setCover(cached ?? null)

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    if (!cached) {
      // Avoid queueing covers for cards that disappear during a fast scroll.
      timeoutId = setTimeout(() => {
        if (!isActive) return
        requestCover(item.fullPath).then((result) => {
          if (!isActive) return
          setCover(result)
        })
      }, 100)
    }

    return () => {
      isActive = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [item.fullPath])

  return (
    <div className="grid-cell" onClick={() => onOpen(item.name)}>
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
          {item.rating > 0 && (
            <div className="card-badge rating-badge">
              ★ {item.rating}
            </div>
          )}

          {/* Progress Badge */}
          {item.progress && (
            <div className="card-badge progress-badge">
              Page {item.progress}
            </div>
          )}
        </div>
        <div className="card-title">
          <span className="title-text">{item.name}</span>
        </div>
      </div>
    </div>
  )
})
MangaCard.displayName = 'MangaCard'

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
  const [randomSeed, setRandomSeed] = useState(0)
  const [metadataVersion, setMetadataVersion] = useState(0)

  // SETTINGS
  const [isLightMode, setIsLightMode] = useState(localStorage.getItem('theme') === 'light')
  const [readingDir, setReadingDir] = useState<ReadingDir>(
    (localStorage.getItem('readingDir') as ReadingDir) || 'ltr'
  )
  const [scrollSpeed, setScrollSpeed] = useState<number>(() => parseInt(localStorage.getItem('scrollSpeed') || '15'))
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const libraryScrollRef = useRef<HTMLDivElement>(null)
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null)
  const [isLibraryScrolled, setIsLibraryScrolled] = useState(false)
  const [isLibraryScrolling, setIsLibraryScrolling] = useState(false)
  const isLibraryScrolledRef = useRef(false)
  const didRestoreLibraryRef = useRef(false)

  // PERSISTENCE & THEME
  useEffect(() => {
    if (didRestoreLibraryRef.current) return
    didRestoreLibraryRef.current = true

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
    if (nextIsScrolled !== isLibraryScrolledRef.current) {
      isLibraryScrolledRef.current = nextIsScrolled
      setIsLibraryScrolled(nextIsScrolled)
    }
  }

  // LOGIC
  const loadPath = async (path: string) => {
    const result = await window.api.readFolder(path)
    if (result) {
      setCurrentPath(result.path)
      setFolders(result.subfolders)
      localStorage.setItem('lastLibraryPath', result.path)
    }
  }

  const handleSelectFolder = async () => {
    const result = await window.api.selectFolder()
    if (result) {
      setPathHistory([])
      setCurrentPath(result.path)
      setFolders(result.subfolders)
      localStorage.setItem('lastLibraryPath', result.path)
    }
  }

  const handleFolderClick = useCallback(async (folderName: string) => {
    const targetPath = joinPath(currentPath, folderName)
    
    const result = await window.api.readFolder(targetPath)
    
    if (result) {
      if (result.subfolders.length > 0) {
        setPathHistory(prev => [...prev, currentPath])
        setCurrentPath(result.path)
        setFolders(result.subfolders)
        localStorage.setItem('lastLibraryPath', result.path)
      } else {
        setReadingFolder(targetPath)
      }
    }
  }, [currentPath])

  const handleBack = async () => {
    if (pathHistory.length === 0) return
    const newHistory = [...pathHistory]
    const prevPath = newHistory.pop()! // Get the last path
    
    const result = await window.api.readFolder(prevPath)
    if (result) {
      setCurrentPath(result.path)
      setFolders(result.subfolders)
      setPathHistory(newHistory)
      localStorage.setItem('lastLibraryPath', result.path)
    }
  }

  const libraryItems = useMemo<LibraryItem[]>(() => folders.map((folder) => {
    const fullPath = joinPath(currentPath, folder.name)
    const parsedRating = Number.parseInt(localStorage.getItem(`rating:${fullPath}`) || '0', 10)
    const rating = Number.isNaN(parsedRating) ? 0 : parsedRating
    const savedProgress = localStorage.getItem(`progress:${fullPath}`)

    return {
      ...folder,
      fullPath,
      lowerName: folder.name.toLocaleLowerCase(),
      progress: savedProgress && savedProgress !== '1' ? savedProgress : null,
      rating,
      unread: rating === 0 && localStorage.getItem(`finished:${fullPath}`) !== 'true'
    }
  }), [currentPath, folders, metadataVersion])

  const randomRanks = useMemo(() => {
    const ranks = new Map<string, number>()
    if (sortMode === 'random') {
      for (const folder of folders) {
        const fullPath = joinPath(currentPath, folder.name)
        ranks.set(fullPath, getRandomRank(fullPath, randomSeed))
      }
    }
    return ranks
  }, [currentPath, folders, randomSeed, sortMode])

  const processedFolders = useMemo(() => {
    const normalizedSearch = activeSearch.trim().toLocaleLowerCase()
    const processed = normalizedSearch
      ? libraryItems.filter((folder) => folder.lowerName.includes(normalizedSearch))
      : [...libraryItems]

    if (sortMode === 'random') {
      processed.sort((a, b) => (
        (randomRanks.get(a.fullPath) ?? 0) - (randomRanks.get(b.fullPath) ?? 0)
        || nameCollator.compare(a.name, b.name)
      ))
    } else if (sortMode === 'rating') {
      processed.sort((a, b) => b.rating - a.rating || nameCollator.compare(a.name, b.name))
    } else if (sortMode === 'unread') {
      processed.sort((a, b) => Number(b.unread) - Number(a.unread) || nameCollator.compare(a.name, b.name))
    } else {
      processed.sort((a, b) => nameCollator.compare(a.name, b.name))
    }

    return processed
  }, [activeSearch, libraryItems, randomRanks, sortMode])

  const handleSortModeChange = (nextMode: SortMode) => {
    if (nextMode === sortMode) return

    libraryScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    if (nextMode === 'random' && sortMode !== 'random') {
      setRandomSeed(Math.floor(Math.random() * 0xffffffff))
    }
    setSortMode(nextMode)
  }

  const chapterPaths = useMemo(
    () => folders.map(folder => joinPath(currentPath, folder.name)),
    [currentPath, folders]
  )
  const currentChapterIndex = readingFolder ? chapterPaths.indexOf(readingFolder) : -1
  const previousChapterPath = currentChapterIndex > 0 ? chapterPaths[currentChapterIndex - 1] : null
  const nextChapterPath = currentChapterIndex >= 0 && currentChapterIndex < chapterPaths.length - 1
    ? chapterPaths[currentChapterIndex + 1]
    : null

  const closeReader = useCallback(() => {
    setReadingFolder(null)
    setMetadataVersion(version => version + 1)
  }, [])

  const handleScrollingChange = useCallback((isScrolling: boolean) => {
    setIsLibraryScrolling(isScrolling)
  }, [])

  const libraryLayoutStyle = {
    '--library-grid-columns': viewMode === 'grid' ? `repeat(${gridColumns}, minmax(0, 1fr))` : '1fr',
    '--library-grid-gap': viewMode === 'grid' ? '20px' : '5px'
  } as React.CSSProperties

  const renderLibraryItem = useCallback((_index: number, item: LibraryItem) => (
    viewMode === 'grid' ? (
      <MangaCard item={item} onOpen={handleFolderClick} />
    ) : (
      <div onClick={() => handleFolderClick(item.name)} className="library-list-item">
        📁 {item.name}
      </div>
    )
  ), [handleFolderClick, viewMode])

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
          onClose={closeReader}
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
      <div
        ref={libraryScrollRef}
        onScroll={handleLibraryScroll}
        className={`library-scroll${isLibraryScrolling ? ' library-scrolling' : ''}`}
        style={{ padding: '0 20px 20px', overflowY: 'auto', flex: 1, ...libraryLayoutStyle }}
      >
        {/* CONTROLS */}
        <div className={`toolbar ${isLibraryScrolled ? 'toolbar-scrolled' : ''}`} style={{ borderRadius: '0 0 8px 8px', marginBottom: '20px' }}>
          
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
              value={sortMode} onChange={(e) => handleSortModeChange(e.target.value as SortMode)}
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
            useWindowScroll={false}
            customScrollParent={scrollParent}
            data={processedFolders}
            components={libraryGridComponents}
            computeItemKey={getLibraryItemKey}
            itemContent={renderLibraryItem}
            isScrolling={handleScrollingChange}
            overscan={libraryOverscan}
            scrollSeekConfiguration={libraryScrollSeekConfiguration}
          />
        )}
      </div>
    </div>
    </>
  )
}

export default App
