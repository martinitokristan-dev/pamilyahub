import { defineStore } from 'pinia'
import { ref } from 'vue'
import dashboardService from '@/services/dashboardService.js'

import { performSilentFetch } from '@/utils/storeHelper.js'
import { cacheSingleSet, cacheSingleGet, isNetworkError } from '@/lib/offlineDb.js'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref({ notes_count: 0, expenses_total: 0, debts_owed_to_me: 0, debts_i_owe: 0, files_count: 0 })
  const loading = ref(false)
  const fetched = ref(false)
  const error = ref(null)
  const cacheTime = ref(0)

  async function fetchStats(filters = {}) {
    const hasFilters = Object.keys(filters).length > 0;

    // Hydrate from IndexedDB if we have no data yet (offline cold start)
    if (!fetched.value && !stats.value.expenses_total) {
      try {
        const cached = await cacheSingleGet('dashboard')
        if (cached) stats.value = cached
      } catch { /* ignore */ }
    }
    
    await performSilentFetch({
      loading,
      fetched,
      cacheTime,
      currentData: stats.value,
      force: hasFilters,
      backgroundTtl: 30000,
      fetchFn: async () => {
        try {
          const res = await dashboardService.getStats(filters)
          stats.value = res.data.data
          await cacheSingleSet('dashboard', res.data.data)
        } catch (e) {
          if (isNetworkError(e)) return // keep cached value
          throw e
        }
      }
    }).catch(e => {
      if (!isNetworkError(e)) {
        error.value = e.response?.data?.message ?? 'Failed to load stats'
      }
    })
  }

  function adjustStat(key, delta) {
    const current = parseFloat(stats.value[key] ?? 0)
    stats.value[key] = current + delta
    if (key === 'monthly_expenses' && stats.value.remaining_salary !== undefined) {
      stats.value.remaining_salary = parseFloat(stats.value.remaining_salary ?? 0) - delta
    }
  }

  function invalidate() {
    fetched.value = false
  }

  return { stats, loading, fetched, error, cacheTime, fetchStats, adjustStat, invalidate }
})