import api from '@/lib/axios.js'

export default {
  getStats: () => api.get('/dashboard/stats'),
}
