import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      vue(),
      VitePWA({
        disable: mode === 'development',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.js',
        registerType: 'prompt',
        includeAssets: ['icons/wallets/mobile-icon-frame-192.png', 'icons/wallets/mobile-icon-frame-512.png', 'icons/wallets/mobile-icon-frame.png'],
        manifest: {
          name: 'EleFam',
          short_name: 'EleFam',
          description: 'Personal family expenses tracker',
          theme_color: '#9333ea',
          background_color: '#9333ea',
          display: 'standalone',
          icons: [
            {
              src: '/icons/wallets/mobile-icon-frame-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/wallets/mobile-icon-frame-512.png',
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
