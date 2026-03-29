const { BrowserWindow, screen } = require('electron');
const store = require('./store');
const path = require('path');

function createWindow() {
  const defaults = { width: 300, height: 500 };
  const bounds = store.get('windowBounds', defaults);

  // Validate saved position is on a visible display
  if (bounds.x !== undefined && bounds.y !== undefined) {
    const displays = screen.getAllDisplays();
    const onScreen = displays.some(d => {
      const b = d.bounds;
      return bounds.x >= b.x - 50 && bounds.x < b.x + b.width &&
             bounds.y >= b.y - 50 && bounds.y < b.y + b.height;
    });
    if (!onScreen) {
      delete bounds.x;
      delete bounds.y;
      bounds.width = defaults.width;
      bounds.height = defaults.height;
    }
  }

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 125,
    minHeight: 175,
    alwaysOnTop: true,
    frame: false,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  win.setAlwaysOnTop(true, 'floating');

  // Save bounds on move/resize (debounced)
  let saveTimeout;
  const saveBounds = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (!win.isDestroyed()) {
        store.set('windowBounds', win.getBounds());
      }
    }, 500);
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  // Save on close (ensures persistence even on auto-close)
  win.on('close', () => {
    if (!win.isDestroyed()) {
      store.set('windowBounds', win.getBounds());
    }
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  return win;
}

module.exports = { createWindow };
