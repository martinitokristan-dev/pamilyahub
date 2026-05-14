import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authService } from '@/services/authService.js'
import api from '@/lib/axios.js'
import router from '@/router/index.js'
import { getActivePinia } from 'pinia'
import { useDashboardStore } from './dashboard.js'
import { useWalletsStore } from './wallets.js'
import { useNotesStore } from './notes.js'

// Check if API is on a different origin (cross-domain = production)
function isCrossDomain() {
  try {
    const apiUrl = new URL(import.meta.env.VITE_API_BASE_URL)
    return apiUrl.origin !== window.location.origin
  } catch {
    return false
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function register(data) {
    loading.value = true
    error.value = null
    try {
      // Only fetch CSRF cookie for same-origin (local dev) — not needed for token auth
      if (!isCrossDomain()) {
        await api.get('/sanctum/csrf-cookie', { baseURL: import.meta.env.VITE_API_BASE_URL.replace('/api', '') })
      }
      
      const res = await authService.register(data)
      user.value = res.data.data.user

      // Store token for cross-domain auth
      if (res.data.data.token) {
        localStorage.setItem('auth_token', res.data.data.token)
      }

      router.push({ name: 'dashboard' })
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Registration failed'
    } finally {
      loading.value = false
    }
  }

  async function login(data) {
    loading.value = true
    error.value = null
    try {
      let res
      let usedCombined = false

      // Only fetch CSRF cookie for same-origin (local dev) — not needed for token auth
      if (!isCrossDomain()) {
        await api.get('/sanctum/csrf-cookie', { baseURL: import.meta.env.VITE_API_BASE_URL.replace('/api', '') })
      }

      // Try the optimized combined endpoint first
      try {
        res = await authService.loginWithData(data)
        usedCombined = true
      } catch (e) {
        // If it's a validation error (422) or unauthorized (401), don't retry, just throw
        if (e.response && (e.response.status === 422 || e.response.status === 401)) {
          throw e
        }
        // Fall back to regular login if loginWithData fails for other reasons (like 404)
        res = await authService.login(data)
      }

      user.value = res.data.data.user

      // Store token for cross-domain auth
      if (res.data.data.token) {
        localStorage.setItem('auth_token', res.data.data.token)
      }

      // Pre-populate stores only if combined response succeeded and has data
      if (usedCombined) {
        if (res.data.data.wallets?.length) {
          const walletsStore = useWalletsStore()
          walletsStore.wallets = res.data.data.wallets
          walletsStore.fetched = true
          walletsStore.cacheTime = Date.now()
        }

        if (res.data.data.notes) {
          const notesStore = useNotesStore()
          notesStore.notes = res.data.data.notes
          notesStore.folders = res.data.data.folders ?? []
          notesStore.fetched = true
          notesStore.cacheTime = Date.now()
        }
      }

      router.push({ name: 'dashboard' })
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Login failed'
      // Throw the error so the component knows login failed
      throw e
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await authService.logout()
    } finally {
      // Clear token and storage
      localStorage.removeItem('auth_token')
      sessionStorage.clear()
      
      // Reset all Pinia stores
      const pinia = getActivePinia()
      if (pinia) {
        Object.values(pinia.state.value).forEach((storeState) => {
          if ('$reset' in storeState) {
            storeState.$reset()
          } else {
            // Fallback: reset individual properties
            if ('fetched' in storeState) storeState.fetched = false
            if ('user' in storeState) storeState.user = null
          }
        })
      }
      
      user.value = null
      router.push({ name: 'login' })
    }
  }

  async function fetchMe() {
    try {
      const res = await authService.me()
      user.value = res.data.data
      return res.data.data
    } catch (e) {
      user.value = null
      throw e // Re-throw so the router guard knows it failed
    }
  }

  async function updateProfile(data) {
    loading.value = true
    error.value = null
    try {
      const res = await authService.updateProfile(data)
      user.value = res.data.data
      return res.data.data
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Update failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  return { user, loading, error, register, login, logout, fetchMe, updateProfile }
})
