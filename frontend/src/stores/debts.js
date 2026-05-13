import { defineStore } from 'pinia'
import { ref } from 'vue'
import { debtService } from '@/services/debtService.js'
import { useDashboardStore } from './dashboard.js'
import { useToast } from '@/composables/useToast.js'

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
    loading.value = true
    try {
      const res = await debtService.create(data)
      debts.value.unshift(res.data.data)
      useDashboardStore().invalidate()
      useToast().success('Debt created')
      return res.data.data
    } finally {
      loading.value = false
    }
  }

  async function update(id, data) {
    loading.value = true
    try {
      const res = await debtService.update(id, data)
      const idx = debts.value.findIndex((d) => d.id === id)
      if (idx !== -1) debts.value[idx] = res.data.data
      useDashboardStore().invalidate()
      useToast().success('Debt updated')
      return res.data.data
    } finally {
      loading.value = false
    }
  }

  async function markPaid(id, walletId = null) {
    loading.value = true
    try {
      const res = await debtService.markPaid(id, walletId)
      const idx = debts.value.findIndex((d) => d.id === id)
      if (idx !== -1) debts.value[idx] = res.data.data
      useDashboardStore().invalidate()
      useToast().success('Debt marked as paid')
      return res.data.data
    } finally {
      loading.value = false
    }
  }

  async function partialPay(id, amount, walletId = null) {
    loading.value = true
    try {
      const res = await debtService.partialPay(id, amount, walletId)
      const idx = debts.value.findIndex((d) => d.id === id)
      if (idx !== -1) debts.value[idx] = res.data.data
      useDashboardStore().invalidate()
      useToast().success('Partial payment recorded')
      return res.data.data
    } finally {
      loading.value = false
    }
  }

  async function remove(id) {
    loading.value = true
    try {
      await debtService.delete(id)
      debts.value = debts.value.filter((d) => d.id !== id)
      useDashboardStore().invalidate()
      useToast().success('Debt deleted')
    } finally {
      loading.value = false
    }
  }

  return { debts, loading, error, fetched, fetchAll, create, update, markPaid, partialPay, remove }
})
