import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authService } from '@/services/authService.js'
import router from '@/router/index.js'
import { getActivePinia } from 'pinia'
import { useDashboardStore } from './dashboard.js'
import { useWalletsStore } from './wallets.js'
import { useNotesStore } from './notes.js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)

  async function register(data) {
    loading.value = true
    error.value = null
    try {
      const res = await authService.register(data)
      localStorage.setItem('token', res.data.data.token)
      user.value = res.data.data.user
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
      } catch {
        // Fall back to regular login if loginWithData fails
        res = await authService.login(data)
      }

      localStorage.setItem('token', res.data.data.token)
      user.value = res.data.data.user

      // Pre-populate stores only if combined response succeeded and has data
      // NOTE: Do NOT pre-populate dashboard — loginWithData returns all-time
      // totals but the dashboard needs monthly-filtered stats with remaining_salary.
      // Let Dashboard.vue fetch from /dashboard/stats which has the correct logic.
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
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await authService.logout()
    } finally {
      // Clear all localStorage and sessionStorage
      localStorage.clear()
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
    } catch {
      localStorage.removeItem('token')
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
