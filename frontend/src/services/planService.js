import api from '@/lib/axios.js'

export const planService = {
  getAll: (params) => api.get('/upcoming-payments', { params }),
  create: (data) => api.post('/upcoming-payments', data),
  update: (id, data) => api.put(`/upcoming-payments/${id}`, data),
  delete: (id) => api.delete(`/upcoming-payments/${id}`),
  markPaid: (id, data) => api.patch(`/upcoming-payments/${id}/mark-paid`, data),
}
