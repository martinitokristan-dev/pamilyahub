<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { useNotesStore } from '@/stores/notes.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useDebtsStore } from '@/stores/debts.js'
import { useFilesStore } from '@/stores/files.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDarkMode } from '@/composables/useDarkMode.js'
import { pageAddAction } from '@/composables/usePageAction.js'
import { useToast } from '@/composables/useToast.js'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useSalaryStore } from '@/stores/salary.js'

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
  Wallet,
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
const route = useRoute()
const { isDark } = useDarkMode()
const { toasts } = useToast()

watch(() => route.fullPath, async () => {
  await nextTick()
  const main = document.querySelector('main')
  if (main) {
    main.scrollTop = 0
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
const nav = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard },
  { name: 'Notes', to: '/notes', icon: NotebookPen },
  { name: 'Expenses', to: '/expenses', icon: Receipt },
  { name: 'Wallets', to: '/wallets', icon: Wallet },
  { name: 'Debts', to: '/debts', icon: HandCoins },
  { name: 'Files', to: '/files', icon: FolderOpen },
  { name: 'Settings', to: '/settings', icon: Settings },
]

// Main tabs for the bottom dock (2 on each side of the center button)
const mainBottomNav = [
  { name: 'Home',     to: '/',         icon: LayoutDashboard },
  { name: 'Expenses', to: '/expenses', icon: Receipt },
  { name: 'Debts',    to: '/debts',    icon: HandCoins },
]

// Secondary items for the "More" menu
const moreNav = [
  { name: 'Wallets',  to: '/wallets',  icon: Wallet },
  { name: 'Notes',    to: '/notes',    icon: NotebookPen },
  { name: 'Files',    to: '/files',    icon: FolderOpen },
  { name: 'Settings', to: '/settings', icon: Settings },
]

const initials = computed(() => {
  const name = auth.user?.name ?? ''
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
})

const isGuidePage = computed(() => route.path === '/guide')

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background font-sans">

    <!-- Desktop Sidebar -->
    <aside v-if="!isGuidePage" class="hidden lg:flex w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar shadow-sm">
      <div class="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-6">
        <div class="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
          <span class="text-white font-black text-xl leading-none">E</span>
        </div>
        <span class="font-black text-xl tracking-tight hidden md:block text-foreground">EleFam</span>
      </div>

      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        <RouterLink
          v-for="item in nav"
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
        class="flex-1 overflow-y-auto bg-[#e9eff6] dark:bg-zinc-950"
        :class="isGuidePage ? 'pb-6' : 'pb-32 lg:pb-0'"
      >
        <RouterView v-slot="{ Component }">
          <KeepAlive :max="5">
            <component :is="Component" :key="$route.name" />
          </KeepAlive>
        </RouterView>
      </main>

      <!-- Mobile Bottom Navigation -->
      <nav v-if="!isGuidePage" class="fixed bottom-0 inset-x-0 z-[60] lg:hidden pb-safe px-4 mb-6">
        <!-- Backdrop to close More Menu -->
        <div 
          v-if="showMoreMenu" 
          class="fixed inset-0 z-40 bg-black/5 backdrop-blur-[2px]" 
          @click="showMoreMenu = false"
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
          <div v-if="showMoreMenu" class="absolute bottom-[calc(100%+16px)] inset-x-0 z-50">
            <div class="bg-card/95 backdrop-blur-2xl border border-border/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-5 overflow-hidden mx-1">
              <div class="grid grid-cols-3 gap-4">
                <RouterLink
                  v-for="item in moreNav"
                  :key="item.to"
                  :to="item.to"
                  @click="showMoreMenu = false"
                  class="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all active:scale-90"
                  :class="isActive(item.to) ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'"
                >
                  <div class="h-12 w-12 flex items-center justify-center rounded-2xl bg-muted/50 shadow-sm border border-border/30 relative">
                    <component :is="item.icon" class="h-6 w-6" />
                    <span 
                      v-if="item.name === 'Settings' && needRefresh" 
                      class="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive border-2 border-card animate-pulse"
                    ></span>
                  </div>
                  <span class="text-[10px] font-black tracking-wider uppercase">{{ item.name }}</span>
                </RouterLink>
              </div>
            </div>
          </div>
        </Transition>

        <!-- The Dock Container -->
        <div class="relative h-20 bg-card/80 backdrop-blur-2xl border border-border/40 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] flex items-center px-2 overflow-visible transition-all duration-500">
          
          <!-- Case 1: With FAB (2-FAB-2 Layout) -->
          <template v-if="pageAddAction">
            <!-- Left Side Tabs -->
            <div class="flex flex-1 justify-around items-center h-full">
              <RouterLink
                v-for="item in mainBottomNav.slice(0, 2)"
                :key="item.to"
                :to="item.to"
                @click="showMoreMenu = false"
                class="relative flex flex-col items-center justify-center w-14 h-full transition-all group"
                :class="isActive(item.to) ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'"
              >
                <component :is="item.icon" class="h-6 w-6 transition-transform duration-300 group-active:scale-90" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]': isActive(item.to) }" />
                <span class="text-[9px] font-black mt-1 uppercase tracking-tighter">{{ item.name }}</span>
              </RouterLink>
            </div>

            <!-- Centered FAB -->
            <div class="relative w-20 flex justify-center -mt-10">
              <div class="absolute inset-0 bg-background rounded-full scale-125 blur-xl opacity-50 -z-10"></div>
              <button
                @click="pageAddAction(); showMoreMenu = false"
                class="h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-[0_8px_25px_rgba(var(--primary-rgb),0.5)] flex items-center justify-center active:scale-90 transition-all duration-300 hover:rotate-90 group border-4 border-background"
              >
                <Plus class="h-8 w-8 stroke-[3px] transition-transform group-hover:scale-110" />
              </button>
            </div>

            <!-- Right Side Tabs -->
            <div class="flex flex-1 justify-around items-center h-full">
              <RouterLink
                :to="mainBottomNav[2].to"
                @click="showMoreMenu = false"
                class="relative flex flex-col items-center justify-center w-14 h-full transition-all group"
                :class="isActive(mainBottomNav[2].to) ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'"
              >
                <component :is="mainBottomNav[2].icon" class="h-6 w-6 transition-transform duration-300 group-active:scale-90" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]': isActive(mainBottomNav[2].to) }" />
                <span class="text-[9px] font-black mt-1 uppercase tracking-tighter">{{ mainBottomNav[2].name }}</span>
              </RouterLink>

              <!-- More Trigger -->
              <button
                @click="showMoreMenu = !showMoreMenu"
                class="relative flex flex-col items-center justify-center w-14 h-full transition-all group"
                :class="showMoreMenu ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'"
              >
                <div class="flex flex-col gap-0.5 items-center justify-center h-6 w-6 transition-transform duration-300 group-active:scale-90 relative">
                  <div class="w-1.5 h-1.5 rounded-full bg-current transition-all" :class="{ 'scale-125': showMoreMenu }" />
                  <div class="w-1.5 h-1.5 rounded-full bg-current transition-all" :class="{ 'scale-125': showMoreMenu }" />
                  <div class="w-1.5 h-1.5 rounded-full bg-current transition-all" :class="{ 'scale-125': showMoreMenu }" />
                  <span 
                    v-if="needRefresh" 
                    class="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-background animate-pulse"
                  ></span>
                </div>
                <span class="text-[9px] font-black mt-1 uppercase tracking-tighter">More</span>
              </button>
            </div>
          </template>

          <!-- Case 2: Without FAB (Balanced 4-item Layout) -->
          <template v-else>
            <div class="flex w-full justify-around items-center h-full">
              <!-- Home -->
              <RouterLink
                :to="mainBottomNav[0].to"
                @click="showMoreMenu = false"
                class="relative flex flex-col items-center justify-center flex-1 h-full transition-all group"
                :class="isActive(mainBottomNav[0].to) ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'"
              >
                <component :is="mainBottomNav[0].icon" class="h-6 w-6 transition-transform duration-300 group-active:scale-90" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]': isActive(mainBottomNav[0].to) }" />
                <span class="text-[9px] font-black mt-1 uppercase tracking-tighter">{{ mainBottomNav[0].name }}</span>
              </RouterLink>

              <!-- Expenses -->
              <RouterLink
                :to="mainBottomNav[1].to"
                @click="showMoreMenu = false"
                class="relative flex flex-col items-center justify-center flex-1 h-full transition-all group"
                :class="isActive(mainBottomNav[1].to) ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'"
              >
                <component :is="mainBottomNav[1].icon" class="h-6 w-6 transition-transform duration-300 group-active:scale-90" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]': isActive(mainBottomNav[1].to) }" />
                <span class="text-[9px] font-black mt-1 uppercase tracking-tighter">{{ mainBottomNav[1].name }}</span>
              </RouterLink>

              <!-- Debts -->
              <RouterLink
                :to="mainBottomNav[2].to"
                @click="showMoreMenu = false"
                class="relative flex flex-col items-center justify-center flex-1 h-full transition-all group"
                :class="isActive(mainBottomNav[2].to) ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'"
              >
                <component :is="mainBottomNav[2].icon" class="h-6 w-6 transition-transform duration-300 group-active:scale-90" :class="{ 'scale-110 drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]': isActive(mainBottomNav[2].to) }" />
                <span class="text-[9px] font-black mt-1 uppercase tracking-tighter">{{ mainBottomNav[2].name }}</span>
              </RouterLink>

              <!-- More -->
              <button
                @click="showMoreMenu = !showMoreMenu"
                class="relative flex flex-col items-center justify-center flex-1 h-full transition-all group"
                :class="showMoreMenu ? 'text-primary' : 'text-muted-foreground/60 hover:text-foreground'"
              >
                <div class="flex flex-col gap-0.5 items-center justify-center h-6 w-6 transition-transform duration-300 group-active:scale-90 relative">
                  <div class="w-1.5 h-1.5 rounded-full bg-current transition-all" :class="{ 'scale-125': showMoreMenu }" />
                  <div class="w-1.5 h-1.5 rounded-full bg-current transition-all" :class="{ 'scale-125': showMoreMenu }" />
                  <div class="w-1.5 h-1.5 rounded-full bg-current transition-all" :class="{ 'scale-125': showMoreMenu }" />
                  <span 
                    v-if="needRefresh" 
                    class="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-background animate-pulse"
                  ></span>
                </div>
                <span class="text-[9px] font-black mt-1 uppercase tracking-tighter">More</span>
              </button>
            </div>
          </template>

        </div>
      </nav>

      <AiChat v-if="!isGuidePage" />

      <!-- Global Toasts -->
      <div class="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
        <TransitionGroup
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 -translate-y-4 scale-95"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 -translate-y-4 scale-95"
        >
          <div
            v-for="toast in toasts"
            :key="toast.id"
            class="pointer-events-auto rounded-lg shadow-lg px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium backdrop-blur-md"
            :class="
              toast.type === 'success'
                ? 'bg-emerald-500/90 text-white dark:bg-emerald-600/90'
                : toast.type === 'info'
                ? 'bg-amber-500/90 text-white'
                : 'bg-destructive/90 text-white'
            "
          >
            <span>{{ toast.message }}</span>
          </div>
        </TransitionGroup>
      </div>

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
