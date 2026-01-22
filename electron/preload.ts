import { ipcRenderer, contextBridge } from 'electron'

const api = {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  readFolder: (path: string) => ipcRenderer.invoke('folder:read', path),
  getImages: (path: string) => ipcRenderer.invoke('folder:getImages', path),
  getCover: (path: string) => ipcRenderer.invoke('folder:getCover', path),

  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  on: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_, ...args) => func(...args))
  },
  off: (channel: string) => ipcRenderer.removeAllListeners(channel) 
}

if (process.contextIsolated) {
  try { contextBridge.exposeInMainWorld('api', api) } catch (error) { console.error(error) }
} else {
  // @ts-ignore
  window.api = api
}