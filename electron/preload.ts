import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  print: () => ipcRenderer.send('window:print'),

  // File dialogs
  openPDF: () => ipcRenderer.invoke('dialog:openPDF'),
  savePath: (ext: string) => ipcRenderer.invoke('dialog:savePath', ext),
  selectDir: () => ipcRenderer.invoke('dialog:selectDir'),
  showItem: (path: string) => ipcRenderer.invoke('shell:showItem', path),

  // Read a local file as binary (avoids file:// URL restrictions)
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  makeTempCopy: (src: string) => ipcRenderer.invoke('fs:makeTempCopy', src),
  deleteTempFile: (path: string) => ipcRenderer.invoke('fs:deleteTempFile', path),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:renameFile', oldPath, newPath),

  // PDF processing
  pdfCommand: (cmd: string, args: object) =>
    ipcRenderer.invoke('pdf:command', cmd, args),

  // Get absolute file path from a File object (Electron 28+ replacement for File.path)
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  // Open a native file picker and return chosen paths
  openFiles: (filters: { name: string; extensions: string[] }[], multiple: boolean) =>
    ipcRenderer.invoke('dialog:openFiles', filters, multiple),
})
