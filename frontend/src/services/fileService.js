import api from '@/lib/axios.js'

export const fileService = {
  getAll: () => api.get('/files'),
  upload: (formData, onProgress) =>
    api.post('/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percentCompleted)
        }
      },
    }),
  delete: (id) => api.delete(`/files/${id}`),
}
