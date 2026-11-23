import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // New versions activate straight away; src/pwaUpdate.js
      // picks a safe moment to refresh the page (never mid-typing).
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Beats Infinity',
        short_name: 'Beats Infinity',
        description: "Where every voice finds a stage - Chennai's premium karaoke community.",
        theme_color: '#0B0B0B',
        background_color: '#0B0B0B',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,ico}'],
        // Not installed up front (saves ~6MB of mobile data on the
        // first visit and keeps updates light): the big background
        // images and the admin-only Excel library. They still load
        // normally and are cached the first time they're shown.
        globIgnores: [
          '**/hero-banner-*',
          '**/Logo-*',
          '**/concert-bg-*',
          '**/exceljs*'
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              url.origin === self.location.origin &&
              (request.destination === 'image' || url.pathname.includes('exceljs')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'bi-assets',
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ],
        // Never cache API calls - the app must always hit the live
        // backend, not a stale cached response.
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
})
