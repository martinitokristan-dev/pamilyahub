<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { useDarkMode } from '@/composables/useDarkMode.js'
import { 
  Moon, Sun, User, LogOut, ChevronRight, ChevronLeft, Bell, Shield, 
  Banknote, BookOpen, Key, Laptop, Smartphone, Globe, RefreshCw, Trash2,
  Camera, Loader2
} from 'lucide-vue-next'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import UiButton from '@/components/ui/Button.vue'
import { useToast } from '@/composables/useToast.js'
import { Cropper, CircleStencil } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { isDark, toggle } = useDarkMode()
const toast = useToast()

const initials = computed(() => {
  const name = auth.user?.name ?? ''
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
})

const activeAvatar = computed(() => {
  return auth.user?.avatar || auth.user?.google_avatar || null
})

const fileInput = ref(null)
const uploadingAvatar = ref(false)
const deletingAvatar = ref(false)

// Cropper refs & state
const cropperRef = ref(null)
const showCropperModal = ref(false)
const cropperImageSrc = ref('')

function triggerFileSelect() {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

function handleFileChange(event) {
  const file = event.target.files[0]
  if (!file) return

  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg']
  if (!allowedTypes.includes(file.type)) {
    toast.error('Only JPG, JPEG, and PNG files are allowed.')
    return
  }

  if (file.size > 2 * 1024 * 1024) {
    toast.error('File size must not exceed 2MB.')
    return
  }

  cropperImageSrc.value = URL.createObjectURL(file)
  showCropperModal.value = true
}

function closeCropper() {
  showCropperModal.value = false
  if (cropperImageSrc.value) {
    URL.revokeObjectURL(cropperImageSrc.value)
    cropperImageSrc.value = ''
  }
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function cropAndUpload() {
  if (!cropperRef.value) return
  
  const { canvas } = cropperRef.value.getResult()
  if (!canvas) {
    toast.error('Failed to process image.')
    return
  }

  showCropperModal.value = false
  uploadingAvatar.value = true

  canvas.toBlob(async (blob) => {
    if (!blob) {
      toast.error('Failed to generate image blob.')
      uploadingAvatar.value = false
      return
    }

    try {
      const croppedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      await auth.uploadAvatar(croppedFile)
      toast.avatar('Avatar uploaded', 'Profile picture updated')
    } catch (e) {
      console.error(e)
      toast.error(e.response?.data?.message ?? 'Failed to upload profile picture.')
    } finally {
      uploadingAvatar.value = false
      closeCropper()
    }
  }, 'image/jpeg', 0.9)
}

async function handleRemovePhoto() {
  if (!confirm('Are you sure you want to remove your custom profile photo?')) return
  deletingAvatar.value = true
  try {
    await auth.deleteAvatar()
    toast.avatar('Avatar deleted', 'Profile picture removed')
  } catch (e) {
    console.error(e)
    toast.error('Failed to remove profile photo.')
  } finally {
    deletingAvatar.value = false
  }
}

const salaryInput = ref(auth.user?.monthly_salary ?? 0)
const nameInput = ref(auth.user?.name ?? '')
const nameSavedText = ref('Save')
const savingName = ref(false)

watch(() => auth.user?.name, (newVal) => {
  if (newVal !== undefined) {
    nameInput.value = newVal
  }
})

const nameValidationError = computed(() => {
  const trimmed = nameInput.value?.trim() ?? ''
  if (!trimmed) {
    return 'Name cannot be empty.'
  }
  if (nameInput.value.length > 30) {
    return 'Name cannot exceed 30 characters.'
  }
  return ''
})

const hasNameChanged = computed(() => {
  return nameInput.value !== (auth.user?.name ?? '')
})

const isNameValid = computed(() => {
  return nameValidationError.value === ''
})

async function saveName() {
  if (!isNameValid.value) return
  savingName.value = true
  try {
    await auth.updateProfile({ name: nameInput.value.trim() })
    nameSavedText.value = 'Saved ✓'
    setTimeout(() => {
      nameSavedText.value = 'Save'
    }, 2000)
  } catch (e) {
    console.error(e)
    toast.error('Failed to update name.')
  } finally {
    savingName.value = false
  }
}

const savingSalary = ref(false)
const activeTab = computed({
  get() {
    return route.query.tab || 'main'
  },
  set(val) {
    if (val === 'main') {
      router.push({ query: {} })
    } else {
      router.push({ query: { tab: val } })
    }
  }
})

async function saveSalary() {
  savingSalary.value = true
  try {
    const salaryValue = parseFloat(salaryInput.value) || 0
    await auth.updateProfile({ monthly_salary: salaryValue })
    salaryInput.value = auth.user?.monthly_salary ?? 0
    toast.salary('Salary updated', 'Monthly salary updated')
  } catch (e) {
    console.error('Failed to save salary:', e)
    toast.error('Failed to save monthly salary.')
  } finally {
    savingSalary.value = false
  }
}

// Privacy Toggles
async function toggleHideBalances() {
  const newValue = !auth.user?.hide_balances
  try {
    await auth.updateProfile({ hide_balances: newValue })
  } catch (e) {
    toast.error('Failed to update balance privacy setting.')
  }
}

async function toggleHideStats() {
  const newValue = !auth.user?.hide_stats
  try {
    await auth.updateProfile({ hide_stats: newValue })
  } catch (e) {
    toast.error('Failed to update stats privacy setting.')
  }
}

// Active Sessions
const loadingSessions = ref(false)
const revokingSessionId = ref(null)
const loggingOutOthers = ref(false)

async function loadSessions() {
  loadingSessions.value = true
  try {
    await auth.fetchSessions()
  } catch (e) {
    console.error('Failed to load active sessions:', e)
  } finally {
    loadingSessions.value = false
  }
}

onMounted(() => {
  loadSessions()
})

async function handleRevoke(sessionId) {
  revokingSessionId.value = sessionId
  try {
    await auth.revokeSession(sessionId)
    toast.session('Session revoked', 'Device logged out')
  } catch (e) {
    toast.error('Failed to revoke session.')
  } finally {
    revokingSessionId.value = null
  }
}

async function handleLogoutOthers() {
  loggingOutOthers.value = true
  try {
    await auth.logoutOtherSessions()
    toast.session('Sessions ended', 'Logged out of other devices')
  } catch (e) {
    toast.error('Failed to log out of other devices.')
  } finally {
    loggingOutOthers.value = false
  }
}

function formatActiveTime(timestamp) {
  if (!timestamp) return 'just now'
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 1000 / 60)
  
  if (diffMins < 1) return 'just now'
  if (diffMins === 1) return '1 minute ago'
  if (diffMins < 60) return `${diffMins} minutes ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours === 1) return '1 hour ago'
  if (diffHours < 24) return `${diffHours} hours ago`
  
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  return `${diffDays} days ago`
}

async function handleSignOut() {
  await auth.logout()
}
</script>

<template>
  <div class="p-6 pb-24 max-w-3xl mx-auto animate-fade-in relative">
    
    <!-- Tab 1: Main Settings View -->
    <div v-if="activeTab === 'main'">
      <div class="mb-8">
        <h1 class="text-2xl font-medium tracking-tight text-foreground">Settings</h1>
      </div>

      <!-- Connected Account profile card -->
      <UiCard class="mb-6 overflow-hidden">
        <UiCardContent class="p-0">
          <div class="flex items-center gap-4 p-5 bg-gradient-to-br from-primary/10 to-primary/5">
            <!-- User Avatar (Read-only) -->
            <div class="relative h-16 w-16 shrink-0 rounded-full overflow-hidden border-2 border-primary/20 shadow-lg">
              <img v-if="activeAvatar" :src="activeAvatar" class="h-full w-full object-cover" alt="Avatar" />
              <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary/70 text-xl font-bold text-primary-foreground">
                {{ initials }}
              </div>
            </div>
            
            <div class="min-w-0 flex-1">
              <p class="text-base font-bold text-foreground">{{ auth.user?.name }}</p>
              <p class="text-sm text-muted-foreground truncate">{{ auth.user?.email }}</p>
              
              <div class="mt-2 flex items-center gap-2 flex-wrap">
                <!-- Connected Account Badge -->
                <div 
                  v-if="auth.user?.google_id" 
                  class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 border border-blue-200 dark:border-blue-800/40"
                >
                  <!-- Google Mini Icon -->
                  <svg class="h-3 w-3" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  <span class="text-[10px] font-bold text-blue-700 dark:text-blue-400">Connected with Google</span>
                </div>
                <div 
                  v-else 
                  class="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 border border-zinc-200 dark:border-zinc-700"
                >
                  <span class="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">Email Credentials Account</span>
                </div>
              </div>
            </div>
          </div>
        </UiCardContent>
      </UiCard>

      <!-- Financial -->
      <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Financial</p>
      <UiCard class="mb-6 overflow-hidden border-emerald-500/20 shadow-emerald-500/5">
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

      <!-- Account Menu -->
      <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Account</p>
      <UiCard class="mb-6 overflow-hidden">
        <UiCardContent class="p-0 divide-y divide-border">
          <!-- Profile Row -->
          <button 
            @click="activeTab = 'profile'"
            class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
          >
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
          </button>

          <!-- Privacy & Security Row -->
          <button 
            @click="activeTab = 'privacy_security'"
            class="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
          >
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <Shield class="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p class="text-sm font-medium">Privacy & Security</p>
                <p class="text-xs text-muted-foreground">Manage your sessions, visibility and active devices</p>
              </div>
            </div>
            <ChevronRight class="h-4 w-4 text-muted-foreground" />
          </button>

          <!-- Notifications Row -->
          <div class="flex items-center justify-between px-5 py-4 opacity-60">
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Bell class="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p class="text-sm font-medium">Notifications</p>
                <p class="text-xs text-muted-foreground">Alerts and reminders (Coming Soon)</p>
              </div>
            </div>
            <ChevronRight class="h-4 w-4 text-muted-foreground" />
          </div>
        </UiCardContent>
      </UiCard>

      <!-- Appearance -->
      <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Appearance</p>
      <UiCard class="mb-6 overflow-hidden">
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

      <!-- Help & Support -->
      <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Help & Support</p>
      <UiCard class="mb-6 overflow-hidden">
        <UiCardContent class="p-0 divide-y divide-border">
          <RouterLink to="/guide" class="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
                <BookOpen class="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p class="text-sm font-medium">Quick Start Guide</p>
                <p class="text-xs text-muted-foreground">View setup checklist and tips</p>
              </div>
            </div>
            <ChevronRight class="h-4 w-4 text-muted-foreground" />
          </RouterLink>
        </UiCardContent>
      </UiCard>

      <!-- Sign out -->
      <UiCard class="overflow-hidden mb-8">
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

      <p class="text-center text-xs text-muted-foreground mt-6">EleFam v1.8.6</p>
    </div>

    <!-- Tab 2: Privacy & Security Sub-view -->
    <div v-else-if="activeTab === 'privacy_security'" class="animate-fade-in">
      <div class="mb-6 flex items-center gap-2">
        <button 
          @click="activeTab = 'main'" 
          class="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-all active:scale-90"
          title="Back to Settings"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>
        <span class="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Back to Settings</span>
      </div>

      <div class="mb-8">
        <h1 class="text-2xl font-medium tracking-tight text-foreground">Privacy & Security</h1>
        <p class="text-xs text-muted-foreground mt-1">Manage active sessions and customize privacy visibility toggles</p>
      </div>

      <!-- Connected Account Details (Read-only) -->
      <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Connected Account</p>
      <UiCard class="mb-6 overflow-hidden">
        <UiCardContent class="p-5">
          <div class="flex items-center gap-4">
            <div v-if="auth.user?.avatar" class="h-14 w-14 shrink-0 rounded-full overflow-hidden border-2 border-primary/20 shadow-md">
              <img :src="auth.user.avatar" class="h-full w-full object-cover" alt="Google Avatar" />
            </div>
            <div v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-lg font-bold text-primary-foreground shadow-md">
              {{ initials }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-bold text-foreground">{{ auth.user?.name }}</p>
              <p class="text-xs text-muted-foreground truncate">{{ auth.user?.email }}</p>
              
              <div class="mt-2 flex items-center gap-2">
                <span 
                  v-if="auth.user?.google_id" 
                  class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 border border-blue-200 dark:border-blue-800/40 text-[10px] font-bold text-blue-700 dark:text-blue-400"
                >
                  <svg class="h-2.5 w-2.5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                  </svg>
                  Connected with Google
                </span>
                <span 
                  v-else 
                  class="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 border border-zinc-200 dark:border-zinc-700 text-[10px] font-bold text-zinc-600 dark:text-zinc-400"
                >
                  Email Credentials Account
                </span>
              </div>
            </div>
          </div>
        </UiCardContent>
      </UiCard>

      <!-- Privacy Preferences -->
      <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Privacy Settings</p>
      <UiCard class="mb-6 overflow-hidden">
        <UiCardContent class="p-0 divide-y divide-border">
          <!-- Hide Balances -->
          <div class="flex items-center justify-between px-5 py-4">
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <Shield class="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p class="text-sm font-medium">Hide Balances</p>
                <p class="text-xs text-muted-foreground">Blur monetary values across the application</p>
              </div>
            </div>
            <button
              @click="toggleHideBalances"
              class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none"
              :class="auth.user?.hide_balances ? 'bg-primary' : 'bg-muted'"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200"
                :class="auth.user?.hide_balances ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
          </div>

          <!-- Hide Stats -->
          <div class="flex items-center justify-between px-5 py-4">
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                <Shield class="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p class="text-sm font-medium">Hide Stats</p>
                <p class="text-xs text-muted-foreground">Blur charts and stats summaries on the dashboard</p>
              </div>
            </div>
            <button
              @click="toggleHideStats"
              class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none"
              :class="auth.user?.hide_stats ? 'bg-primary' : 'bg-muted'"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200"
                :class="auth.user?.hide_stats ? 'translate-x-6' : 'translate-x-1'"
              />
            </button>
          </div>
        </UiCardContent>
      </UiCard>

      <!-- Active Sessions -->
      <div class="flex items-center justify-between px-1 mb-2">
        <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Sessions</p>
        <button 
          v-if="auth.sessions.length > 1"
          @click="handleLogoutOthers" 
          :disabled="loggingOutOthers"
          class="text-xs font-bold text-destructive hover:underline disabled:opacity-50 transition-all duration-200"
        >
          {{ loggingOutOthers ? 'Revoking...' : 'Log out other devices' }}
        </button>
      </div>
      <UiCard class="mb-6 overflow-hidden">
        <UiCardContent class="p-0">
          <div v-if="loadingSessions" class="flex flex-col items-center py-8 gap-2">
            <RefreshCw class="h-5 w-5 text-primary animate-spin" />
            <p class="text-xs text-muted-foreground">Loading active sessions...</p>
          </div>

          <div v-else class="divide-y divide-border">
            <div 
              v-for="session in auth.sessions" 
              :key="session.id" 
              class="px-5 py-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
            >
              <div class="flex items-center gap-3 min-w-0">
                <!-- Device Icon -->
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50">
                  <Laptop v-if="session.device_details?.device === 'Desktop'" class="h-4.5 w-4.5" />
                  <Smartphone v-else-if="session.device_details?.device === 'Mobile'" class="h-4.5 w-4.5" />
                  <Globe v-else class="h-4.5 w-4.5" />
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <p class="text-sm font-medium text-foreground">
                      {{ session.device_details?.browser || 'Browser' }} on {{ session.device_details?.platform || 'Device' }}
                    </p>
                    <span 
                      v-if="session.is_current" 
                      class="rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                    >
                      This device
                    </span>
                  </div>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    IP: {{ session.ip_address || 'Unknown' }} • Active {{ formatActiveTime(session.last_active_at) }}
                  </p>
                </div>
              </div>

              <!-- Revoke Button -->
              <button 
                v-if="!session.is_current"
                @click="handleRevoke(session.id)"
                :disabled="revokingSessionId === session.id"
                class="h-8 w-8 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors shrink-0 disabled:opacity-50 border border-transparent hover:border-destructive/20"
                title="Revoke session"
              >
                <Trash2 v-if="revokingSessionId !== session.id" class="h-4 w-4" />
                <RefreshCw v-else class="h-4 w-4 animate-spin" />
              </button>
            </div>
          </div>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Tab 3: Profile Settings Sub-view -->
    <div v-else-if="activeTab === 'profile'" class="animate-fade-in">
      <div class="mb-6 flex items-center gap-2">
        <button 
          @click="activeTab = 'main'" 
          class="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-all active:scale-90"
          title="Back to Settings"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>
        <span class="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Back to Settings</span>
      </div>

      <div class="mb-8">
        <h1 class="text-2xl font-medium tracking-tight text-foreground">Profile Settings</h1>
        <p class="text-xs text-muted-foreground mt-1">Manage your public profile information and avatar picture</p>
      </div>

      <!-- Profile Photo Selection Card -->
      <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Profile Photo</p>
      <UiCard class="mb-6 overflow-hidden">
        <UiCardContent class="p-5 flex flex-col items-center justify-center text-center">
          <!-- User Avatar Circle -->
          <div class="relative h-28 w-28 shrink-0 rounded-full overflow-hidden border-4 border-primary/20 shadow-xl mb-4">
            <img v-if="activeAvatar" :src="activeAvatar" class="h-full w-full object-cover" alt="Avatar" />
            <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-primary/70 text-3xl font-bold text-primary-foreground">
              {{ initials }}
            </div>
            
            <!-- Loading Spinner Overlay -->
            <div v-if="uploadingAvatar || deletingAvatar" class="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
              <Loader2 class="h-8 w-8 animate-spin" />
            </div>
          </div>
          
          <!-- Actions buttons -->
          <div class="flex flex-col sm:flex-row items-center gap-3">
            <UiButton 
              size="sm" 
              variant="outline" 
              @click="triggerFileSelect"
              :disabled="uploadingAvatar || deletingAvatar"
              class="rounded-xl font-semibold gap-2 border-border/80 hover:bg-muted"
            >
              <Camera class="h-4 w-4 text-muted-foreground" />
              Edit Photo
            </UiButton>
            
            <!-- Only show Remove Photo if custom avatar exists in DB -->
            <button 
              v-if="auth.user?.avatar"
              @click="handleRemovePhoto"
              :disabled="uploadingAvatar || deletingAvatar"
              class="text-xs font-semibold text-destructive hover:underline transition-all disabled:opacity-50 py-2 px-3"
            >
              Remove Photo
            </button>
          </div>

          <!-- Hidden Input for File Upload -->
          <input 
            ref="fileInput"
            type="file" 
            class="hidden" 
            accept="image/png, image/jpeg, image/jpg" 
            @change="handleFileChange"
          />
        </UiCardContent>
      </UiCard>

      <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Profile Information</p>
      <UiCard class="mb-6 overflow-hidden">
        <UiCardContent class="p-5 space-y-5">
          <!-- Full Name Field -->
          <div class="space-y-1.5">
            <label for="fullName" class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Full Name</label>
            
            <div class="flex items-center gap-2">
              <input 
                id="fullName"
                v-model="nameInput"
                type="text" 
                maxlength="30"
                class="w-full bg-muted/50 border border-border rounded-xl py-2 px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Name"
              />
              
              <UiButton 
                v-if="hasNameChanged"
                size="sm" 
                variant="default" 
                @click="saveName" 
                :disabled="savingName || !isNameValid" 
                class="h-9 px-4 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 transition-all duration-200"
              >
                <Loader2 v-if="savingName" class="h-3.5 w-3.5 animate-spin mr-1" />
                {{ nameSavedText }}
              </UiButton>
            </div>

            <!-- Inline validation error message -->
            <p v-if="nameValidationError" class="text-xs font-semibold text-destructive mt-1 px-1">
              {{ nameValidationError }}
            </p>
          </div>

          <!-- Email Address Field (Read-only) -->
          <div class="pt-4 border-t border-border space-y-1">
            <label class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
            <p class="text-sm font-semibold text-muted-foreground/80 mt-0.5">{{ auth.user?.email }}</p>
            <p class="text-[10px] text-muted-foreground font-medium italic mt-1">Managed by Google</p>
          </div>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- Cropping Modal -->
    <div v-if="showCropperModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
      <div class="bg-background border border-border w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <!-- Modal Header -->
        <div class="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 class="font-bold text-foreground">Crop Profile Photo</h3>
          <button @click="closeCropper" class="text-muted-foreground hover:text-foreground text-sm font-medium">Cancel</button>
        </div>
        
        <!-- Modal Content (Cropper Area) -->
        <div class="flex-1 bg-zinc-950 flex items-center justify-center p-6 min-h-[300px]">
          <Cropper
            ref="cropperRef"
            :src="cropperImageSrc"
            :stencil-component="CircleStencil"
            :stencil-props="{
              aspectRatio: 1/1
            }"
            class="max-h-[50vh] w-full"
          />
        </div>
        
        <!-- Modal Footer -->
        <div class="px-5 py-4 border-t border-border flex items-center justify-end gap-3 bg-muted/20">
          <UiButton size="sm" variant="outline" @click="closeCropper" class="rounded-xl font-semibold border-border/80 hover:bg-muted">
            Cancel
          </UiButton>
          <UiButton size="sm" variant="default" @click="cropAndUpload" class="rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground">
            Done
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>
