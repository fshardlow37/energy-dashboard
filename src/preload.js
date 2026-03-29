const { ipcRenderer } = require('electron');

// Expose API on window.energysrc
window.energysrc = {
  getVersion: () => ipcRenderer.invoke('get-version'),
  closeWindow: () => ipcRenderer.send('close-window')
};
