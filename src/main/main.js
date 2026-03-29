const { app, ipcMain } = require('electron');
const { createWindow } = require('./window');
const store = require('./store');

// Handle squirrel startup (installer-based builds only)
try { if (require('electron-squirrel-startup')) app.quit(); } catch {}

app.whenReady().then(() => {
  const win = createWindow();

  // Register for Windows startup (only when packaged)
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe')
    });
  }

  // IPC handlers
  ipcMain.handle('get-version', () => app.getVersion());
  ipcMain.on('close-window', () => win.close());
  ipcMain.handle('get-country', () => store.get('selectedCountry', 'UK'));
  ipcMain.handle('set-country', (_, code) => { store.set('selectedCountry', code); });
  ipcMain.handle('get-api-key', (_, code) => store.get(`apiKey-${code}`, null));
  ipcMain.handle('set-api-key', (_, code, key) => { store.set(`apiKey-${code}`, key); });
});

app.on('window-all-closed', () => app.quit());
