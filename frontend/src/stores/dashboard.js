import { defineStore } from 'pinia'
import { ref } from 'vue'
import dashboardService from '@/services/dashboardService.js'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref({ notes_count: 0, expenses_total: 0, debts_owed_to_me: 0, debts_i_owe: 0, files_count: 0 })
  const loading = ref(false)
  const fetched = ref(false)
  const error = ref(null)
  const cacheTime = ref(0)
  const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

  function isCacheValid() {
    return Date.now() - cacheTime.value < CACHE_TTL
  }

  async function fetchStats(filters = {}) {
    if (fetched.value && isCacheValid() && Object.keys(filters).length === 0) return
    loading.value = true
    try {
      const res = await dashboardService.getStats(filters)
      stats.value = res.data.data
      fetched.value = true
      cacheTime.value = Date.now()
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Failed to load stats'
    } finally {
      loading.value = false
    }
  }

  function invalidate() {
    fetched.value = false
  }

  return { stats, loading, fetched, error, cacheTime, fetchStats, invalidate }
})