import { defineStore } from 'pinia'
import { ref } from 'vue'
import { noteService } from '@/services/noteService.js'
import { useDashboardStore } from './dashboard.js'
import { useToast } from '@/composables/useToast.js'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref([])
  const folders = ref([])
  const loading = ref(false)
  const error = ref(null)
  const fetched = ref(false)
  const cacheTime = ref(0)
  const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  function isCacheValid() {
    return Date.now() - cacheTime.value < CACHE_TTL
  }

  async function fetchAll(force = false) {
    if (fetched.value && !force && isCacheValid()) return
    loading.value = true
    try {
      const [notesRes, foldersRes] = await Promise.all([
        noteService.getAll(),
        noteService.getFolders()
      ])
      notes.value = notesRes.data.data
      folders.value = foldersRes.data.data
      fetched.value = true
      cacheTime.value = Date.now()
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

  async function createFolder(data) {
    loading.value = true
    try {
      const res = await noteService.createFolder(data)
      folders.value.push(res.data.data)
      useToast().success('Folder created')
      return res.data.data
    } finally {
      loading.value = false
    }
  }

  async function removeFolder(id) {
    loading.value = true
    try {
      await noteService.deleteFolder(id)
      folders.value = folders.value.filter((f) => f.id !== id)
      // Any notes in this folder should now be uncategorized
      notes.value.forEach(n => {
        if (n.folder_id === id) n.folder_id = null
      })
      useToast().success('Folder removed')
    } finally {
      loading.value = false
    }
  }

  return { 
    notes, folders, loading, error, fetched, 
    fetchAll, create, update, remove, 
    createFolder, removeFolder 
  }
})
