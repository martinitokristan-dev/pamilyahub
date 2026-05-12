import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { walletService } from '@/services/walletService.js'

export const useWalletsStore = defineStore('wallets', () => {
  const wallets = ref([])
  const loading = ref(false)
  const error = ref(null)
  const fetched = ref(false)

  const totalBalance = computed(() =>
    wallets.value.reduce((sum, w) => sum + parseFloat(w.balance), 0)
  )

  async function fetchAll(force = false) {
    if (fetched.value && !force) return
    loading.value = true
    try {
      const res = await walletService.getAll()
      wallets.value = res.data.data
      fetched.value = true
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Failed to load wallets'
    } finally {
      loading.value = false
    }
  }

  async function create(data) {
    const res = await walletService.create(data)
    wallets.value.push(res.data.data)
    return res.data.data
  }

  async function update(id, data) {
    const res = await walletService.update(id, data)
    const idx = wallets.value.findIndex((w) => w.id === id)
    if (idx !== -1) wallets.value[idx] = res.data.data
    return res.data.data
  }

  async function remove(id) {
    await walletService.delete(id)
    wallets.value = wallets.value.filter((w) => w.id !== id)
  }

  // Called after an expense is saved so balance reflects immediately without re-fetching
  function adjustBalance(walletId, delta) {
    const w = wallets.value.find((w) => w.id === walletId)
    if (w) w.balance = (parseFloat(w.balance) + delta).toFixed(2)
  }

  return { wallets, loading, error, fetched, totalBalance, fetchAll, create, update, remove, adjustBalance }
})
