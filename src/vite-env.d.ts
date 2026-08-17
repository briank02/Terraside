/// <reference types="vite/client" />

interface TerrasideApi {
  selectFolder: () => Promise<FolderScanResult | null>
  readFolder: (path: string) => Promise<FolderScanResult | null>
  getImages: (path: string) => Promise<string[]>
  getCover: (path: string) => Promise<string | null>
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  on: <Args extends unknown[]>(channel: string, func: (...args: Args) => void) => void
  off: (channel: string) => void
}

interface FolderScanResult {
  path: string
  subfolders: Array<{ name: string; coverPath: null }>
  hasImages: boolean
}

interface Window {
  api: TerrasideApi
}
