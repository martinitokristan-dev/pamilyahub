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
    path: '/auth/google/callback',
    name: 'google-callback',
    component: () => import('@/views/GoogleCallback.vue'),
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
      {
        path: 'guide',
        name: 'guide',
        component: () => import('@/views/Guide.vue'),
      },
      {
        path: 'admin/api-usage',
        name: 'api-dashboard',
        component: () => import('@/views/ApiDashboard.vue'),
      },
      {
        path: 'admin/ai-logs',
        name: 'ai-logs',
        component: () => import('@/views/AiLogsPanel.vue'),
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
  
  // Assume logged in if they have a token in localStorage, or if auth.user is populated.
  // The actual user object will be fetched in the background by AppLayout.vue.
  const hasToken = !!localStorage.getItem('auth_token')
  const isLoggedIn = !!auth.user || hasToken

  if (to.meta.requiresAuth && !isLoggedIn) {
    return { name: 'login' }
  }

  if (to.meta.guest && isLoggedIn) {
    return { name: 'dashboard' }
  }

  if (to.name === 'files') {
    if (auth.user && auth.user.email !== 'martinitokristan@gmail.com') {
      return { name: 'dashboard' }
    }
  }

  if (to.name === 'api-dashboard') {
    if (auth.user && auth.user.email !== 'martinitokristan@gmail.com') {
      return { name: 'dashboard' }
    }
  }

  if (to.name === 'ai-logs') {
    if (auth.user && auth.user.email !== 'martinitokristan@gmail.com') {
      return { name: 'dashboard' }
    }
  }
})

export default router
