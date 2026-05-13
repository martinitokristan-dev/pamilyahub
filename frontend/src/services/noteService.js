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
}
