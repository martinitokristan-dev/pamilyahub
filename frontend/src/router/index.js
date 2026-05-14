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

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  
  // If we don't have a user but are going to a protected route, try to fetch them
  if (!auth.user && to.meta.requiresAuth) {
    try {
      await auth.fetchMe()
    } catch (err) {
      // Silent fail, isLoggedIn will be false
      console.log('User not authenticated on initial load')
    }
  }

  const isLoggedIn = !!auth.user

  if (to.meta.requiresAuth && !isLoggedIn) {
    return { name: 'login' }
  }

  if (to.meta.guest && isLoggedIn) {
    return { name: 'dashboard' }
  }
})

export default router
