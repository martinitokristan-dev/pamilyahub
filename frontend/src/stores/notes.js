import { defineStore } from 'pinia'
import { ref } from 'vue'
import { noteService } from '@/services/noteService.js'
import { useDashboardStore } from './dashboard.js'
import { useToast } from '@/composables/useToast.js'
import {
  cacheSingleSet,
  cacheSingleGet,
  outboxAdd,
  isNetworkError,
} from '@/lib/offlineDb.js'
import { refreshPendingCount, isSyncing } from '@/lib/syncEngine.js'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref([])
  const folders = ref([])
  const loading = ref(false)
  const error = ref(null)
  const fetched = ref(false)

  // ── Sync listener ────────────────────────────────────────────────────────────
  if (typeof window !== 'undefined') {
    window.addEventListener('pamilya:sync-done', (e) => {
      if (e.detail.entity === 'notes') {
        fetched.value = false
        fetchAll()
        useDashboardStore().invalidate()
      }
    })

    window.addEventListener('pamilya:drain-complete', () => {
      fetched.value = false
      fetchAll(true)
      useDashboardStore().invalidate()
    })
  }

  async function fetchAll(force = false) {
    if (fetched.value && !force) return

    // Hydrate from IndexedDB first for instant display
    if (!notes.value.length) {
      try {
        const cached = await cacheSingleGet('notes')
        if (cached) {
          notes.value = cached.notes ?? []
          folders.value = cached.folders ?? []
        }
      } catch { /* ignore */ }
    }

    // Offline: stop here if we have cached data
    if (!navigator.onLine) {
      if (notes.value.length) {
        fetched.value = true
      }
      return
    }

    // Guard: don't refetch from server during sync drain
    if (isSyncing.value) return

    loading.value = true
    error.value = null
    try {
      const [notesResult, foldersResult] = await Promise.allSettled([
        noteService.getAll(),
        noteService.getFolders()
      ])

      if (notesResult.status === 'fulfilled') {
        notes.value = notesResult.value.data.data
      }
      if (foldersResult.status === 'fulfilled') {
        folders.value = foldersResult.value.data.data ?? []
      }
      fetched.value = true
      await cacheSingleSet('notes', { notes: notes.value, folders: folders.value })
    } catch (e) {
      if (isNetworkError(e) && notes.value.length) {
        fetched.value = true // have cached data
      } else {
        error.value = e.response?.data?.message ?? 'Failed to load notes'
      }
    } finally {
      loading.value = false
    }
  }

  async function create(data) {
    if (!navigator.onLine) return _createOffline(data)
    try {
      const res = await noteService.create(data)
      notes.value.unshift(res.data.data)
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

      const newNote = {
        id: tempId,
        _pending: true,
        ...data,
        created_at: now,
        updated_at: now,
      }
      notes.value.unshift(newNote)

      await cacheSingleSet('notes', { notes: notes.value, folders: folders.value })
      await outboxAdd({ method: 'post', url: '/notes', data, entity: 'notes' })
      await refreshPendingCount()
      useDashboardStore().adjustStat('notes_count', 1)
      return newNote
    } finally {
      loading.value = false
    }
  }

  async function update(id, data) {
    if (!navigator.onLine) return _updateOffline(id, data)
    try {
      const res = await noteService.update(id, data)
      const idx = notes.value.findIndex((n) => n.id === id)
      if (idx !== -1) notes.value[idx] = res.data.data
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
      const idx = notes.value.findIndex((n) => n.id === id)
      if (idx === -1) return

      notes.value[idx] = {
        ...notes.value[idx],
        ...data,
        _pending: true,
        updated_at: new Date().toISOString(),
      }

      await cacheSingleSet('notes', { notes: notes.value, folders: folders.value })
      await outboxAdd({ method: 'put', url: `/notes/${id}`, data, entity: 'notes' })
      await refreshPendingCount()
      return notes.value[idx]
    } finally {
      loading.value = false
    }
  }

  async function remove(id) {
    if (!navigator.onLine) return _removeOffline(id)
    loading.value = true
    try {
      await noteService.delete(id)
      notes.value = notes.value.filter((n) => n.id !== id)
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
      notes.value = notes.value.filter((n) => n.id !== id)
      await cacheSingleSet('notes', { notes: notes.value, folders: folders.value })
      await outboxAdd({ method: 'delete', url: `/notes/${id}`, data: null, entity: 'notes' })
      await refreshPendingCount()
      useDashboardStore().adjustStat('notes_count', -1)
    } finally {
      loading.value = false
    }
  }

  async function createFolder(data) {
    if (!navigator.onLine) return _createFolderOffline(data)
    loading.value = true
    try {
      const res = await noteService.createFolder(data)
      folders.value.push(res.data.data)
      return res.data.data
    } catch (e) {
      if (isNetworkError(e)) return _createFolderOffline(data)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function _createFolderOffline(data) {
    loading.value = true
    try {
      const tempId = `tmp_${crypto.randomUUID()}`
      const now = new Date().toISOString()

      const newFolder = {
        id: tempId,
        _pending: true,
        ...data,
        created_at: now,
      }
      folders.value.push(newFolder)

      await cacheSingleSet('notes', { notes: notes.value, folders: folders.value })
      await outboxAdd({ method: 'post', url: '/note-folders', data, entity: 'notes' })
      await refreshPendingCount()
      return newFolder
    } finally {
      loading.value = false
    }
  }

  async function removeFolder(id) {
    if (!navigator.onLine) return _removeFolderOffline(id)
    loading.value = true
    try {
      await noteService.deleteFolder(id)
      folders.value = folders.value.filter((f) => f.id !== id)
      // Any notes in this folder should now be uncategorized
      notes.value.forEach(n => {
        if (n.folder_id === id) n.folder_id = null
      })
    } catch (e) {
      if (isNetworkError(e)) return _removeFolderOffline(id)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function _removeFolderOffline(id) {
    loading.value = true
    try {
      folders.value = folders.value.filter((f) => f.id !== id)
      notes.value.forEach(n => {
        if (n.folder_id === id) {
          n.folder_id = null
          n._pending = true
        }
      })
      await cacheSingleSet('notes', { notes: notes.value, folders: folders.value })
      await outboxAdd({ method: 'delete', url: `/note-folders/${id}`, data: null, entity: 'notes' })
      await refreshPendingCount()
    } finally {
      loading.value = false
    }
  }

  function invalidate() {
    fetched.value = false
  }

  return { 
    notes, folders, loading, error, fetched,
    fetchAll, create, update, remove, 
    createFolder, removeFolder, invalidate 
  }
})
