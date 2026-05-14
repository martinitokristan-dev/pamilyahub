import { defineStore } from 'pinia'
import { ref } from 'vue'
import { noteService } from '@/services/noteService.js'
import { useDashboardStore } from './dashboard.js'
import { useToast } from '@/composables/useToast.js'
import { performSilentFetch } from '@/utils/storeHelper.js'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref([])
  const folders = ref([])
  const loading = ref(false)
  const error = ref(null)
  const fetched = ref(false)
  const cacheTime = ref(0)

  async function fetchAll(force = false) {
    await performSilentFetch({
      loading,
      fetched,
      cacheTime,
      currentData: notes.value,
      force,
      backgroundTtl: 60000,
      fetchFn: async () => {
        const [notesResult, foldersResult] = await Promise.allSettled([
          noteService.getAll(),
          noteService.getFolders()
        ])

        if (notesResult.status === 'fulfilled') {
          notes.value = notesResult.value.data.data
        }
        if (foldersResult.status === 'fulfilled') {
          folders.value = foldersResult.value.data.data
        }
      }
    }).catch(e => {
      error.value = e.response?.data?.message ?? 'Failed to load notes'
    })
  }

  async function create(data) {
    loading.value = true
    try {
      const res = await noteService.create(data)
      notes.value.unshift(res.data.data)
      useDashboardStore().invalidate()
      invalidate()
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
      invalidate()
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
      invalidate()
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

  function invalidate() {
    fetched.value = false
  }

  return { 
    notes, folders, loading, error, fetched, cacheTime,
    fetchAll, create, update, remove, 
    createFolder, removeFolder, invalidate 
  }
})
