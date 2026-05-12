import { defineStore } from 'pinia'
import { ref } from 'vue'
import { debtService } from '@/services/debtService.js'
import { useDashboardStore } from './dashboard.js'

export const useDebtsStore = defineStore('debts', () => {
  const debts = ref([])
  const loading = ref(false)
  const error = ref(null)
  const fetched = ref(false)

  async function fetchAll(force = false) {
    if (fetched.value && !force) return
    loading.value = true
    try {
      const res = await debtService.getAll()
      debts.value = res.data.data
      fetched.value = true
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Failed to load debts'
    } finally {
      loading.value = false
    }
  }

  async function create(data) {
    const res = await debtService.create(data)
    debts.value.unshift(res.data.data)
    useDashboardStore().invalidate()
    return res.data.data
  }

  async function update(id, data) {
    const res = await debtService.update(id, data)
    const idx = debts.value.findIndex((d) => d.id === id)
    if (idx !== -1) debts.value[idx] = res.data.data
    useDashboardStore().invalidate()
    return res.data.data
  }

  async function markPaid(id, walletId = null) {
    const res = await debtService.markPaid(id, walletId)
    const idx = debts.value.findIndex((d) => d.id === id)
    if (idx !== -1) debts.value[idx] = res.data.data
    useDashboardStore().invalidate()
    return res.data.data
  }

  async function remove(id) {
    await debtService.delete(id)
    debts.value = debts.value.filter((d) => d.id !== id)
    useDashboardStore().invalidate()
  }

  return { debts, loading, error, fetched, fetchAll, create, update, markPaid, remove }
})
