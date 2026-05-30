import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  return {
    build: {
      chunkSizeWarningLimit: 1500,
    },
    plugins: [
      vue(),
      VitePWA({
        disable: mode === 'development',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        registerType: 'prompt',
        includeAssets: ['icons/wallets/EF-logo-192.png', 'icons/wallets/EF-logo-512.png', 'icons/wallets/EF-logo.png'],
        manifest: {
          name: 'EleFam',
          short_name: 'EleFam',
          description: 'Personal family expenses tracker',
          theme_color: '#5610c9',
          background_color: '#5610c9',
          display: 'standalone',
          icons: [
            {
              src: '/icons/wallets/EF-logo-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/wallets/EF-logo-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html}']
        }
      })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
