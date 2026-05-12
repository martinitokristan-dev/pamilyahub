import api from '@/lib/axios.js'

export const debtService = {
  getAll: () => api.get('/debts'),
  create: (data) => api.post('/debts', data),
  update: (id, data) => api.put(`/debts/${id}`, data),
  markPaid: (id, walletId = null) => api.patch(`/debts/${id}/mark-paid`, { wallet_id: walletId }),
  delete: (id) => api.delete(`/debts/${id}`),
}
