import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { salaryService } from '@/services/salaryService.js'
import { useWalletsStore } from './wallets.js'
import { useDashboardStore } from './dashboard.js'
import { useToast } from '@/composables/useToast.js'
import {
  cacheSingleSet,
  cacheSingleGet,
  cacheGet,
  cacheUpsert,
  outboxAdd,
  isNetworkError,
} from '@/lib/offlineDb.js'
import { refreshPendingCount, isSyncing } from '@/lib/syncEngine.js'
import { performSilentFetch } from '@/utils/storeHelper.js'

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
        useDashboardStore().invalidate()
      }
    })
    window.addEventListener('pamilya:drain-complete', (e) => {
      const entities = e.detail?.entities || []
      if (entities.includes('salary')) {
        fetched.value = false
      }
    })
  }

  async function fetchCurrentMonth(force = false) {
    return performSilentFetch({
      loading,
      fetched,
      cacheKey: 'current-month',
      backgroundTtl: 60000,
      force,
      fetchFn: async () => {
        // Block network fetch during outbox drain
        if (isSyncing.value) return

        if (!navigator.onLine && !status.value) {
          try {
            const cached = await cacheSingleGet('salary')
            if (cached) {
              status.value = cached.status
              month.value = cached.month
              year.value = cached.year
              isDelayed.value = cached.is_delayed ?? false
              deposits.value = cached.deposits ?? []
              return
            }
          } catch { /* ignore */ }
        }

        try {
          const res = await salaryService.getCurrentMonth()
          const data = res.data.data
          status.value = data.status
          month.value = data.month
          year.value = data.year
          isDelayed.value = data.is_delayed ?? false
          deposits.value = data.deposits ?? []
          await cacheSingleSet('salary', data)
        } catch (e) {
          if (isNetworkError(e) && status.value) {
            // keep existing
          } else {
            error.value = e.response?.data?.message ?? 'Failed to load salary status'
          }
        }
      }
    })
  }

  // ── deposit ──────────────────────────────────────────────────────────────────
  async function deposit(payload) {
    // Remove navigator.onLine check - it's unreliable. Let the actual request determine offline status.
    loading.value = true
    try {
      await salaryService.deposit(payload)
      const walletsStore = useWalletsStore()
      for (const a of payload.allocations) {
        if (parseFloat(a.amount) > 0) {
          await walletsStore.adjustBalance(a.wallet_id, parseFloat(a.amount))
        }
      }
      fetched.value = false
      await fetchCurrentMonth()
      // Invalidate dashboard AFTER fetching current month to avoid showing 0 stats
      await useDashboardStore().fetchStats({ month: month.value, year: year.value }, true)
      walletsStore.invalidate()
      const { useExpensesStore } = await import('./expenses.js')
      useExpensesStore().invalidate()
      useToast().salary('Salary deposited', '₱' + parseFloat(payload.total_amount).toLocaleString())
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
      _clientKey: crypto.randomUUID(),
      _pending: true,
      total_amount: payload.total_amount,
      already_spent: payload.already_spent,
      notes: payload.notes,
      allocations: payload.allocations,
      created_at: now,
    })

    const walletsStore = useWalletsStore()
    if (walletsStore.wallets.length === 0) {
      try {
        const cached = await cacheGet('wallets')
        if (cached && cached.length > 0) {
          walletsStore.wallets = cached
        }
      } catch {}
    }
    for (const a of payload.allocations) {
      if (parseFloat(a.amount) > 0) {
        await walletsStore.adjustBalance(a.wallet_id, parseFloat(a.amount))
      }
    }

    await cacheSingleSet('salary', {
      status: status.value,
      month: month.value,
      year: year.value,
      is_delayed: isDelayed.value,
      deposits: deposits.value,
    })

    await outboxAdd({ method: 'post', url: '/salary-deposits', data: payload, entity: 'salary' })
    await refreshPendingCount()

    const dbStore = useDashboardStore()
    const totalAmount = parseFloat(payload.total_amount || 0)
    dbStore.adjustStat('monthly_income', totalAmount)

    const alreadySpent = parseFloat(payload.already_spent || 0)
    if (alreadySpent > 0) {
      const { useExpensesStore } = await import("./expenses.js")
      const expStore = useExpensesStore()
      const nowStr = new Date().toISOString()
      const optimisticExpense = {
        id: `tmp_spent_${crypto.randomUUID()}`,
        title: "Already Spent",
        amount: String(payload.already_spent),
        category: "Already Spent",
        date: nowStr.split("T")[0],
        wallet_id: null,
        wallet: null,
        description: "Pre-existing spending logged during salary deposit",
        created_at: nowStr,
        updated_at: nowStr,
        _pending: true,
      }
      expStore.expenses.unshift(optimisticExpense)
      await cacheUpsert("expenses", optimisticExpense)
      dbStore.adjustStat('monthly_expenses', alreadySpent)
    }

    useToast().offline('Deposit saved offline', 'Will sync when connected')
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
