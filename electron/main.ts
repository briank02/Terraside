import { app, BrowserWindow, ipcMain, dialog, protocol, nativeImage } from 'electron'
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
const imagePattern = /\.(png|jpg|jpeg|webp|gif|avif)$/i
const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const scanDirectory = async (dirPath: string) => {
  try {
    const contents = await fs.promises.readdir(dirPath, { withFileTypes: true })
    const subfolders: Array<{ name: string; coverPath: null }> = []
    let hasImages = false

    for (const entry of contents) {
      if (entry.isDirectory()) {
        subfolders.push({ name: entry.name, coverPath: null })
      } else if (!hasImages && entry.isFile() && imagePattern.test(entry.name)) {
        hasImages = true
      }
    }

    subfolders.sort((a, b) => nameCollator.compare(a.name, b.name))

    return {
      path: dirPath,
      subfolders,
      hasImages
    }
  } catch (e) { 
    console.error(e)
    return null 
  }
}

const coverCache = new Map<string, string | null>()
const pendingCoverScans = new Map<string, Promise<string | null>>()

const getFirstImageDFSAsync = async (dirPath: string): Promise<string | null> => {
  if (coverCache.has(dirPath)) {
    return coverCache.get(dirPath) || null
  }

  const pendingScan = pendingCoverScans.get(dirPath)
  if (pendingScan) return pendingScan

  const scan = (async () => {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
      const files = entries.filter(e => e.isFile())
      const dirs = entries.filter(e => e.isDirectory())

      files.sort((a, b) => nameCollator.compare(a.name, b.name))
      dirs.sort((a, b) => nameCollator.compare(a.name, b.name))

      const imageFile = files.find(f => imagePattern.test(f.name))
      if (imageFile) return path.join(dirPath, imageFile.name)

      for (const dir of dirs) {
        const found = await getFirstImageDFSAsync(path.join(dirPath, dir.name))
        if (found) return found
      }

      return null
    } catch (error) {
      console.error(`Error reading directory for cover: ${dirPath}`, error)
      return null
    }
  })()

  pendingCoverScans.set(dirPath, scan)

  try {
    const result = await scan
    coverCache.set(dirPath, result)
    return result
  } finally {
    pendingCoverScans.delete(dirPath)
  }
}

const getFilePathFromRequest = (requestUrl: string, scheme: string) => {
  let filePath = requestUrl.replace(new RegExp(`^${scheme}:\\/\\/`), '')
  if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(filePath)) {
    filePath = filePath.slice(1)
  }
  try { return decodeURIComponent(filePath) } catch { return filePath }
}

const createThumbnailResponse = async (
  requestUrl: string,
  scheme: string,
  size: { width: number; height: number }
) => {
  const filePath = getFilePathFromRequest(requestUrl, scheme)
  try {
    const thumbnail = await nativeImage.createThumbnailFromPath(filePath, size)
    if (thumbnail.isEmpty()) throw new Error('Empty thumbnail')

    return new Response(new Uint8Array(thumbnail.toPNG()), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400'
      }
    })
  } catch {
    return new Response(fs.createReadStream(filePath) as any)
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
      const filePath = getFilePathFromRequest(request.url, 'media')
      return new Response(fs.createReadStream(filePath) as any)
    } catch { return new Response('Error', { status: 500 }) }
  })

  protocol.handle('thumb', async (request) => {
    try {
      return await createThumbnailResponse(request.url, 'thumb', { width: 200, height: 200 })
    } catch { return new Response('Error', { status: 500 }) }
  })

  protocol.handle('cover', async (request) => {
    try {
      return await createThumbnailResponse(request.url, 'cover', { width: 400, height: 600 })
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
    return await getFirstImageDFSAsync(folderPath)
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (canceled) return null
    return await scanDirectory(filePaths[0])
  })

  ipcMain.handle('folder:read', async (_, p) => await scanDirectory(p))

  ipcMain.handle('folder:getImages', async (_, folderPath) => {
    try {
      const files = await fs.promises.readdir(folderPath)
      return files
        .filter(f => imagePattern.test(f))
        .map(f => path.join(folderPath, f))
        .sort((a, b) => nameCollator.compare(a, b))
    } catch { return [] }
  })

  createWindow()
})
