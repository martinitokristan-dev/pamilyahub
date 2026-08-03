import api from '@/lib/axios.js'

export const noteService = {
  getAll: () => api.get('/notes'),
  create: (data) => api.post('/notes', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
  
  // Folders
  getFolders: () => api.get('/note-folders'),
  createFolder: (data) => api.post('/note-folders', data),
  deleteFolder: (id) => api.delete(`/note-folders/${id}`),

  extractTextFromImage: (formData, onProgress) =>
    api.post('/notes/extract-text-from-image', formData, {
      timeout: 90000,
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      },
    }),
}
