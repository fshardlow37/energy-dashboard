const { ipcRenderer } = require('electron');

window.energysrc = {
  getVersion: () => ipcRenderer.invoke('get-version'),
  closeWindow: () => ipcRenderer.send('close-window'),
  getCountry: () => ipcRenderer.invoke('get-country'),
  setCountry: (code) => ipcRenderer.invoke('set-country', code),
  getApiKey: (code) => ipcRenderer.invoke('get-api-key', code),
  setApiKey: (code, key) => ipcRenderer.invoke('set-api-key', code, key),
};
