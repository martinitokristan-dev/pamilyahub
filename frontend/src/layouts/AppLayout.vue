<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { useSwipeNavigation } from '@/composables/useSwipeNavigation.js'
import { useNotesStore } from '@/stores/notes.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useDebtsStore } from '@/stores/debts.js'
import { useFilesStore } from '@/stores/files.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDarkMode } from '@/composables/useDarkMode.js'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useSalaryStore } from '@/stores/salary.js'
import { useModalsStore } from '@/stores/modals.js'

import WalletModal from '@/components/modals/WalletModal.vue'
import ExpenseModal from '@/components/modals/ExpenseModal.vue'
import DebtModal from '@/components/modals/DebtModal.vue'
import NoteModal from '@/components/modals/NoteModal.vue'
import FileModal from '@/components/modals/FileModal.vue'
import DepositSalaryModal from '@/components/financial/DepositSalaryModal.vue'
import TransferModal from '@/components/modals/TransferModal.vue'

import {
  LayoutDashboard,
  NotebookPen,
  Receipt,
  HandCoins,
  FolderOpen,
  LogOut,
  Home,
  Settings,
  Plus,
  X,
  Wallet,
  Activity,
  BrainCircuit,
  Archive,
  ArrowRightLeft,
  Calendar,
} from 'lucide-vue-next'

import { useDashboardStore } from '@/stores/dashboard.js'
import OfflineBanner from '@/components/OfflineBanner.vue'
import AiChat from '@/components/AiChat.vue'

const auth = useAuthStore()
const dashboard = useDashboardStore()
const notes = useNotesStore()
const expenses = useExpensesStore()
const debts = useDebtsStore()
const files = useFilesStore()
const wallets = useWalletsStore()
const salary = useSalaryStore()
const modals = useModalsStore()
const route = useRoute()
const router = useRouter()
const { isDark } = useDarkMode()
const appRootRef = ref(null)

useSwipeNavigation(appRootRef)

watch(() => route.fullPath, async () => {
  await nextTick()
  const main = document.querySelector('main')
  if (main) {
    main.scrollTop = 0
  }
})

// Redirect if accessing files or admin routes unauthorized
watch(() => auth.user, (user) => {
  if (user && user.email !== 'martinitokristan@gmail.com') {
    if (route.path.startsWith('/files') || route.path.startsWith('/admin/api-usage')) {
      router.push('/')
    }
  }
}, { immediate: true })

watch(() => route.path, (path) => {
  if (auth.user && auth.user.email !== 'martinitokristan@gmail.com') {
    if (path.startsWith('/files') || path.startsWith('/admin/api-usage')) {
      router.push('/')
    }
  }
})

const {
  offlineReady,
  needRefresh,
  updateServiceWorker,
} = useRegisterSW({
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      // Check for service worker updates every 30 minutes
      // This ensures users get update notifications even if the app stays open
      setInterval(() => {
        registration.update()
      }, 1 * 60 * 1000) // Fast check for testing (1 min)
    }
  }
})

const isUpdating = ref(false)

// Handle App Auto-Update when a new version is detected
watch(needRefresh, (newValue) => {
  if (newValue) {
    isUpdating.value = true
    
    // Trigger local push notification on the device if allowed
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification("EleFam Update", {
          body: "A new version of EleFam is installing. The app will reload to apply changes.",
          icon: "/icons/wallets/EF-logo-192.png",
          tag: "elefam-update",
          requireInteraction: false
        })
      } catch (err) {
        console.error("Failed to show local notification:", err)
      }
    }
    
    // Smooth transition delay so the user sees the "Updating..." splash screen
    setTimeout(() => {
      updateServiceWorker(true)
    }, 2000)
  }
})


onMounted(async () => {
  // Ensure user is hydrated from cache before proceeding (avoids race condition where
  // wave loading is skipped because hydrateUser() hasn't resolved yet)
  await auth.hydrateUser()

  // If we still don't have the user object, fetch it in the background (online only)
  if (!auth.user && localStorage.getItem('auth_token')) {
    auth.fetchMe().catch(() => {}) // 401s are handled automatically by axios interceptor
  }

  // Clear any accidental service workers on localhost to prevent reload loops
  if (window.location.hostname === 'localhost' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister()
      }
    })
  }

  // On fresh install (first time opening the app), ask for notification permission ONLY ON MOBILE
  // This ensures users will see update notifications from the service worker later
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  
  if (isMobile && import.meta.env.PROD && 'Notification' in window && Notification.permission === 'default') {
    // Wait a bit after mount so it doesn't feel too intrusive
    setTimeout(() => {
      Notification.requestPermission().catch(err => console.error('Notification permission denied:', err))
    }, 5000)
  }

  // Hydrate user and fetch global UI data
  if (auth.user) {
    Promise.all([
      wallets.fetchAll(),
      salary.fetchCurrentMonth(),
      dashboard.fetchStats(), // Keep stats for header/general availability
      // expenses.fetchAll() // Removed: Dashboard.vue or Expenses.vue will own this
    ]).catch(() => {})
  }
})

const showMoreMenu = ref(false)
const showSpeedDial = ref(false)

const speedDialActions = computed(() => {
  const actions = [
    { name: 'Transfer', icon: ArrowRightLeft, action: () => modals.openTransferModal(), color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
    { name: 'Deposit', icon: HandCoins, action: () => modals.openDepositModal(), color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
    { name: 'Expense', icon: Receipt, action: () => modals.openExpenseModal(), color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
    { name: 'Wallet', icon: Wallet, action: () => modals.openWalletModal(), color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
    { name: 'Debt', icon: HandCoins, action: () => modals.openDebtModal(), color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
    { name: 'Note', icon: NotebookPen, action: () => modals.openNoteModal(), color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  ]
  if (auth.user?.email === 'martinitokristan@gmail.com') {
    actions.push({ name: 'File', icon: FolderOpen, action: () => modals.openFileModal(), color: 'text-zinc-500 dark:text-zinc-400', bg: 'bg-zinc-100 dark:bg-zinc-800' })
  }
  return actions
})
const nav = [
  { name: 'Home', to: '/', icon: Home },
  { name: 'Plan', to: '/plans', icon: Calendar },
  { name: 'API Usage', to: '/admin/api-usage', icon: Activity },
  { name: 'AI Logs',  to: '/admin/ai-logs', icon: BrainCircuit },
  { name: 'Notes', to: '/notes', icon: NotebookPen },
  { name: 'Expenses', to: '/expenses', icon: Receipt },
  { name: 'Wallets', to: '/wallets', icon: Wallet },
  { name: 'Debts', to: '/debts', icon: HandCoins },
  { name: 'Archives', to: '/archives', icon: Archive },
  { name: 'Files', to: '/files', icon: FolderOpen },
  { name: 'Settings', to: '/settings', icon: Settings },
]

const filteredNav = computed(() => {
  return nav.filter(item => {
    if (item.name === 'Files' && auth.user?.email !== 'martinitokristan@gmail.com') return false;
    if (item.name === 'API Usage' && auth.user?.email !== 'martinitokristan@gmail.com') return false;
    if (item.name === 'AI Logs' && auth.user?.email !== 'martinitokristan@gmail.com') return false;
    return true;
  })
})

// Main tabs for the bottom dock (2 on each side of the center button)
const mainBottomNav = [
  { name: 'Home',     to: '/',         icon: Home },
  { name: 'Plan',     to: '/plans',    icon: Calendar },
  { name: 'Expenses', to: '/expenses', icon: Receipt },
]

// Secondary items for the "More" menu
const moreNav = [
  { name: 'Wallets',  to: '/wallets',  icon: Wallet },
  { name: 'Debts',    to: '/debts',    icon: HandCoins },
  { name: 'Archives', to: '/archives', icon: Archive },
  { name: 'Notes',    to: '/notes',    icon: NotebookPen },
  { name: 'Files',    to: '/files',    icon: FolderOpen },
  { name: 'API Usage',to: '/admin/api-usage', icon: Activity },
  { name: 'AI Logs',  to: '/admin/ai-logs', icon: BrainCircuit },
]

const filteredMoreNav = computed(() => {
  return moreNav.filter(item => {
    if (item.name === 'Files' && auth.user?.email !== 'martinitokristan@gmail.com') return false;
    if (item.name === 'API Usage' && auth.user?.email !== 'martinitokristan@gmail.com') return false;
    if (item.name === 'AI Logs' && auth.user?.email !== 'martinitokristan@gmail.com') return false;
    return true;
  })
})

const isAdminMoreNav = computed(() => auth.user?.email === 'martinitokristan@gmail.com')

const initials = computed(() => {
  const name = auth.user?.name ?? ''
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
})

const isGuidePage = computed(() => route.path === '/guide' || route.path === '/faq')
const isSubSettings = computed(() => {
  return route.path === '/settings' && route.query.tab && route.query.tab !== 'main'
})
const hideNavigationAndAi = computed(() => {
  return isGuidePage.value || isSubSettings.value
    || route.path === '/admin/api-usage'
    || route.path === '/admin/ai-logs'
})

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <div ref="appRootRef" class="flex h-screen overflow-hidden bg-background font-sans">

    <!-- Desktop Sidebar -->
    <aside v-if="!hideNavigationAndAi" class="hidden xl:flex w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar shadow-sm">
      <div class="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-6">
        <div class="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
          <span class="text-white font-black text-xl leading-none">E</span>
        </div>
        <span class="font-black text-xl tracking-tight hidden md:block text-foreground">EleFam</span>
      </div>

      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        <RouterLink
          v-for="item in filteredNav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200"
          :class="
            isActive(item.to)
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          "
        >
          <component :is="item.icon" class="h-4 w-4 shrink-0" />
          {{ item.name }}
          <span 
            v-if="item.name === 'Settings' && needRefresh" 
            class="ml-auto h-2 w-2 rounded-full bg-destructive animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"
          ></span>
        </RouterLink>
      </nav>

      <div class="shrink-0 border-t border-sidebar-border p-4 bg-muted/20">
        <div class="flex items-center gap-3 px-2 py-3 mb-2 rounded-xl bg-card border border-border/50 shadow-sm">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold border border-primary/20">
            {{ initials }}
          </div>
          <div class="min-w-0">
            <p class="truncate text-xs font-black text-foreground">{{ auth.user?.name }}</p>
            <p class="truncate text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{{ auth.user?.email }}</p>
          </div>
        </div>
        <button
          @click="auth.logout()"
          class="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut class="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>

    <!-- Content area -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden relative">
      <!-- Offline / Syncing banner -->
      <OfflineBanner />

      <!-- Page content -->
      <main 
        class="flex-1 overflow-y-auto bg-background dark:bg-zinc-950"
        :class="[
          hideNavigationAndAi ? 'pb-6' : 'pb-32 xl:pb-0',
          {
            'hide-balances-active': auth.user?.hide_balances,
            'hide-stats-active': auth.user?.hide_stats
          }
        ]"
      >
        <RouterView v-slot="{ Component }">
          <KeepAlive :max="5">
            <component :is="Component" :key="$route.name" />
          </KeepAlive>
        </RouterView>
      </main>

      <!-- Mobile Bottom Navigation -->
      <nav v-if="!hideNavigationAndAi" class="fixed bottom-0 inset-x-0 z-[60] xl:hidden pb-safe flex justify-center px-4 mb-6">
        <!-- Backdrop to close Menus -->
        <div 
          v-if="showMoreMenu || showSpeedDial" 
          class="fixed inset-0 z-40 bg-black/5 backdrop-blur-[2px]" 
          @click="showMoreMenu = false; showSpeedDial = false"
        ></div>

        <!-- More Menu Overlay -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-10 scale-95"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 translate-y-10 scale-95"
        >
          <div v-if="showMoreMenu" class="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 w-full max-w-[420px] z-50 px-2">
            <div
              class="relative h-20 bg-card/80 backdrop-blur-2xl border border-border/40 rounded-[50px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] flex items-center transition-all duration-500"
              :class="isAdminMoreNav ? 'overflow-hidden px-1' : 'px-2 overflow-visible'"
            >
              <div
                class="flex items-center h-full"
                :class="isAdminMoreNav ? 'w-full overflow-x-auto hide-scrollbar gap-1 px-1 snap-x snap-mandatory' : 'flex-1 justify-around'"
              >
                <RouterLink
                  v-for="item in filteredMoreNav"
                  :key="item.to"
                  :to="item.to"
                  @click="showMoreMenu = false"
                  class="relative flex flex-col items-center justify-center w-[72px] h-[64px] rounded-[50px] transition-all group active:scale-90 shrink-0"
                  :class="[
                    isActive(item.to) ? 'text-primary bg-zinc-200/80 dark:bg-zinc-800' : 'text-foreground/70 dark:text-zinc-400 hover:text-foreground',
                    isAdminMoreNav ? 'snap-center' : ''
                  ]"
                >
                  <component :is="item.icon" class="h-6 w-6 transition-transform duration-300 group-active:scale-90" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]': isActive(item.to) }" />
                  <span class="text-[10px] font-sans font-bold mt-1.5 uppercase tracking-wide text-center leading-tight px-0.5">{{ item.name }}</span>
                  <span 
                    v-if="item.name === 'Settings' && needRefresh" 
                    class="absolute top-2 right-0 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-card animate-pulse"
                  ></span>
                </RouterLink>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Speed Dial Bottom Sheet -->
        <Transition
          enter-active-class="transition duration-300 cubic-bezier(0.2, 0.8, 0.2, 1)"
          enter-from-class="opacity-0 translate-y-[120%]"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-250 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-[120%]"
        >
          <div v-if="showSpeedDial" class="fixed bottom-0 inset-x-0 z-50 flex justify-center">
            <div class="w-full max-w-[480px] rounded-t-[2rem] bg-card/95 backdrop-blur-3xl border-t border-border/50 shadow-[0_-20px_60px_rgba(0,0,0,0.3)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6 px-6 max-h-[80vh] overflow-y-auto origin-bottom">
              <div class="flex justify-between items-center mb-6">
                 <h3 class="font-black text-xl tracking-tight text-foreground">Create New</h3>
                 <button @click="showSpeedDial = false" class="p-2 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground transition-colors active:scale-90">
                   <X class="h-5 w-5 stroke-[2.5px]" />
                 </button>
              </div>
              
              <div class="grid grid-cols-3 gap-x-4 gap-y-6 mb-2">
                <button
                  v-for="action in speedDialActions"
                  :key="action.name"
                  @click="action.action(); showSpeedDial = false"
                  class="flex flex-col items-center gap-3 transition-all active:scale-90 group"
                >
                  <div class="h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110" :class="[action.color, action.bg]">
                    <component :is="action.icon" class="h-6 w-6 stroke-[2.5px]" />
                  </div>
                  <span class="text-xs font-bold text-foreground/80 text-center uppercase tracking-wider">{{ action.name }}</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- The Dock Container -->
        <div class="relative w-full max-w-[420px] mx-auto h-16 bg-card/80 backdrop-blur-2xl border border-border/40 rounded-[40px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] flex items-center px-1.5 overflow-visible transition-all duration-500">
          
          <!-- Left Side Tabs -->
          <div class="flex flex-1 justify-around items-center h-full min-w-0 gap-1">
            <RouterLink
              v-for="item in mainBottomNav.slice(0, 2)"
              :key="item.to"
              :to="item.to"
              @click="showMoreMenu = false; showSpeedDial = false"
              class="relative flex flex-col items-center justify-center flex-1 h-[52px] rounded-[32px] transition-all group"
              :class="isActive(item.to) ? 'text-primary bg-zinc-200/80 dark:bg-zinc-800' : 'text-foreground/70 dark:text-zinc-400 hover:text-foreground'"
            >
              <component :is="item.icon" class="h-5 w-5 transition-transform duration-300 group-active:scale-90" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]': isActive(item.to) }" />
              <span class="text-[9px] sm:text-[10px] font-sans font-bold mt-0.5 uppercase tracking-wider truncate px-1 w-full text-center">{{ item.name }}</span>
            </RouterLink>
          </div>

          <!-- Centered FAB -->
          <div class="relative w-16 flex justify-center -mt-8">
            <div class="absolute inset-0 bg-background rounded-full scale-125 blur-xl opacity-50 -z-10"></div>
            <button
              @click="showSpeedDial = !showSpeedDial; showMoreMenu = false"
              class="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(var(--primary-rgb),0.5)] flex items-center justify-center active:scale-90 transition-all duration-300 hover:scale-105 group border-4 border-background"
              :class="{ 'rotate-45': showSpeedDial }"
            >
              <Plus class="h-7 w-7 stroke-[3px] transition-transform" />
            </button>
          </div>

          <!-- Right Side Tabs -->
          <div class="flex flex-1 justify-around items-center h-full min-w-0 gap-1">
            <RouterLink
              :to="mainBottomNav[2].to"
              @click="showMoreMenu = false; showSpeedDial = false"
              class="relative flex flex-col items-center justify-center flex-1 h-[52px] rounded-[32px] transition-all group"
              :class="isActive(mainBottomNav[2].to) ? 'text-primary bg-zinc-200/80 dark:bg-zinc-800' : 'text-foreground/70 dark:text-zinc-400 hover:text-foreground'"
            >
              <component :is="mainBottomNav[2].icon" class="h-5 w-5 transition-transform duration-300 group-active:scale-90" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]': isActive(mainBottomNav[2].to) }" />
              <span class="text-[9px] sm:text-[10px] font-sans font-bold mt-0.5 uppercase tracking-wider truncate px-1 w-full text-center">{{ mainBottomNav[2].name }}</span>
            </RouterLink>

            <!-- More Trigger -->
            <button
              @click="showMoreMenu = !showMoreMenu; showSpeedDial = false"
              class="relative flex flex-col items-center justify-center flex-1 h-[52px] rounded-[32px] transition-all group"
              :class="showMoreMenu ? 'text-primary bg-zinc-200/80 dark:bg-zinc-800' : 'text-foreground/70 dark:text-zinc-400 hover:text-foreground'"
            >
              <div class="flex flex-col gap-[1.5px] items-center justify-center h-5 w-5 transition-transform duration-300 group-active:scale-90 relative">
                <div class="w-1 h-1 rounded-full bg-current transition-all" :class="{ 'scale-125': showMoreMenu }" />
                <div class="w-1 h-1 rounded-full bg-current transition-all" :class="{ 'scale-125': showMoreMenu }" />
                <div class="w-1 h-1 rounded-full bg-current transition-all" :class="{ 'scale-125': showMoreMenu }" />
                <span 
                  v-if="needRefresh" 
                  class="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive border-[1.5px] border-background animate-pulse"
                ></span>
              </div>
              <span class="text-[9px] sm:text-[10px] font-sans font-bold mt-0.5 uppercase tracking-wider truncate px-1 w-full text-center">More</span>
            </button>
          </div>


        </div>
      </nav>

      <AiChat v-if="!hideNavigationAndAi" />

      <!-- Premium PWA Update Overlay -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div 
          v-if="isUpdating" 
          class="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl text-foreground"
        >
          <div class="flex flex-col items-center max-w-xs text-center px-6 py-8 rounded-3xl bg-card border border-border/40 shadow-2xl relative overflow-hidden">
            <!-- Pulsing/Glowing Logo or Mascot -->
            <div class="relative h-20 w-20 mb-6 flex items-center justify-center">
              <!-- Glow Rings -->
              <div class="absolute inset-0 rounded-full bg-primary/20 animate-ping duration-1000"></div>
              <div class="absolute inset-2 rounded-full bg-primary/10 animate-pulse"></div>
              <!-- Elephant / Logo Icon -->
              <div class="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8 animate-bounce">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </div>
            </div>
            
            <h3 class="text-lg font-bold tracking-tight mb-2">Updating EleFam</h3>
            <p class="text-xs text-muted-foreground leading-relaxed mb-6">
              Installing the latest version on your device. This will only take a moment.
            </p>
            
            <!-- Sleek Progress Bar -->
            <div class="w-full h-1.5 bg-muted rounded-full overflow-hidden relative">
              <div class="absolute inset-y-0 w-full bg-primary rounded-full origin-left animate-progress-slide"></div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Global Modals -->
      <WalletModal 
        :show="modals.isWalletModalOpen" 
        :walletId="modals.walletId" 
        @close="modals.closeWalletModal()" 
      />
      <ExpenseModal 
        :show="modals.isExpenseModalOpen" 
        :expenseId="modals.expenseId" 
        :preselectedWalletId="modals.expensePreselectedWalletId"
        @close="modals.closeExpenseModal()" 
      />
      <DebtModal 
        :show="modals.isDebtModalOpen" 
        :debtId="modals.debtId" 
        @close="modals.closeDebtModal()" 
      />
      <NoteModal 
        :show="modals.isNoteModalOpen" 
        :noteId="modals.noteId" 
        :defaultFolderId="modals.noteFolderId"
        @close="modals.closeNoteModal()" 
      />
      <FileModal 
        :show="modals.isFileModalOpen" 
        :defaultAlbum="modals.fileDefaultAlbum"
        @close="modals.closeFileModal()" 
      />
      <DepositSalaryModal
        :show="modals.isDepositModalOpen"
        :walletId="modals.depositWalletId"
        :isAddMore="modals.depositIsAddMore"
        @close="modals.closeDepositModal()"
        @success="() => { dashboard.fetchStats({}, true); salary.fetchCurrentMonth(); }"
      />
      <TransferModal 
        :show="modals.isTransferModalOpen" 
        @close="modals.closeTransferModal()" 
      />
    </div>
  </div>
</template>

<style scoped>
.nav-pill::-webkit-scrollbar { display: none; }
.nav-pill { -ms-overflow-style: none; scrollbar-width: none; }

@keyframes progress-slide {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(-30%) scaleX(0.4); }
  100% { transform: translateX(100%); }
}
.animate-progress-slide {
  animation: progress-slide 1.8s infinite ease-in-out;
}
</style>
