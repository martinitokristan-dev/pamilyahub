import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Prevent multiple simultaneous 401 redirects
let isRedirecting = false

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If we get a 401, it means the session expired or is invalid
    if (error.response?.status === 401 && !isRedirecting) {
      const isAuthPage = window.location.pathname.includes('/login') ||
                         window.location.pathname.includes('/register')

      if (!isAuthPage) {
        isRedirecting = true
        try {
          // Use Vue Router for soft navigation (preserves SPA state, avoids full reload)
          const { default: router } = await import('@/router/index.js')
          const { useAuthStore } = await import('@/stores/auth.js')
          const auth = useAuthStore()
          auth.user = null
          router.push({ name: 'login' })
        } catch {
          // Fallback to hard redirect if dynamic imports fail
          window.location.href = '/login'
        }
        // Reset the flag after navigation settles
        setTimeout(() => { isRedirecting = false }, 3000)
      }
    }
    return Promise.reject(error)
  }
)

export default api
