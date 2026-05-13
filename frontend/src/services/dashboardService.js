import api from '@/lib/axios.js'

export default {
  getStats: (params = {}) => api.get('/dashboard/stats', { params }),
}
