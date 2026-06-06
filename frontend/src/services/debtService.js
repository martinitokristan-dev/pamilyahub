import api from "@/lib/axios.js";

export const debtService = {
  getAll: (params = {}) => api.get("/debts", { params }),
  create: (data) => api.post("/debts", data),
  update: (id, data) => api.put(`/debts/${id}`, data),
  markPaid: (id, walletId = null) =>
    api.patch(`/debts/${id}/mark-paid`, { wallet_id: walletId }),
  partialPay: (id, amount, walletId = null) =>
    api.patch(`/debts/${id}/partial-pay`, { amount, wallet_id: walletId }),
  delete: (id) => api.delete(`/debts/${id}`),
  archive: (id) => api.post(`/debts/${id}/archive`),
  getFeed: (params = {}) => api.get('/debts/feed', { params }),
};

