import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import './assets/main.css'
// No need for registerSW here since useRegisterSW is handled in AppLayout.vue

// Apply dark mode before mount to prevent flash
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark')
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

if (isMobile) {
  // On mobile, wait for router so the EleFam splash animation is visible
  router.isReady().then(() => {
    app.mount('#app')
  })
} else {
  // On desktop, mount immediately (no splash animation)
  app.mount('#app')
}
