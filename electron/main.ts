import { app, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

const scanDirectory = (dirPath: string) => {
  try {
    const contents = fs.readdirSync(dirPath, { withFileTypes: true })
    const hasImages = contents.some(d => d.isFile() && /\.(png|jpg|jpeg|webp|gif|avif)$/i.test(d.name))

    return {
        path: dirPath,
        subfolders: contents
        .filter(d => d.isDirectory())
        .map(d => ({ 
            name: d.name, 
            coverPath: null
        }))
        .sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:'base'})),
        hasImages
    }
  } catch (e) { 
    console.error(e)
    return null 
  }
}

// DFS to find the first image
const getFirstImageDFS = (dirPath: string): string | null => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    
    // Separate into files and directories
    const files = entries.filter(e => e.isFile())
    const dirs = entries.filter(e => e.isDirectory())

    // Sorting
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))

    // Check for images in the current directory
    const imageFile = files.find(f => /\.(png|jpg|jpeg|webp|gif|avif)$/i.test(f.name))
    if (imageFile) {
      return path.join(dirPath, imageFile.name)
    }

    // Go Deeper into subdirectories
    for (const dir of dirs) {
      const found = getFirstImageDFS(path.join(dirPath, dir.name))
      if (found) return found
    }

    // No images found
    return null
  } catch (error) {
    console.error(`Error reading directory for cover: ${dirPath}`, error)
    return null
  }
}

function createWindow() {
  win = new BrowserWindow({
    frame: false,
    show: false,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      webSecurity: false
    },
  })
  
  win.setMenuBarVisibility(false)
  win.maximize()
  win.show()

  win.on('maximize', () => win?.webContents.send('window:state-change', true))
  win.on('unmaximize', () => win?.webContents.send('window:state-change', false))

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    try {
      let filePath = request.url.replace(/^media:\/\//, '')
      if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(filePath)) {
        filePath = filePath.slice(1)
      }
      try { filePath = decodeURIComponent(filePath) } catch {}
      return new Response(fs.createReadStream(filePath) as any)
    } catch { return new Response('Error', { status: 500 }) }
  })

  ipcMain.on('window:minimize', () => win?.minimize())
  ipcMain.on('window:maximize', () => {
    if (!win) return
    if (win.isMaximized()) {
        win.unmaximize()
    } else {
        win.maximize()
    }
  })
  ipcMain.on('window:close', () => win?.close())
  
  ipcMain.handle('folder:getCover', async (_, folderPath) => {
    return getFirstImageDFS(folderPath)
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (canceled) return null
    return scanDirectory(filePaths[0])
  })

  ipcMain.handle('folder:read', async (_, p) => scanDirectory(p))

  ipcMain.handle('folder:getImages', async (_, folderPath) => {
    try {
      const files = fs.readdirSync(folderPath)
      return files
        .filter(f => /\.(png|jpg|jpeg|webp|gif|avif)$/i.test(f))
        .map(f => path.join(folderPath, f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    } catch { return [] }
  })

  createWindow()
})