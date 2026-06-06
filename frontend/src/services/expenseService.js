import api from "@/lib/axios.js";

export const expenseService = {
  getAll: (params = {}) => api.get("/expenses/feed", { params }),
  create: (data) => api.post("/expenses", data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  archive: (id) => api.post(`/expenses/${id}/archive`),
  getFeed: (params = {}) => api.get("/expenses/feed", { params }),
};
