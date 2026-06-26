import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import { readFile } from 'fs/promises'

let mainWindow: BrowserWindow | null = null

function pythonScriptPath(): string {
  // In dev: dist-electron/../python; in prod: resources/python
  try {
    const prod = join(process.resourcesPath, 'python', 'pdf_engine.py')
    return prod
  } catch {
    return join(__dirname, '..', 'python', 'pdf_engine.py')
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: join(__dirname, '..', 'public', 'icon.png'),
    vibrancy: undefined,
    backgroundMaterial: 'acrylic',
  })

  // F12 toggles DevTools
  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.key === 'F12') mainWindow?.webContents.toggleDevTools()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC: window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())

// IPC: open file dialog
ipcMain.handle('dialog:openPDF', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  })
  return result.filePaths
})

// IPC: save file dialog
ipcMain.handle('dialog:savePath', async (_, ext: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  })
  return result.filePath
})

// IPC: read local file as binary
ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  const buffer = await readFile(filePath)
  // Return as data URL — avoids Uint8Array serialisation issues through contextBridge
  return `data:application/pdf;base64,${buffer.toString('base64')}`
})

// IPC: select output directory
ipcMain.handle('dialog:selectDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
  })
  return result.filePaths[0]
})

// IPC: open output file in explorer
ipcMain.handle('shell:showItem', async (_, path: string) => {
  shell.showItemInFolder(path)
})

// IPC: run python command
ipcMain.handle('pdf:command', async (_, cmd: string, args: object) => {
  const script = process.env.VITE_DEV_SERVER_URL
    ? join(__dirname, '..', 'python', 'pdf_engine.py')
    : pythonScriptPath()

  return new Promise((resolve, reject) => {
    const proc = spawn('python', [script, JSON.stringify({ cmd, ...args })])

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d) => (stdout += d.toString()))
    proc.stderr.on('data', (d) => (stderr += d.toString()))

    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || 'Python error'))
      try {
        resolve(JSON.parse(stdout))
      } catch {
        resolve({ success: true, output: stdout })
      }
    })
  })
})
