import { defineStore } from 'pinia'
import { ref } from 'vue'
import { authService } from '@/services/authService.js'
import router from '@/router/index.js'
import { getActivePinia } from 'pinia'

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
      const res = await authService.login(data)
      localStorage.setItem('token', res.data.data.token)
      user.value = res.data.data.user
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
      localStorage.removeItem('token')
      user.value = null
      // Reset all store caches so next login gets fresh data
      const pinia = getActivePinia()
      if (pinia) {
        Object.values(pinia.state.value).forEach((storeState) => {
          if ('fetched' in storeState) storeState.fetched = false
        })
      }
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
