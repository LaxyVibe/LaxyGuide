import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import process from 'node:process'

// https://vite.dev/config/
const mapAssetVersion = process.env.COMMIT_REF?.trim()
  || process.env.DEPLOY_ID?.trim()
  || `local-${Date.now()}`

export default defineConfig({
  define: {
    'import.meta.env.VITE_MAP_ASSET_VERSION': JSON.stringify(mapAssetVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Laxy Lite Guide PWA',
        short_name: 'LaxyLite',
        description: 'Lite version of Laxy Guide PWA',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/laxy-admin/]
      }
    })
  ],
  base: '/',
})
