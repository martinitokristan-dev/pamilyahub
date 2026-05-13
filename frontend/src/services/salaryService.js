import api from '@/lib/axios.js'

export const salaryService = {
  /** GET /api/salary-deposits/current-month */
  getCurrentMonth: () => api.get('/salary-deposits/current-month'),

  /** POST /api/salary-deposits */
  deposit: (payload) => api.post('/salary-deposits', payload),
}
