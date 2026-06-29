/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    minimize: () => void
    maximize: () => void
    close: () => void
    print: () => void
    openPDF: () => Promise<string[]>
    savePath: (ext: string) => Promise<string | undefined>
    selectDir: () => Promise<string | undefined>
    showItem: (path: string) => Promise<void>
    readFile: (path: string) => Promise<string>
    makeTempCopy: (src: string) => Promise<string>
    deleteTempFile: (path: string) => Promise<void>
    renameFile: (oldPath: string, newPath: string) => Promise<void>
    pdfCommand: (cmd: string, args: object) => Promise<unknown>
    getPathForFile: (file: File) => string
    openFiles: (filters: { name: string; extensions: string[] }[], multiple: boolean) => Promise<string[]>
  }
}
