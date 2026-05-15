// CommonJS preload script. Static — NOT processed by Vite.
// vite.config.ts copies this file to dist-electron/preload.js at dev/build time.
// We do this because vite-plugin-electron's dual-build (ESM + CJS) has a race
// where the ESM output sometimes wins and Electron's sandboxed preload context
// can't load ESM, breaking window.jpt entirely.
'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jpt', {
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    const wrapped = (_, ...args) => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.off(channel, wrapped)
  },
})
