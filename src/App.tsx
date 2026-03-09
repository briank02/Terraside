import { useState, useEffect, useRef } from 'react'
import './App.css'
import Reader from './Reader'
import TitleBar from './TitleBar'

interface FolderData { name: string; coverPath: string | null }

const MangaCard = ({ folder, parentPath, onClick, convertFileSrc }: any) => {
  const [cover, setCover] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [rating, setRating] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

useEffect(() => {
    const fullPath = parentPath + '\\' + folder.name
    
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

    // Intersection Observer
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (entry.isIntersecting && !cover) {
        (window as any).api.getCover(fullPath).then((path: string | null) => {
          if (path) setCover(convertFileSrc(path))
          else setCover('empty') 
        })
        observer.disconnect()
      }
    }, { rootMargin: '200% 0px 200% 0px' })

    if (cardRef.current) observer.observe(cardRef.current)

    return () => observer.disconnect()
  }, [folder, parentPath])

return (
    <div className="grid-cell" onClick={onClick} ref={cardRef}>
      <div className="manga-card">
        <div className="card-image-area">
          {cover && cover !== 'empty' ? (
            <img src={cover} className="card-image" loading="lazy" />
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
  const [sortMode, setSortMode] = useState<'alpha' | 'random'>('alpha')

  // SETTINGS
  const [isLightMode, setIsLightMode] = useState(localStorage.getItem('theme') === 'light')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // PERSISTENCE & THEME
  useEffect(() => {
    const savedPath = localStorage.getItem('lastLibraryPath')
    const savedHistory = localStorage.getItem('pathHistory')
    
    if (savedHistory) setPathHistory(JSON.parse(savedHistory))
    if (savedPath) loadPath(savedPath)
  }, [])

  useEffect(() => {
    localStorage.setItem('pathHistory', JSON.stringify(pathHistory))
  }, [pathHistory])

  useEffect(() => { localStorage.setItem('gridColumns', gridColumns.toString()) }, [gridColumns])

  useEffect(() => {
    document.body.className = isLightMode ? 'light-theme' : ''
    localStorage.setItem('theme', isLightMode ? 'light' : 'dark')
  }, [isLightMode])

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

  const getProcessedFolders = () => {
    let processed = folders.filter(f => f.name.toLowerCase().includes(activeSearch.toLowerCase()))
    if (sortMode === 'random') processed = [...processed].sort(() => Math.random() - 0.5)
    else processed.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    return processed
  }

  if (readingFolder) {
    return <Reader folderPath={readingFolder} onClose={() => setReadingFolder(null)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      
      {/* TITLE BAR */}
      <TitleBar 
        title="Terraside" 
        showHome={false} 
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      {/* CENTERED MODAL SETTINGS */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          {/* stopPropagation prevents closing when clicking inside the box */}
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: 0 }}>Settings</h3>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
               <span>Theme:</span>
               <button onClick={() => setIsLightMode(!isLightMode)} style={{ padding: '5px 10px', cursor: 'pointer' }}>
                 {isLightMode ? 'Dark Mode' : 'Light Mode'}
               </button>
            </label>
            
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsSettingsOpen(false)} style={{ padding: '5px 15px', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
        {/* CONTROLS */}
        <div className="toolbar" style={{ borderRadius: '8px', marginBottom: '20px' }}>
          
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
              value={sortMode} onChange={(e) => setSortMode(e.target.value as any)}
              className="input-dark"
              style={{ cursor: 'pointer' }}
            >
              <option value="alpha">A-Z</option>
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
        <div className="library-grid" style={{ 
          display: viewMode === 'grid' ? 'grid' : 'block',
          gridTemplateColumns: viewMode === 'grid' ? `repeat(${gridColumns}, 1fr)` : 'none'
        }}>
          {getProcessedFolders().map((folder) => (
            viewMode === 'grid' ? (
              <MangaCard 
                key={folder.name} 
                folder={folder} 
                parentPath={currentPath}
                onClick={() => handleFolderClick(folder.name)}
                convertFileSrc={convertFileSrc}
              />
            ) : (
              <div key={folder.name} onClick={() => handleFolderClick(folder.name)}
                style={{ padding: '15px', background: '#1e1e1e', marginBottom: '5px', cursor: 'pointer', border: '1px solid #333', borderRadius: '6px' }}
              >
                📁 {folder.name}
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )
}

export default App