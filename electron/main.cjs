// Electron host for Chronoscope — a thin shell around the existing web app.
// Responsibilities: (1) keep ALL data inside the app's own folder,
// (2) serve the built renderer over a stable app:// origin, (3) open a window.
const { app, protocol, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

// --- 1. Data self-containment -----------------------------------------------
// Redirect Chromium's userData root (IndexedDB, cache, localStorage, sessions)
// to a `data` folder next to the executable when packaged, so the whole
// portable folder is self-contained and nothing lands in %AppData%.
const dataDir = app.isPackaged
  ? path.join(path.dirname(process.execPath), 'data')
  : path.join(app.getAppPath(), '.electron-data')
fs.mkdirSync(dataDir, { recursive: true })
app.setPath('userData', dataDir)

// --- 2. app:// scheme (must be registered before app is ready) --------------
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const RENDERER_DIR = path.join(__dirname, '..', 'dist')
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain',
}

function serveFromDist(request) {
  let rel = decodeURIComponent(new URL(request.url).pathname)
  if (rel === '/' || rel === '') rel = '/index.html'
  const filePath = path.normalize(path.join(RENDERER_DIR, rel))
  if (filePath !== RENDERER_DIR && !filePath.startsWith(RENDERER_DIR + path.sep)) {
    return new Response('Forbidden', { status: 403 })
  }
  return fs.promises
    .readFile(filePath)
    .then((data) => {
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
      return new Response(data, { headers: { 'content-type': type } })
    })
    .catch(() => new Response('Not found', { status: 404 }))
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#11161d',
    title: 'Chronoscope',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    // Hide Electron's generic default menu (File/Edit/View/Window). It offers
    // nothing this app needs, and its bottom edge shows a hairline of the dark
    // window background against light-theme content. Alt still reveals it, and
    // web editing shortcuts (copy/paste/etc.) are unaffected.
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL)
  } else {
    win.loadURL('app://chronoscope/index.html')
  }
}

app.whenReady().then(() => {
  protocol.handle('app', serveFromDist)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
