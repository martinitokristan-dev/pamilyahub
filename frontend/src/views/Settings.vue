<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { usePwaStore } from '@/stores/pwa.js'
import { useDarkMode } from '@/composables/useDarkMode.js'
import { Moon, Sun, User, LogOut, ChevronRight, Bell, Shield, Palette, Banknote, DownloadCloud, Loader2 } from 'lucide-vue-next'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import UiButton from '@/components/ui/Button.vue'
import { parseCurrency } from '@/utils/format'
import { useToast } from '@/composables/useToast.js'

const auth = useAuthStore()
const pwaStore = usePwaStore()
const route = useRoute()
const { isDark, toggle } = useDarkMode()
const { toasts } = useToast()

onMounted(() => {
  // If user clicked the notification, scroll to update section
  if (route.query.update) {
    setTimeout(() => {
      const updateEl = document.getElementById('update-section')
      if (updateEl) {
        updateEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 300)
  }
})

function handleUpdateClick() {
  if (pwaStore.needRefresh) {
    pwaStore.triggerUpdate()
  } else {
    toasts.addSuccess('App is up to date', 'You are already running the latest version of EleFam.')
  }
}

const initials = computed(() => {
  const name = auth.user?.name ?? ''
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
})

const salaryInput = ref(auth.user?.monthly_salary ?? 0)
const savingSalary = ref(false)

async function saveSalary() {
  savingSalary.value = true
  try {
    // Since input is type="number", salaryInput.value is already a number
    // No need for parseCurrency - just ensure it's a valid number
    const salaryValue = parseFloat(salaryInput.value) || 0
    await auth.updateProfile({ monthly_salary: salaryValue })
    // Update the input to reflect the saved value
    salaryInput.value = auth.user?.monthly_salary ?? 0
  } catch (e) {
    console.error('Failed to save salary:', e)
  } finally {
    savingSalary.value = false
  }
}

async function handleSignOut() {
  await auth.logout()
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto animate-fade-in">
    <div class="mb-8">
      <h1 class="text-[32px] sm:text-[40px] font-black tracking-tight text-foreground leading-none">Settings</h1>
    </div>

    <!-- Profile card -->
    <UiCard class="mb-4 overflow-hidden">
      <UiCardContent class="p-0">
        <div class="flex items-center gap-4 p-5 bg-gradient-to-br from-primary/10 to-primary/5">
          <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-xl font-bold text-primary-foreground shadow-lg">
            {{ initials }}
          </div>
          <div class="min-w-0">
            <p class="text-base font-bold text-foreground">{{ auth.user?.name }}</p>
            <p class="text-sm text-muted-foreground truncate">{{ auth.user?.email }}</p>
            <div class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5">
              <div class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span class="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Active</span>
            </div>
          </div>
        </div>
      </UiCardContent>
    </UiCard>
    
    <!-- App Update -->
    <div v-if="pwaStore.needRefresh || pwaStore.isUpdating" id="update-section" class="mb-6 animate-fade-in">
      <p class="text-xs font-semibold text-primary uppercase tracking-wider px-1 mb-2 flex items-center gap-1.5">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
        System Update
      </p>
      <UiCard class="overflow-hidden border-primary/20 shadow-primary/5 bg-gradient-to-br from-primary/5 to-transparent relative">
        <!-- Progress bar animation overlay when updating -->
        <div v-if="pwaStore.isUpdating" class="absolute inset-0 bg-primary/5">
          <div class="h-full bg-primary/10 animate-pulse w-full transition-all duration-1000 ease-in-out"></div>
        </div>
        
        <UiCardContent class="p-5 relative z-10">
          <div class="flex items-start gap-4">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" :class="pwaStore.isUpdating ? 'bg-primary/20 animate-pulse' : 'bg-primary/10'">
              <Loader2 v-if="pwaStore.isUpdating" class="h-6 w-6 text-primary animate-spin" />
              <DownloadCloud v-else class="h-6 w-6 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-bold text-foreground">
                {{ pwaStore.isUpdating ? 'Installing Update...' : 'New Version Available' }}
              </h3>
              <p class="text-sm text-muted-foreground mt-0.5 leading-snug">
                {{ pwaStore.isUpdating 
                  ? 'Please wait while we apply the latest features and fixes. The app will restart automatically.' 
                  : 'A new version of EleFam is ready. Update now to get the latest features and performance improvements.' }}
              </p>
              
              <div class="mt-4 flex items-center gap-3">
                <UiButton 
                  v-if="!pwaStore.isUpdating" 
                  @click="pwaStore.triggerUpdate()" 
                  class="h-10 px-6 rounded-xl font-bold w-full sm:w-auto shadow-md"
                >
                  Update Now
                </UiButton>
                <div v-else class="flex items-center gap-2 text-sm font-semibold text-primary">
                  <span class="animate-bounce">Downloading resources</span>
                  <span class="flex gap-0.5">
                    <span class="animate-bounce" style="animation-delay: 0ms">.</span>
                    <span class="animate-bounce" style="animation-delay: 150ms">.</span>
                    <span class="animate-bounce" style="animation-delay: 300ms">.</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Financial -->
    <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Financial</p>
    <UiCard class="mb-4 overflow-hidden border-emerald-500/20 shadow-emerald-500/5">
      <UiCardContent class="p-0 divide-y divide-border">
        <div class="px-5 py-4">
          <div class="flex items-center gap-3 mb-4">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Banknote class="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p class="text-sm font-medium">Monthly Salary</p>
              <p class="text-xs text-muted-foreground">Used for tracking spending power</p>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₱</span>
              <input 
                v-model="salaryInput" 
                type="number" 
                class="w-full bg-muted/50 border border-border rounded-xl py-2 pl-7 pr-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="0.00"
              />
            </div>
            <UiButton size="sm" variant="default" @click="saveSalary" :disabled="savingSalary" class="h-9 px-4 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              {{ savingSalary ? 'Saving...' : 'Save' }}
            </UiButton>
          </div>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Appearance -->
    <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Appearance</p>
    <UiCard class="mb-4 overflow-hidden">
      <UiCardContent class="p-0 divide-y divide-border">
        <div class="flex items-center justify-between px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl" :class="isDark ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-amber-100'">
              <component :is="isDark ? Moon : Sun" class="h-4 w-4" :class="isDark ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600'" />
            </div>
            <div>
              <p class="text-sm font-medium">Dark Mode</p>
              <p class="text-xs text-muted-foreground">{{ isDark ? 'Dark theme active' : 'Light theme active' }}</p>
            </div>
          </div>
          <!-- Toggle switch -->
          <button
            @click="toggle"
            class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none"
            :class="isDark ? 'bg-primary' : 'bg-muted'"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200"
              :class="isDark ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Account -->
    <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Account</p>
    <UiCard class="mb-4 overflow-hidden">
      <UiCardContent class="p-0 divide-y divide-border">
        <div class="flex items-center justify-between px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <User class="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p class="text-sm font-medium">Profile</p>
              <p class="text-xs text-muted-foreground">{{ auth.user?.name }}</p>
            </div>
          </div>
          <ChevronRight class="h-4 w-4 text-muted-foreground" />
        </div>

        <div class="flex items-center justify-between px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Shield class="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p class="text-sm font-medium">Privacy & Security</p>
              <p class="text-xs text-muted-foreground">Manage your data</p>
            </div>
          </div>
          <ChevronRight class="h-4 w-4 text-muted-foreground" />
        </div>

        <div class="flex items-center justify-between px-5 py-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Bell class="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p class="text-sm font-medium">Notifications</p>
              <p class="text-xs text-muted-foreground">Alerts and reminders</p>
            </div>
          </div>
          <ChevronRight class="h-4 w-4 text-muted-foreground" />
        </div>

        <div @click="handleUpdateClick" class="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-muted/50 transition-colors">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/30 relative">
              <DownloadCloud class="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <!-- Notification Dot -->
              <span v-if="pwaStore.needRefresh" class="absolute -top-1 -right-1 flex h-3 w-3">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-primary border-2 border-background"></span>
              </span>
            </div>
            <div>
              <p class="text-sm font-medium">System Update</p>
              <p class="text-xs text-primary font-semibold" v-if="pwaStore.needRefresh">New update available!</p>
              <p class="text-xs text-muted-foreground" v-else>Check for updates</p>
            </div>
          </div>
          <Loader2 v-if="pwaStore.isUpdating" class="h-4 w-4 text-primary animate-spin" />
          <ChevronRight v-else class="h-4 w-4 text-muted-foreground" />
        </div>
      </UiCardContent>
    </UiCard>

    <!-- Sign out -->
    <UiCard class="overflow-hidden">
      <UiCardContent class="p-0">
        <button
          @click="handleSignOut"
          class="flex w-full items-center gap-3 px-5 py-4 text-destructive hover:bg-destructive/5 transition-colors"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
            <LogOut class="h-4 w-4 text-destructive" />
          </div>
          <span class="text-sm font-medium">Sign out</span>
        </button>
      </UiCardContent>
    </UiCard>

    <p class="text-center text-xs text-muted-foreground mt-6">EleFam v1.1.0</p>
  </div>
</template>
