import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
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
        // A couple of banner images exceed Workbox's 2MB default -
        // raise the cap so precaching doesn't fail the build.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Never cache API calls - the app must always hit the live
        // backend, not a stale cached response.
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
})
