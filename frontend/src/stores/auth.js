import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authService } from '@/services/authService.js'
import api from '@/lib/axios.js'
import router from '@/router/index.js'
import { getActivePinia } from 'pinia'
import { useDashboardStore } from './dashboard.js'
import { useWalletsStore } from './wallets.js'
import { cacheSingleGet, cacheSingleSet, cacheSingleRemove, isNetworkError } from '@/lib/offlineDb.js'
import { revokeGoogleCredential } from '@/lib/googleAuth.js'


export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Hydrate user from cache on store initialization
  async function hydrateUser() {
    if (user.value) return
    try {
      const cached = await cacheSingleGet('user')
      if (cached) {
        user.value = cached
      }
    } catch { /* ignore */ }
  }

  // Call hydrate immediately
  if (typeof window !== 'undefined') {
    hydrateUser()
  }

  async function register(data) {
    loading.value = true
    error.value = null
    try {
      const res = await authService.register(data)
      user.value = res.data.data.user
      await cacheSingleSet('user', user.value)

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
      await cacheSingleSet('user', user.value)

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
    // 1. Capture the token BEFORE clearing it (needed for server-side logout)
    const savedToken = localStorage.getItem('auth_token')
    const userEmail = user.value?.email

    // 2. Clear all auth state IMMEDIATELY (security first)
    localStorage.removeItem('auth_token')
    sessionStorage.clear()
    user.value = null

    // 3. Revoke Google credential so next sign-in always shows account chooser
    revokeGoogleCredential(userEmail)

    // 4. Clear user cache from IndexedDB (but NOT AI chat history)
    try {
      await cacheSingleRemove('user')
    } catch { /* ignore */ }

    // 5. Reset all Pinia stores
    const pinia = getActivePinia()
    if (pinia) {
      Object.values(pinia.state.value).forEach((storeState) => {
        if ('$reset' in storeState) {
          storeState.$reset()
        } else {
          if ('fetched' in storeState) storeState.fetched = false
          if ('user' in storeState) storeState.user = null
        }
      })
    }

    // 6. Navigate to login BEFORE any network calls (instant UX)
    router.push({ name: 'login' })

    // 7. Fire server-side logout with the SAVED token (background, non-blocking)
    if (savedToken) {
      api.post('/auth/logout', null, {
        headers: { Authorization: `Bearer ${savedToken}` },
      }).catch(() => {})
    }
  }

  async function fetchMe() {
    try {
      const res = await authService.me()
      user.value = res.data.data
      await cacheSingleSet('user', user.value)
      return res.data.data
    } catch (e) {
      // Don't clear user on network errors — keep the cached value so UI stays intact offline
      if (!isNetworkError(e)) {
        user.value = null
      }
      throw e // Re-throw so the router guard knows it failed
    }
  }

  async function updateProfile(data) {
    loading.value = true
    error.value = null
    try {
      const res = await authService.updateProfile(data)
      user.value = { ...user.value, ...res.data.data }
      await cacheSingleSet('user', user.value)
      return res.data.data
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Update failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function loginWithGoogle(idToken) {
    loading.value = true
    error.value = null
    try {
      const res = await authService.googleLogin(idToken)

      user.value = res.data.data.user
      await cacheSingleSet('user', user.value)

      if (res.data.data.token) {
        localStorage.setItem('auth_token', res.data.data.token)
      }

      router.push({ name: 'dashboard' })
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Google sign-in failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  const sessions = ref([])

  async function fetchSessions() {
    try {
      const res = await authService.getSessions()
      sessions.value = res.data.data
      return res.data.data
    } catch (e) {
      console.error('Failed to fetch sessions:', e)
      throw e
    }
  }

  async function logoutOtherSessions() {
    loading.value = true
    try {
      await authService.logoutOtherSessions()
      sessions.value = sessions.value.filter(s => s.is_current)
    } catch (e) {
      console.error('Failed to log out other devices:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function revokeSession(id) {
    loading.value = true
    try {
      await authService.revokeSession(id)
      const sessionObj = sessions.value.find(s => s.id === id)
      if (sessionObj?.is_current) {
        await logout()
      } else {
        sessions.value = sessions.value.filter(s => s.id !== id)
      }
    } catch (e) {
      console.error('Failed to revoke session:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function uploadAvatar(file) {
    loading.value = true
    error.value = null
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await authService.uploadAvatar(formData)
      user.value = res.data.data
      await cacheSingleSet('user', user.value)
      return res.data.data
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Image upload failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteAvatar() {
    loading.value = true
    error.value = null
    try {
      const res = await authService.deleteAvatar()
      user.value = res.data.data
      await cacheSingleSet('user', user.value)
      return res.data.data
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Failed to delete avatar'
      throw e
    } finally {
      loading.value = false
    }
  }

  return { 
    user, 
    loading, 
    error, 
    register, 
    login, 
    logout, 
    fetchMe, 
    updateProfile, 
    hydrateUser, 
    loginWithGoogle,
    sessions,
    fetchSessions,
    logoutOtherSessions,
    revokeSession,
    uploadAvatar,
    deleteAvatar
  }
})
