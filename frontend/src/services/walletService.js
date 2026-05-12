import api from '@/lib/axios.js'

export const walletService = {
  getAll:  ()           => api.get('/wallets'),
  create:  (data)       => api.post('/wallets', data),
  update:  (id, data)   => api.put(`/wallets/${id}`, data),
  delete:  (id)         => api.delete(`/wallets/${id}`),
}
