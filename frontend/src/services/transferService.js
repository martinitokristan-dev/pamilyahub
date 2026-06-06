import api from '@/lib/axios.js'

export const transferService = {
  create: async (data) => {
    const response = await api.post('/transfers', data)
    return response.data
  },
  archive: (id) => api.post(`/transfers/${id}/archive`),
}
