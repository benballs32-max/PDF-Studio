/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    minimize: () => void
    maximize: () => void
    close: () => void
    openPDF: () => Promise<string[]>
    savePath: (ext: string) => Promise<string | undefined>
    selectDir: () => Promise<string | undefined>
    showItem: (path: string) => Promise<void>
    readFile: (path: string) => Promise<string>
    pdfCommand: (cmd: string, args: object) => Promise<unknown>
  }
}
