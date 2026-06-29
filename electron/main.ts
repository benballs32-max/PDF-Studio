import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, basename } from 'path'
import { spawn } from 'child_process'
import { readFile, copyFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'

let mainWindow: BrowserWindow | null = null

/** Returns [executable, args-prefix] for the Python sidecar.
 *  Dev:  python  pdf_engine.py  <payload>
 *  Prod: resources/pdf_engine/pdf_engine.exe  <payload>  (PyInstaller bundle)
 */
function sidecar(): { bin: string; prefix: string[] } {
  if (process.env.VITE_DEV_SERVER_URL) {
    return {
      bin: 'python',
      prefix: [join(__dirname, '..', 'python', 'pdf_engine.py')],
    }
  }
  return {
    bin: join(process.resourcesPath, 'pdf_engine', 'pdf_engine.exe'),
    prefix: [],
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

// IPC: open file dialog (generic, with caller-supplied filters)
ipcMain.handle('dialog:openFiles', async (_, filters: { name: string; extensions: string[] }[], multiple: boolean) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters,
  })
  return result.filePaths
})

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
  const ext = filePath.toLowerCase().split('.').pop() ?? ''
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  }
  const mime = mimeMap[ext] ?? 'application/octet-stream'
  return `data:${mime};base64,${buffer.toString('base64')}`
})

// IPC: select output directory
ipcMain.handle('dialog:selectDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
  })
  return result.filePaths[0]
})

// IPC: temp working copy for non-destructive page edits
ipcMain.handle('fs:makeTempCopy', async (_, src: string) => {
  const tmp = join(tmpdir(), `pdf-studio-${Date.now()}-${basename(src)}`)
  await copyFile(src, tmp)
  return tmp
})

ipcMain.handle('fs:deleteTempFile', async (_, path: string) => {
  try { await unlink(path) } catch { /* already gone */ }
})

// IPC: open output file in explorer
ipcMain.handle('shell:showItem', async (_, path: string) => {
  shell.showItemInFolder(path)
})

// IPC: run python command
ipcMain.handle('pdf:command', async (_, cmd: string, args: object) => {
  const { bin, prefix } = sidecar()
  const payload = JSON.stringify({ cmd, ...args })

  return new Promise((resolve, reject) => {
    const proc = spawn(bin, [...prefix, payload])

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
