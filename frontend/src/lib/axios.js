import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
  timeout: 30000, // 30 seconds to prevent infinite network hangs
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

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
