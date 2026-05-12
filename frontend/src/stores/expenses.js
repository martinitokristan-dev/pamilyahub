import { defineStore } from 'pinia'
import { ref } from 'vue'
import { expenseService } from '@/services/expenseService.js'
import { useDashboardStore } from './dashboard.js'

export const useExpensesStore = defineStore('expenses', () => {
  const expenses = ref([])
  const loading = ref(false)
  const error = ref(null)
  const fetched = ref(false)

  async function fetchAll(force = false) {
    if (fetched.value && !force) return
    loading.value = true
    try {
      const res = await expenseService.getAll()
      expenses.value = res.data.data
      fetched.value = true
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Failed to load expenses'
    } finally {
      loading.value = false
    }
  }

  async function create(data) {
    const res = await expenseService.create(data)
    expenses.value.unshift(res.data.data)
    useDashboardStore().invalidate()
    return res.data.data
  }

  async function update(id, data) {
    const res = await expenseService.update(id, data)
    const idx = expenses.value.findIndex((e) => e.id === id)
    if (idx !== -1) expenses.value[idx] = res.data.data
    useDashboardStore().invalidate()
    return res.data.data
  }

  async function remove(id) {
    await expenseService.delete(id)
    expenses.value = expenses.value.filter((e) => e.id !== id)
    useDashboardStore().invalidate()
  }

  return { expenses, loading, error, fetched, fetchAll, create, update, remove }
})
