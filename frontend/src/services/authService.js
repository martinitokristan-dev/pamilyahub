import api from '@/lib/axios.js'

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  loginWithData: (data) => api.post('/auth/login-with-data', data),
  googleLogin: (idToken) => api.post('/auth/google', { id_token: idToken }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/profile', data),
}
