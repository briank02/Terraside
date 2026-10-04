import { ipcRenderer, contextBridge } from 'electron'

const api = {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  readFolder: (path: string) => ipcRenderer.invoke('folder:read', path),
  getImages: (path: string) => ipcRenderer.invoke('folder:getImages', path),
  getCover: (path: string) => ipcRenderer.invoke('folder:getCover', path),

  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  onWindowStateChange: (func: (isMaximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => func(isMaximized)
    ipcRenderer.on('window:state-change', listener)
    return () => ipcRenderer.removeListener('window:state-change', listener)
  }
}

if (process.contextIsolated) {
  try { contextBridge.exposeInMainWorld('api', api) } catch (error) { console.error(error) }
} else {
  window.api = api
}
