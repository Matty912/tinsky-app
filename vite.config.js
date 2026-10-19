import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const offlinePrecache = {
  name: 'tinsky-offline-precache',
  generateBundle(_options, bundle) {
    const assets = Object.keys(bundle)
      .filter((file) => /\\.(js|css|svg|png|jpe?g|webp|woff2?)$/i.test(file) && !file.endsWith('.map'))
      .filter((file) => {
        const item = bundle[file]
        const size = typeof item.source === 'string' ? item.source.length : item.source?.byteLength || 0
        return size <= 8 * 1024 * 1024
      })
      .map((file) => `/${file}`)
    this.emitFile({
      type: 'asset',
      fileName: 'precache-assets.json',
      source: JSON.stringify(assets),
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlinePrecache],
})
