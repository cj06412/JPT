import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import fs from 'node:fs'
import path from 'node:path'

// Copy electron/preload.cjs.js → dist-electron/preload.js verbatim.
// Avoids vite-plugin-electron's dual-build race where the ESM output sometimes
// overwrites the CJS one, breaking Electron's sandboxed preload.
function staticPreloadPlugin(): Plugin {
  const src = path.resolve(__dirname, 'electron/preload.cjs.js')
  const dst = path.resolve(__dirname, 'dist-electron/preload.js')
  const copy = () => {
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    fs.copyFileSync(src, dst)
  }
  return {
    name: 'jpt-static-preload',
    configResolved: copy,
    buildStart: copy,
    configureServer(server) {
      copy()
      server.watcher.add(src)
      server.watcher.on('change', (file) => {
        if (path.resolve(file) === src) copy()
      })
    },
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    staticPreloadPlugin(),
    renderer(),
  ],
  build: {
    rollupOptions: {
      input: {
        character: path.resolve(__dirname, 'src/character/index.html'),
        dialog: path.resolve(__dirname, 'src/dialog/index.html'),
        settings: path.resolve(__dirname, 'src/settings/index.html'),
        welcome: path.resolve(__dirname, 'src/welcome/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
