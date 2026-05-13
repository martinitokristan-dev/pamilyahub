import api from '@/lib/axios.js'

export const incomeService = {
  depositSalary: (deposits) => api.post('/incomes/deposit-salary', { deposits }),
}
