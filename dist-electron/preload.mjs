"use strict";
const electron = require("electron");
const api = {
  selectFolder: () => electron.ipcRenderer.invoke("dialog:openDirectory"),
  readFolder: (path) => electron.ipcRenderer.invoke("folder:read", path),
  getImages: (path) => electron.ipcRenderer.invoke("folder:getImages", path),
  getCover: (path) => electron.ipcRenderer.invoke("folder:getCover", path),
  minimize: () => electron.ipcRenderer.send("window:minimize"),
  toggleMaximize: () => electron.ipcRenderer.send("window:maximize"),
  close: () => electron.ipcRenderer.send("window:close"),
  on: (channel, func) => {
    electron.ipcRenderer.on(channel, (_, ...args) => func(...args));
  },
  off: (channel) => electron.ipcRenderer.removeAllListeners(channel)
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.api = api;
}
