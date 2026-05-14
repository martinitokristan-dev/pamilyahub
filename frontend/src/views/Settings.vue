<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useDarkMode } from '@/composables/useDarkMode.js'
import { Moon, Sun, User, LogOut, ChevronRight, Bell, Shield, Palette, Banknote } from 'lucide-vue-next'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import UiButton from '@/components/ui/Button.vue'
import { parseCurrency } from '@/utils/format'

const auth = useAuthStore()
const { isDark, toggle } = useDarkMode()

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
