import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fileService } from '@/services/fileService.js'
import { useDashboardStore } from './dashboard.js'

export const useFilesStore = defineStore('files', () => {
  const files = ref([])
  const loading = ref(false)
  const uploading = ref(false)
  const uploadProgress = ref(0)
  const error = ref(null)
  const fetched = ref(false)

  async function fetchAll(force = false) {
    if (fetched.value && !force) return
    loading.value = true
    try {
      const res = await fileService.getAll()
      files.value = res.data.data
      fetched.value = true
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Failed to load files'
    } finally {
      loading.value = false
    }
  }

  async function upload(formData) {
    uploading.value = true
    uploadProgress.value = 0
    error.value = null
    try {
      const res = await fileService.upload(formData, (progress) => {
        uploadProgress.value = progress
      })
      files.value.unshift(res.data.data)
      useDashboardStore().invalidate()
      return res.data.data
    } catch (e) {
      error.value = e.response?.data?.message ?? 'Failed to upload file'
      throw e
    } finally {
      uploading.value = false
      uploadProgress.value = 0
    }
  }

  async function remove(id) {
    await fileService.delete(id)
    files.value = files.value.filter((f) => f.id !== id)
    useDashboardStore().invalidate()
  }

  return { files, loading, uploading, uploadProgress, error, fetched, fetchAll, upload, remove }
})
