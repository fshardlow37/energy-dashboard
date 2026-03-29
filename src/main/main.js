const { app, ipcMain } = require('electron');
const { createWindow } = require('./window');

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
});

app.on('window-all-closed', () => app.quit());
