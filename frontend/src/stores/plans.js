import { defineStore } from 'pinia'
import { ref } from 'vue'
import { planService } from '@/services/planService.js'
import { useDashboardStore } from './dashboard.js'
import { useExpensesStore } from './expenses.js'
import { useWalletsStore } from './wallets.js'
import {
  cacheSingleSet,
  cacheSingleGet,
  outboxAdd,
  isNetworkError,
} from '@/lib/offlineDb.js'
import { refreshPendingCount, isSyncing } from '@/lib/syncEngine.js'
import { notifyFinanceActivity } from '@/lib/financeEvents.js'

export const usePlansStore = defineStore('plans', () => {
  const plans = ref([])
  const loading = ref(false)
  const error = ref(null)
  const fetched = ref(false)
  const hasMore = ref(false)
  const nextCursor = ref(null)

  // ── Sync listener ────────────────────────────────────────────────────────────
  if (typeof window !== 'undefined') {
    window.addEventListener('pamilya:sync-done', (e) => {
      if (e.detail.entity === 'plans') {
        useDashboardStore().invalidate()
        invalidate()
      }
    })

    window.addEventListener('pamilya:drain-complete', () => {
      fetched.value = false
      useDashboardStore().invalidate()
    })
  }

  async function fetchAll(force = false) {
    if (fetched.value && !force) return

    // Hydrate from IndexedDB first for instant display
    if (!plans.value.length) {
      try {
        const cached = await cacheSingleGet('plans')
        if (cached) {
          plans.value = cached.plans ?? []
          hasMore.value = cached.hasMore ?? false
          nextCursor.value = cached.nextCursor ?? null
        }
      } catch { /* ignore */ }
    }

    // Offline: stop here if we have cached data
    if (!navigator.onLine) {
      if (plans.value.length) {
        fetched.value = true
      }
      return
    }

    // Guard: don't refetch from server during sync drain
    if (isSyncing.value) return

    loading.value = true
    error.value = null
    try {
      const res = await planService.getAll()
      plans.value = res.data.data
      fetched.value = true
      hasMore.value = false
      nextCursor.value = null
      await cacheSingleSet('plans', { plans: plans.value, hasMore: false, nextCursor: null })
    } catch (e) {
      if (isNetworkError(e) && plans.value.length) {
        fetched.value = true // have cached data
      } else {
        error.value = e.response?.data?.message ?? 'Failed to load plans'
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchFeed(params = {}) {
    loading.value = true
    error.value = null
    try {
      const res = await planService.getAll(params)
      if (params.cursor) {
        plans.value = [...plans.value, ...res.data.data]
      } else {
        plans.value = res.data.data
        fetched.value = true
      }
      hasMore.value = res.data.meta?.has_more ?? false
      nextCursor.value = res.data.meta?.next_cursor ?? null
      
      await cacheSingleSet('plans', { 
        plans: plans.value, 
        hasMore: hasMore.value, 
        nextCursor: nextCursor.value 
      })
    } catch (e) {
      if (!isNetworkError(e)) {
        error.value = e.response?.data?.message ?? 'Failed to load plans feed'
      }
    } finally {
      loading.value = false
    }
  }

  async function create(data) {
    if (!navigator.onLine) return _createOffline(data)
    try {
      const res = await planService.create(data)
      plans.value.push(res.data.data)
      // Sort plans by due_date after push
      plans.value.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      useDashboardStore().invalidate()
      invalidate()
      return res.data.data
    } catch (e) {
      if (isNetworkError(e)) return _createOffline(data)
      throw e
    }
  }

  async function _createOffline(data) {
    loading.value = true
    try {
      const tempId = `tmp_${crypto.randomUUID()}`
      const now = new Date().toISOString()

      const newPlan = {
        id: tempId,
        _clientKey: crypto.randomUUID(),
        _pending: true,
        ...data,
        is_paid: false,
        created_at: now,
        updated_at: now,
      }
      plans.value.push(newPlan)
      plans.value.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))

      await cacheSingleSet('plans', { plans: plans.value })
      await outboxAdd({ method: 'post', url: '/upcoming-payments', data, entity: 'plans' })
      await refreshPendingCount()
      return newPlan
    } finally {
      loading.value = false
    }
  }

  async function update(id, data) {
    if (!navigator.onLine) return _updateOffline(id, data)
    try {
      const res = await planService.update(id, data)
      const idx = plans.value.findIndex((p) => p.id === id)
      if (idx !== -1) {
        plans.value[idx] = res.data.data
        plans.value.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      }
      useDashboardStore().invalidate()
      invalidate()
      return res.data.data
    } catch (e) {
      if (isNetworkError(e)) return _updateOffline(id, data)
      throw e
    }
  }

  async function _updateOffline(id, data) {
    loading.value = true
    try {
      const idx = plans.value.findIndex((p) => p.id === id)
      if (idx === -1) return

      plans.value[idx] = {
        ...plans.value[idx],
        ...data,
        _pending: true,
        updated_at: new Date().toISOString(),
      }
      plans.value.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))

      await cacheSingleSet('plans', { plans: plans.value })
      await outboxAdd({ method: 'put', url: `/upcoming-payments/${id}`, data, entity: 'plans' })
      await refreshPendingCount()
      return plans.value[idx]
    } finally {
      loading.value = false
    }
  }

  async function remove(id) {
    if (!navigator.onLine) return _removeOffline(id)
    loading.value = true
    try {
      await planService.delete(id)
      plans.value = plans.value.filter((p) => p.id !== id)
      useDashboardStore().invalidate()
      invalidate()
    } catch (e) {
      if (isNetworkError(e)) return _removeOffline(id)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function _removeOffline(id) {
    loading.value = true
    try {
      plans.value = plans.value.filter((p) => p.id !== id)
      await cacheSingleSet('plans', { plans: plans.value })
      await outboxAdd({ method: 'delete', url: `/upcoming-payments/${id}`, data: null, entity: 'plans' })
      await refreshPendingCount()
    } finally {
      loading.value = false
    }
  }

  async function markPaid(id, walletId = null, amount = null, isPartial = false, newDueDate = null, options = {}) {
    if (!navigator.onLine) return _markPaidOffline(id, walletId, amount, isPartial, newDueDate, options)
    loading.value = true
    try {
      const payload = { wallet_id: walletId }
      if (amount !== null) payload.amount = amount
      if (isPartial) payload.is_partial = isPartial
      if (newDueDate) payload.new_due_date = newDueDate
      if (options.expense_description) payload.expense_description = options.expense_description

      const res = await planService.markPaid(id, payload)
      const idx = plans.value.findIndex((p) => p.id === id)
      if (idx !== -1) {
        plans.value[idx] = res.data.data
      }
      // If paid via wallet, invalidate expenses and wallets to show new balance and transaction
      if (walletId) {
        useExpensesStore().invalidate()
        useWalletsStore().invalidate()
      }
      useDashboardStore().invalidate()
      invalidate()
      if (res.data.data?.is_paid) {
        notifyFinanceActivity({ entity: 'plan', action: 'paid', planId: id })
      }
      return res.data.data
    } catch (e) {
      if (isNetworkError(e)) return _markPaidOffline(id, walletId, amount, isPartial, newDueDate)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function _markPaidOffline(id, walletId, amount, isPartial, newDueDate, options = {}) {
    loading.value = true
    try {
      const idx = plans.value.findIndex((p) => p.id === id)
      if (idx === -1) return

      const paidDate = new Date().toISOString().split('T')[0]
      const plan = plans.value[idx]
      const payAmount = amount ?? plan.amount

      const payload = { wallet_id: walletId }
      if (amount !== null) payload.amount = amount
      if (isPartial) payload.is_partial = isPartial
      if (newDueDate) payload.new_due_date = newDueDate
      if (options.expense_description) payload.expense_description = options.expense_description

      if (isPartial) {
        const remaining = Math.max(0, parseFloat(plan.amount) - parseFloat(payAmount))
        plans.value[idx].amount = remaining
        if (newDueDate) {
          plans.value[idx].due_date = newDueDate
        }
        if (remaining <= 0) {
          plans.value[idx].is_paid = true
          plans.value[idx].paid_date = paidDate
        }
      } else {
        plans.value[idx].is_paid = true
        plans.value[idx].paid_date = paidDate
      }
      
      plans.value[idx]._pending = true
      plans.value[idx].updated_at = new Date().toISOString()

      await cacheSingleSet('plans', { plans: plans.value })
      await outboxAdd({ 
        method: 'patch', 
        url: `/upcoming-payments/${id}/mark-paid`, 
        data: payload, 
        entity: 'plans' 
      })

      if (walletId) {
        // Optimistically deduct balance offline
        const walletsStore = useWalletsStore()
        const wallet = walletsStore.wallets.find(w => w.id === walletId)
        if (wallet) {
          const currentBal = parseFloat(wallet.balance) || 0
          wallet.balance = Math.max(0, currentBal - parseFloat(payAmount))
          await cacheSingleSet('wallets', { wallets: walletsStore.wallets })
          
          // And optimistically add an expense to expenses store if it is loaded
          const expensesStore = useExpensesStore()
          expensesStore.expenses.unshift({
            id: `tmp_${crypto.randomUUID()}`,
            title: plan.title,
            amount: payAmount,
            description: options.expense_description || plan.description,
            date: paidDate,
            wallet_id: walletId,
            wallet: wallet,
            created_at: new Date().toISOString(),
            _pending: true
          })
          await cacheSingleSet('expenses', { expenses: expensesStore.expenses })
        }
      }

      await refreshPendingCount()
      return plans.value[idx]
    } finally {
      loading.value = false
    }
  }

  function invalidate() {
    fetched.value = false
  }

  return {
    plans,
    loading,
    error,
    fetched,
    hasMore,
    nextCursor,
    fetchAll,
    fetchFeed,
    create,
    update,
    remove,
    markPaid,
    invalidate,
  }
})
