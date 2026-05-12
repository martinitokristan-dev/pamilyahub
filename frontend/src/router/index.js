import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue'),
    meta: { guest: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/Register.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/Dashboard.vue'),
      },
      {
        path: 'notes',
        name: 'notes',
        component: () => import('@/views/Notes.vue'),
      },
      {
        path: 'expenses',
        name: 'expenses',
        component: () => import('@/views/Expenses.vue'),
      },
      {
        path: 'debts',
        name: 'debts',
        component: () => import('@/views/Debts.vue'),
      },
      {
        path: 'files',
        name: 'files',
        component: () => import('@/views/Files.vue'),
      },
      {
        path: 'wallets',
        name: 'wallets',
        component: () => import('@/views/Wallets.vue'),
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/Settings.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const isLoggedIn = !!localStorage.getItem('token')

  if (to.meta.requiresAuth && !isLoggedIn) {
    return { name: 'login' }
  }

  if (to.meta.guest && isLoggedIn) {
    return { name: 'dashboard' }
  }
})

export default router
