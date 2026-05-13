<script setup>
import { onMounted, computed } from 'vue'
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

const auth = useAuthStore()
const notes = useNotesStore()
const expenses = useExpensesStore()
const debts = useDebtsStore()
const files = useFilesStore()
const wallets = useWalletsStore()
const route = useRoute()
const { isDark } = useDarkMode()
const { toasts } = useToast()

onMounted(async () => {
  if (!auth.user) await auth.fetchMe()
  
  // Load only critical stores on app init
  // Debts, files, and expenses are loaded when needed by their respective pages
  await Promise.all([
    wallets.fetchAll(),
  ])
})

const nav = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard },
  { name: 'Notes', to: '/notes', icon: NotebookPen },
  { name: 'Expenses', to: '/expenses', icon: Receipt },
  { name: 'Wallets', to: '/wallets', icon: Wallet },
  { name: 'Debts', to: '/debts', icon: HandCoins },
  { name: 'Files', to: '/files', icon: FolderOpen },
  { name: 'Settings', to: '/settings', icon: Settings },
]

// Bottom nav — all pages, scrollable on mobile
const bottomNav = [
  { name: 'Home',     to: '/',         icon: LayoutDashboard },
  { name: 'Notes',    to: '/notes',    icon: NotebookPen },
  { name: 'Expenses', to: '/expenses', icon: Receipt },
  { name: 'Wallets',  to: '/wallets',  icon: Wallet },
  { name: 'Debts',    to: '/debts',    icon: HandCoins },
  { name: 'Files',    to: '/files',    icon: FolderOpen },
  { name: 'Settings', to: '/settings', icon: Settings },
]

const initials = computed(() => {
  const name = auth.user?.name ?? ''
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
})

function isActive(path) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">

    <!-- Desktop Sidebar -->
    <aside class="hidden lg:flex w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div class="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <Home class="h-4 w-4 text-primary-foreground" />
        </div>
        <span class="text-sm font-semibold tracking-tight text-foreground">Pamilya Hub</span>
      </div>

      <nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="
            isActive(item.to)
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-accent hover:text-accent-foreground'
          "
        >
          <component :is="item.icon" class="h-4 w-4 shrink-0" />
          {{ item.name }}
        </RouterLink>
      </nav>

      <div class="shrink-0 border-t border-sidebar-border p-3">
        <div class="flex items-center gap-2.5 rounded-md px-2 py-2 mb-1">
          <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {{ initials }}
          </div>
          <div class="min-w-0">
            <p class="truncate text-xs font-semibold text-foreground leading-none">{{ auth.user?.name }}</p>
            <p class="truncate text-[11px] text-muted-foreground mt-0.5">{{ auth.user?.email }}</p>
          </div>
        </div>
        <button
          @click="auth.logout()"
          class="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut class="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>

    <!-- Content area -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden relative">
      <!-- Page content — extra bottom padding on mobile for bottom nav -->
      <main class="flex-1 overflow-y-auto pb-24 lg:pb-0">
        <RouterView />
      </main>

      <!-- Mobile Bottom Navigation -->
      <nav class="fixed bottom-0 inset-x-0 z-50 lg:hidden">

        <!-- + FAB floats above the nav on the right -->
        <Transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 scale-75"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-150"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-75"
        >
          <button
            v-if="pageAddAction"
            @click="pageAddAction()"
            class="absolute bottom-full right-4 mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[15px] bg-primary text-primary-foreground shadow-xl active:scale-95 transition-transform z-10"
            aria-label="Add new"
          >
            <Plus class="h-6 w-6" />
          </button>
        </Transition>

        <!-- Nav pill — full width, all items equal, no scrolling -->
        <div class="mx-3 mb-6 rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-xl">
          <div class="flex items-center justify-around px-1 py-1">
            <RouterLink
              v-for="item in bottomNav"
              :key="item.to"
              :to="item.to"
              class="flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 transition-all duration-200 max-w-[56px]"
              :class="isActive(item.to) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
            >
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200"
                :class="isActive(item.to) ? 'bg-primary/10' : ''"
              >
                <component :is="item.icon" class="h-[20px] w-[20px]" />
              </div>
              <span class="text-[10px] font-medium leading-none">{{ item.name }}</span>
            </RouterLink>
          </div>
        </div>
      </nav>

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
                : 'bg-destructive/90 text-white'
            "
          >
            <span>{{ toast.message }}</span>
          </div>
        </TransitionGroup>
      </div>

    </div>
  </div>
</template>

<style scoped>
.nav-pill::-webkit-scrollbar { display: none; }
.nav-pill { -ms-overflow-style: none; scrollbar-width: none; }
</style>
