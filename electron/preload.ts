import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // File dialogs
  openPDF: () => ipcRenderer.invoke('dialog:openPDF'),
  savePath: (ext: string) => ipcRenderer.invoke('dialog:savePath', ext),
  selectDir: () => ipcRenderer.invoke('dialog:selectDir'),
  showItem: (path: string) => ipcRenderer.invoke('shell:showItem', path),

  // Read a local file as binary (avoids file:// URL restrictions)
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),

  // PDF processing
  pdfCommand: (cmd: string, args: object) =>
    ipcRenderer.invoke('pdf:command', cmd, args),
})
