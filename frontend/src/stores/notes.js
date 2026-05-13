import { defineStore } from 'pinia'
import { ref } from 'vue'
import { noteService } from '@/services/noteService.js'
import { useDashboardStore } from './dashboard.js'
import { useToast } from '@/composables/useToast.js'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref([])
  const loading = ref(false)
  const error = ref(null)
  const fetched = ref(false)

  async function fetchAll(force = false) {
    if (fetched.value && !force) return
    loading.value = true
    try {
      const res = await noteService.getAll()
      notes.value = res.data.data
      fetched.value = true
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Failed to load notes'
    } finally {
      loading.value = false
    }
  }

  async function create(data) {
    loading.value = true
    try {
      const res = await noteService.create(data)
      notes.value.unshift(res.data.data)
      useDashboardStore().invalidate()
      useToast().success('Note created')
      return res.data.data
    } finally {
      loading.value = false
    }
  }

  async function update(id, data) {
    loading.value = true
    try {
      const res = await noteService.update(id, data)
      const idx = notes.value.findIndex((n) => n.id === id)
      if (idx !== -1) notes.value[idx] = res.data.data
      useDashboardStore().invalidate()
      useToast().success('Note updated')
      return res.data.data
    } finally {
      loading.value = false
    }
  }

  async function remove(id) {
    loading.value = true
    try {
      await noteService.delete(id)
      notes.value = notes.value.filter((n) => n.id !== id)
      useDashboardStore().invalidate()
      useToast().success('Note deleted')
    } finally {
      loading.value = false
    }
  }

  return { notes, loading, error, fetched, fetchAll, create, update, remove }
})
