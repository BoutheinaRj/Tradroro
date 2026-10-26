const { app, BrowserWindow } = require('electron')
const path = require('path')
const { pathToFileURL } = require('url')

// true when running with `electron .` directly (not packaged)
const isDev = !app.isPackaged

let mainWindow

async function startServer() {
  // In dev, server.js is started separately via `npm run server`
  if (isDev) return

  const serverPath = path.join(app.getAppPath(), 'server.js')
  await import(pathToFileURL(serverPath).href)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: 'Tradroro',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (isDev) {
    // Load Vite dev server in development
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // Load built files in production
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  await startServer()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
