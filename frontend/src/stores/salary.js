import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { salaryService } from '@/services/salaryService.js'

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

  async function fetchCurrentMonth() {
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
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Failed to load salary status'
    } finally {
      loading.value = false
    }
  }

  function invalidate() {
    fetched.value = false
    status.value  = null
  }

  return {
    status, month, year, deposits, isDelayed,
    loading, fetched, error,
    isPending, isReceived, latestDeposit,
    fetchCurrentMonth, invalidate,
  }
})
