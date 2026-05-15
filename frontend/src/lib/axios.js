import axios from 'axios'

let baseURL = import.meta.env.VITE_API_BASE_URL;

// Auto-detect local network IP for mobile testing
// If accessing via local IP (e.g., 192.168.1.5), route the API to that same IP
if (window.location.hostname !== 'localhost' && window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
  baseURL = `http://${window.location.hostname}:8000/api`;
}

const api = axios.create({
  baseURL: baseURL,
  timeout: 30000, // 30 seconds to prevent infinite network hangs
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

api.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest'

// ─── Attach Bearer token for cross-domain (production) requests ───
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Handle 401 responses ───
let isRedirecting = false

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      const isAuthPage = window.location.pathname.includes('/login') ||
                         window.location.pathname.includes('/register')

      if (!isAuthPage) {
        isRedirecting = true
        localStorage.removeItem('auth_token')
        try {
          const { default: router } = await import('@/router/index.js')
          const { useAuthStore } = await import('@/stores/auth.js')
          const auth = useAuthStore()
          auth.user = null
          router.push({ name: 'login' })
        } catch {
          window.location.href = '/login'
        }
        setTimeout(() => { isRedirecting = false }, 3000)
      }
    }
    return Promise.reject(error)
  }
)

export default api
