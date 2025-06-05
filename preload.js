// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// If needed, you can expose APIs to the renderer process here
contextBridge.exposeInMainWorld('electronAPI', {
  // For example: send notifications or other features
});
