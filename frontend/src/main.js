import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import './assets/main.css'
import { registerSW } from 'virtual:pwa-register'

// Register Service Worker for PWA to enable auto-updates
const updateSW = registerSW({
  onNeedRefresh() {
    // Automatically refresh the app when a new version is available
    updateSW(true)
  },
  onOfflineReady() {
    console.log('App is ready to work offline')
  },
})

// Apply dark mode before mount to prevent flash
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark')
}

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
