/// <reference types="vite/client" />

interface TerrasideApi {
  selectFolder: () => Promise<FolderScanResult | null>
  readFolder: (path: string) => Promise<FolderScanResult | null>
  getImages: (path: string) => Promise<string[]>
  getCover: (path: string) => Promise<string | null>
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  onWindowStateChange: (func: (isMaximized: boolean) => void) => () => void
}

interface FolderScanResult {
  path: string
  subfolders: Array<{ name: string }>
}

interface Window {
  api: TerrasideApi
}
