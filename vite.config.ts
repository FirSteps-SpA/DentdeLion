/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Precachear también fuentes e íconos (spec 013 FR-020): por defecto
      // Workbox solo toma js/css/html, y sin esto Manrope no estaba disponible
      // en la primera carga sin red.
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,webmanifest}'],
      },
      manifest: {
        name: 'Dentdelion',
        short_name: 'Dentdelion',
        description: 'Gestión de inventario dental offline-first',
        theme_color: '#0D5360',
        background_color: '#F8FCFC',
        display: 'standalone',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
    sentryVitePlugin({
      org: 'first-steps',
      project: 'dentdelion',
      // No publicar los .map en Netlify: se suben a Sentry y se borran de dist/.
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
    }),
  ],

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },

  build: {
    // 'hidden': genera los .map sin referenciarlos desde el bundle.
    sourcemap: 'hidden',
  },
})
