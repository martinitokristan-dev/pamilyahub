import { defineStore } from 'pinia'
import { ref } from 'vue'
import dashboardService from '@/services/dashboardService.js'

import { performSilentFetch } from '@/utils/storeHelper.js'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref({ notes_count: 0, expenses_total: 0, debts_owed_to_me: 0, debts_i_owe: 0, files_count: 0 })
  const loading = ref(false)
  const fetched = ref(false)
  const error = ref(null)
  const cacheTime = ref(0)

  async function fetchStats(filters = {}) {
    const hasFilters = Object.keys(filters).length > 0;
    
    await performSilentFetch({
      loading,
      fetched,
      cacheTime,
      currentData: stats.value,
      force: hasFilters, // Force refresh if we have filters
      backgroundTtl: 30000,
      fetchFn: async () => {
        const res = await dashboardService.getStats(filters)
        stats.value = res.data.data
      }
    }).catch(e => {
      error.value = e.response?.data?.message ?? 'Failed to load stats'
    })
  }

  function invalidate() {
    fetched.value = false
  }

  return { stats, loading, fetched, error, cacheTime, fetchStats, invalidate }
})