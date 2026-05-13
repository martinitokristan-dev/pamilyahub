import { defineStore } from 'pinia'
import { ref } from 'vue'
import dashboardService from '@/services/dashboardService.js'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref({ notes_count: 0, expenses_total: 0, debts_owed_to_me: 0, debts_i_owe: 0, files_count: 0 })
  const loading = ref(false)
  const fetched = ref(false)
  const error = ref(null)

  async function fetchStats(filters = {}) {
    loading.value = true
    try {
      const res = await dashboardService.getStats(filters)
      stats.value = res.data.data
      fetched.value = true
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Failed to load stats'
    } finally {
      loading.value = false
    }
  }

  function invalidate() {
    fetched.value = false
  }

  return { stats, loading, fetched, error, fetchStats, invalidate }
})