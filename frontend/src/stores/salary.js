import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { salaryService } from '@/services/salaryService.js'
import { useWalletsStore } from './wallets.js'
import { useDashboardStore } from './dashboard.js'
import { useToast } from '@/composables/useToast.js'
import {
  cacheSingleSet,
  cacheSingleGet,
  outboxAdd,
  isNetworkError,
} from '@/lib/offlineDb.js'
import { refreshPendingCount } from '@/lib/syncEngine.js'

export const useSalaryStore = defineStore('salary', () => {
  const status   = ref(null)   // 'pending' | 'received'
  const month    = ref(null)
  const year     = ref(null)
  const deposits = ref([])
  const isDelayed = ref(false)
  const loading  = ref(false)
  const fetched  = ref(false)
  const error    = ref(null)

  const isPending  = computed(() => status.value === 'pending')
  const isReceived = computed(() => status.value === 'received')

  // Latest deposit record (most recent of the month)
  const latestDeposit = computed(() =>
    deposits.value.length
      ? deposits.value[deposits.value.length - 1]
      : null
  )

  // ── Sync listener ────────────────────────────────────────────────────────────
  if (typeof window !== 'undefined') {
    window.addEventListener('pamilya:sync-done', (e) => {
      if (e.detail.entity === 'salary') {
        fetched.value = false
        fetchCurrentMonth()
        useDashboardStore().invalidate()
      }
    })
  }

  async function fetchCurrentMonth() {
    if (fetched.value) return

    // Hydrate from cache if offline
    if (!navigator.onLine && !status.value) {
      try {
        const cached = await cacheSingleGet('salary')
        if (cached) {
          status.value    = cached.status
          month.value     = cached.month
          year.value      = cached.year
          isDelayed.value = cached.is_delayed ?? false
          deposits.value  = cached.deposits ?? []
          fetched.value   = true
          return
        }
      } catch { /* ignore */ }
    }

    loading.value = true
    error.value   = null
    try {
      const res        = await salaryService.getCurrentMonth()
      const data       = res.data.data
      status.value     = data.status
      month.value      = data.month
      year.value       = data.year
      isDelayed.value  = data.is_delayed ?? false
      deposits.value   = data.deposits ?? []
      fetched.value    = true
      await cacheSingleSet('salary', data)
    } catch (e) {
      if (isNetworkError(e) && status.value) {
        fetched.value = true // have cached data
      } else {
        error.value = e.response?.data?.message ?? 'Failed to load salary status'
      }
    } finally {
      loading.value = false
    }
  }

  // ── deposit ──────────────────────────────────────────────────────────────────
  async function deposit(payload) {
    if (!navigator.onLine) return _depositOffline(payload)
    loading.value = true
    try {
      await salaryService.deposit(payload)
      const walletsStore = useWalletsStore()
      payload.allocations.forEach(a => {
        if (parseFloat(a.amount) > 0) walletsStore.adjustBalance(a.wallet_id, parseFloat(a.amount))
      })
      fetched.value = false
      await fetchCurrentMonth()
      useDashboardStore().fetchStats()
      walletsStore.invalidate()
      const { useExpensesStore } = await import('./expenses.js')
      useExpensesStore().invalidate()
      useToast().success('Salary deposited successfully!')
      return { offline: false }
    } catch (e) {
      if (isNetworkError(e)) return _depositOffline(payload)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function _depositOffline(payload) {
    const tempId = `tmp_${crypto.randomUUID()}`
    const now = new Date().toISOString()

    status.value = 'received'
    deposits.value.push({
      id: tempId,
      _pending: true,
      total_amount: payload.total_amount,
      already_spent: payload.already_spent,
      notes: payload.notes,
      allocations: payload.allocations,
      created_at: now,
    })

    const walletsStore = useWalletsStore()
    payload.allocations.forEach(a => {
      if (parseFloat(a.amount) > 0) walletsStore.adjustBalance(a.wallet_id, parseFloat(a.amount))
    })

    await cacheSingleSet('salary', {
      status: status.value,
      month: month.value,
      year: year.value,
      is_delayed: isDelayed.value,
      deposits: deposits.value,
    })

    await outboxAdd({ method: 'post', url: '/salary-deposits', data: payload, entity: 'salary' })
    await refreshPendingCount()
    useDashboardStore().invalidate()
    useToast().info('Deposit saved offline — will sync when connected')
    return { offline: true }
  }

  function invalidate() {
    fetched.value = false
    status.value  = null
  }

  return {
    status, month, year, deposits, isDelayed,
    loading, fetched, error,
    isPending, isReceived, latestDeposit,
    fetchCurrentMonth, deposit, invalidate,
  }
})
