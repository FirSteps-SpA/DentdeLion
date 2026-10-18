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
      manifest: {
        name: 'DENTDELION',
        short_name: 'DENTDELION',
        description: 'Gestión de inventario dental offline-first',
        theme_color: '#0E5C73',
        background_color: '#F5F8FA',
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
