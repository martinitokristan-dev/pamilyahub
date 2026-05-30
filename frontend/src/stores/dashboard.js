import { defineStore } from 'pinia'
import { ref } from 'vue'
import dashboardService from '@/services/dashboardService.js'

import { performSilentFetch } from '@/utils/storeHelper.js'
import { cacheSingleSet, cacheSingleGet, cacheSingleRemove, isNetworkError } from '@/lib/offlineDb.js'
import { pendingCount } from '@/lib/syncEngine.js'

export const useDashboardStore = defineStore('dashboard', () => {
  const createDefaultStats = () => ({
    notes_count: 0,
    monthly_income: 0,
    monthly_expenses: 0,
    remaining_salary: 0,
    debts_owed_to_me: 0,
    debts_i_owe: 0,
    files_count: 0
  })

  const stats = ref(createDefaultStats())
  const loading = ref(false)
  const fetched = ref(false)
  const error = ref(null)
  const cacheTime = ref(0)
  const lastCacheKey = ref(null)

  async function fetchStats(filters = {}, force = false) {
    const m = filters.month ?? new Date().getMonth() + 1
    const y = filters.year ?? new Date().getFullYear()
    const cacheKey = `dashboard_${y}_${m}`
    const isNewRequest = lastCacheKey.value !== cacheKey

    if (isNewRequest) {
      fetched.value = false
      lastCacheKey.value = cacheKey

      // Hydrate from IndexedDB first — avoid wiping in-memory optimistic stats with zeros
      try {
        const cached = await cacheSingleGet('dashboard', cacheKey)
        stats.value = cached ?? createDefaultStats()
      } catch {
        stats.value = createDefaultStats()
      }
    }

    const useLocalStatsOnly = !navigator.onLine || pendingCount.value > 0

    await performSilentFetch({
      loading,
      fetched,
      cacheTime,
      currentData: stats.value,
      cacheKey,
      force: force && !useLocalStatsOnly,
      fetchFn: async () => {
        if (useLocalStatsOnly) return

        try {
          const res = await dashboardService.getStats(filters)
          stats.value = res.data.data
          await cacheSingleSet('dashboard', res.data.data, cacheKey)
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

  async function adjustStat(key, delta) {
    const current = parseFloat(stats.value[key] ?? 0)
    stats.value[key] = current + delta
    if (key === 'monthly_expenses' && stats.value.remaining_salary !== undefined) {
      stats.value.remaining_salary = parseFloat(stats.value.remaining_salary ?? 0) - delta
    }
    if (key === 'monthly_income' && stats.value.remaining_salary !== undefined) {
      stats.value.remaining_salary = parseFloat(stats.value.remaining_salary ?? 0) + delta
    }
    const cacheKey = lastCacheKey.value || `dashboard_${new Date().getFullYear()}_${new Date().getMonth() + 1}`
    try {
      await cacheSingleSet('dashboard', stats.value, cacheKey)
    } catch (e) {
      console.error('Failed to update cached dashboard stats', e)
    }
  }

  function invalidate(filters = {}) {
    const m = filters.month ?? new Date().getMonth() + 1
    const y = filters.year ?? new Date().getFullYear()
    const cacheKey = `dashboard_${y}_${m}`
    
    fetched.value = false
    lastCacheKey.value = null
    cacheSingleRemove('dashboard', cacheKey)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pamilya:drain-complete', () => {
      fetched.value = false
      lastCacheKey.value = null
    })
  }

  return { stats, loading, fetched, error, cacheTime, lastCacheKey, fetchStats, adjustStat, invalidate }

})