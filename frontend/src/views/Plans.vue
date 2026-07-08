<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { usePlansStore } from '@/stores/plans.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useToast } from '@/composables/useToast.js'
import { usePushNotifications } from '@/composables/usePushNotifications.js'
import { Plus, Pencil, Trash2, X, Calendar, Search, CheckCircle2, Wallet, ChevronLeft, ChevronRight, ChevronDown, Filter } from 'lucide-vue-next'
import { watch } from 'vue'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiTextarea from '@/components/ui/Textarea.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import DatePicker from '@/components/ui/DatePicker.vue'
import { SkeletonListItem } from '@/components/skeletons'
import { formatCurrency, parseCurrency } from '@/utils/format'
import { getWalletIconUrl } from '@/lib/walletIcons.js'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'
import EmptyFeedState from '@/components/shared/EmptyFeedState.vue'
import { getDaysRemaining, getDaysRemainingText, getDaysRemainingClass, getPlanBackgroundClass } from '@/utils/planHelpers'
import { getPlansForCalendarDay, RECURRENCE_OPTIONS } from '@/lib/planRecurrence.js'
import UnsavedChangesAlert from '@/components/shared/UnsavedChangesAlert.vue'
import ConfirmAlert from '@/components/shared/ConfirmAlert.vue'
import PushPromptAlert from '@/components/shared/PushPromptAlert.vue'
import ExpenseIcon from '@/components/shared/ExpenseIcon.vue'
import TransactionFilterSheet from '@/components/shared/TransactionFilterSheet.vue'
import LoadMoreButton from '@/components/shared/LoadMoreButton.vue'

const store = usePlansStore()
const walletsStore = useWalletsStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const push = usePushNotifications()

const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, 400)

const showFilters = ref(false)
const filterDateFrom = ref('')
const filterDateTo = ref('')
const showPaidPlans = ref(true)

function loadFeed(cursor = null) {
  store.fetchFeed({
    search: debouncedSearch.value,
    start_date: filterDateFrom.value,
    end_date: filterDateTo.value,
    limit: 15,
    cursor
  })
}

function applyFilters() {
  showFilters.value = false
  loadFeed()
}

function clearFilters() {
  filterDateFrom.value = ''
  filterDateTo.value = ''
  debouncedSearch.value = ''
  searchQuery.value = ''
  showFilters.value = false
  loadFeed()
}

watch(debouncedSearch, () => {
  loadFeed()
})

// Calendar state
const currentMonth = ref(new Date().getMonth())
const currentYear = ref(new Date().getFullYear())
const selectedDate = ref(null)

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const dayNames = ["S", "M", "T", "W", "T", "F", "S"]

// Close bubble when clicking outside
const closeBubble = (e) => {
  if (!e.target.closest('.calendar-day-cell')) {
    selectedDate.value = null
  }
}
function onFinanceChanged(e) {
  if (e.detail?.entity === 'plan' && e.detail?.action === 'paid') {
    showPaidPlans.value = true
    loadFeed()
  }
}

onMounted(() => {
  if (!store.fetched && !store.loading) {
    loadFeed()
  }
  if (!walletsStore.fetched && !walletsStore.loading) {
    walletsStore.fetchAll().catch(() => {})
  }
  if (route.query.action === 'add') {
    openCreate()
    router.replace({ query: { ...route.query, action: undefined } })
  }
  document.addEventListener('click', closeBubble)
  window.addEventListener('pamilya:finance-changed', onFinanceChanged)
  
  if (push.isSupported.value) {
    push.checkStatus()
  }
})

onUnmounted(() => {
  document.removeEventListener('click', closeBubble)
  window.removeEventListener('pamilya:finance-changed', onFinanceChanged)
})

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
  selectedDate.value = null
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
  selectedDate.value = null
}

function getIndicatorColor(plan) {
  if (plan.is_paid) return 'bg-emerald-500' // green for paid
  const days = getDaysRemaining(plan)
  if (days <= 0) return 'bg-red-500'
  if (days <= 5) return 'bg-amber-400' // yellow warning
  return 'bg-primary' // purple for far
}

function getUrgentIndicatorBorderColor(plans) {
  if (!plans || plans.length === 0) return ''
  const hasUnpaid = plans.some(p => !p.is_paid)
  if (!hasUnpaid) return 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
  
  if (plans.some(p => !p.is_paid && getDaysRemaining(p) <= 0)) return 'border-red-500 text-red-600 dark:text-red-400 font-bold'
  if (plans.some(p => !p.is_paid && getDaysRemaining(p) <= 5)) return 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
  return 'border-primary text-primary font-bold'
}

const calendarDays = computed(() => {
  const days = []
  const firstDayOfMonth = new Date(currentYear.value, currentMonth.value, 1)
  const lastDayOfMonth = new Date(currentYear.value, currentMonth.value + 1, 0)
  
  const startDayOfWeek = firstDayOfMonth.getDay()
  const prevMonthLastDay = new Date(currentYear.value, currentMonth.value, 0).getDate()
  
  // Prev month padding
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({
      date: new Date(currentYear.value, currentMonth.value - 1, prevMonthLastDay - i),
      isCurrentMonth: false,
      isToday: false,
      plans: []
    })
  }
  
  const today = new Date()
  today.setHours(0,0,0,0)
  
  // Current month
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    const dateObj = new Date(currentYear.value, currentMonth.value, i)
    const isToday = dateObj.getTime() === today.getTime()
    
    const dayPlans = getPlansForCalendarDay(store.plans, dateObj)
    
    days.push({
      date: dateObj,
      isCurrentMonth: true,
      isToday: isToday,
      plans: dayPlans,
      dateString: dateObj.toISOString().slice(0, 10)
    })
  }
  
  // Next month padding
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: new Date(currentYear.value, currentMonth.value + 1, i),
      isCurrentMonth: false,
      isToday: false,
      plans: []
    })
  }
  
  return days
})

// unified list
const displayPlans = computed(() => {
  let list = store.plans

  if (!showPaidPlans.value) {
    list = list.filter((p) => !p.is_paid)
  }

  // Search is already done server-side via loadFeed, 
  // but if we want instant client-side filtering on existing data:
  if (debouncedSearch.value) {
    const s = debouncedSearch.value.toLowerCase()
    list = list.filter(p => 
      (p.title || '').toLowerCase().includes(s) || 
      (p.description || '').toLowerCase().includes(s)
    )
  }

  // Sort upcoming first (by closest due date), then paid (by most recently paid)
  return list.slice().sort((a, b) => {
    if (a.is_paid !== b.is_paid) {
      return a.is_paid ? 1 : -1
    }
    if (a.is_paid) {
      const dateA = a.paid_date ? new Date(a.paid_date) : new Date(a.updated_at)
      const dateB = b.paid_date ? new Date(b.paid_date) : new Date(b.updated_at)
      return dateB - dateA
    } else {
      return new Date(a.due_date) - new Date(b.due_date)
    }
  })
})

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str.includes('T') ? str : str + 'T00:00:00')
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

// Modal form states
const showAddEditModal = ref(false)
const viewMode = ref(false)
const editingPlan = ref(null)
const form = ref({ title: '', amount: '', due_date: '', description: '', recurrence: '' })
const initialForm = ref(null)
const formError = ref('')
const isSubmitting = ref(false)
const isRecurrenceDropdownOpen = ref(false)

const closeRecurrenceDropdown = () => {
  setTimeout(() => {
    isRecurrenceDropdownOpen.value = false
  }, 150)
}

const showPayModal = ref(false)
const payingPlan = ref(null)
const payWalletId = ref(null)
const payBalanceError = ref('')
const showUnsavedChangesAlert = ref(false)
const showDeleteConfirm = ref(false)
const pendingDeleteTitle = ref('')
const pendingDeleteId = ref(null)
const closeModalAfterDelete = ref(false)

const paymentType = ref('full')
const paymentAmount = ref('')
const paymentNewDueDate = ref('')

function openCreate() {
  editingPlan.value = null
  viewMode.value = false
  formError.value = ''
  form.value = {
    title: '',
    amount: '',
    due_date: new Date().toISOString().slice(0, 10),
    description: '',
    recurrence: ''
  }
  initialForm.value = JSON.stringify(form.value)
  showAddEditModal.value = true
}

function openEdit(plan) {
  editingPlan.value = plan
  viewMode.value = true
  formError.value = ''
  form.value = {
    title: plan.title,
    amount: plan.amount,
    due_date: plan.due_date,
    description: plan.description ?? '',
    recurrence: plan.recurrence ?? ''
  }
  initialForm.value = JSON.stringify(form.value)
  showAddEditModal.value = true
}

function handleClose() {
  if (viewMode.value) {
    showAddEditModal.value = false
    return
  }
  const isDirty = initialForm.value && JSON.stringify(form.value) !== initialForm.value
  if (isDirty) {
    showUnsavedChangesAlert.value = true
  } else {
    showAddEditModal.value = false
  }
}

async function handleSaveFromAlert() {
  showUnsavedChangesAlert.value = false
  await submitForm()
}

function handleDiscardFromAlert() {
  showUnsavedChangesAlert.value = false
  showAddEditModal.value = false
}

async function submitForm() {
  formError.value = ''
  const amount = parseCurrency(form.value.amount)
  if (!amount || amount <= 0) {
    formError.value = 'Please enter a valid amount'
    return
  }
  if (!form.value.title.trim()) {
    formError.value = 'Please enter a title'
    return
  }
  if (!form.value.due_date) {
    formError.value = 'Please select a due date'
    return
  }

  const payload = {
    title: form.value.title.trim(),
    amount: amount,
    due_date: form.value.due_date,
    description: form.value.description.trim() || null,
    recurrence: form.value.recurrence || null
  }

  isSubmitting.value = true
  try {
    if (editingPlan.value) {
      await store.update(editingPlan.value.id, payload)
      toast.success('Plan updated successfully')
      showAddEditModal.value = false
    } else {
      await store.create(payload)
      toast.success('Plan created successfully')
      showAddEditModal.value = false
      
      // Prompt to enable reminders if they aren't subscribed and it's supported
      if (push.isSupported.value && !push.isSubscribed.value) {
        setTimeout(() => {
          showPushPrompt.value = true
        }, 500)
      }
    }
  } catch (e) {
    formError.value = e.response?.data?.message ?? 'An error occurred while saving'
  } finally {
    isSubmitting.value = false
  }
}

const showPushPrompt = ref(false)

async function handleEnablePush() {
  await push.subscribe()
  showPushPrompt.value = false
}

function handleSkipPush() {
  showPushPrompt.value = false
}

function requestRemovePlan(plan, closeModal = false) {
  pendingDeleteId.value = plan.id
  pendingDeleteTitle.value = plan.title
  closeModalAfterDelete.value = closeModal
  showDeleteConfirm.value = true
}

function removePlan(plan) {
  requestRemovePlan(plan, false)
}

function removePlanAndClose() {
  if (!editingPlan.value) return
  requestRemovePlan(editingPlan.value, true)
}

async function confirmRemovePlan() {
  if (!pendingDeleteId.value) return
  await store.remove(pendingDeleteId.value)
  if (closeModalAfterDelete.value) {
    showAddEditModal.value = false
  }
  showDeleteConfirm.value = false
  pendingDeleteId.value = null
  pendingDeleteTitle.value = ''
  closeModalAfterDelete.value = false
}

const deleteConfirmMessage = computed(() => {
  if (!pendingDeleteTitle.value) {
    return 'This will permanently remove this plan. This action cannot be undone.'
  }
  return `This will permanently remove "${pendingDeleteTitle.value}". This action cannot be undone.`
})

function openPayModal(plan) {
  if (showAddEditModal.value) {
    showAddEditModal.value = false
  }
  payingPlan.value = plan
  payWalletId.value = walletsStore.wallets[0]?.id ?? null
  payBalanceError.value = ''
  paymentType.value = 'full'
  paymentAmount.value = ''
  paymentNewDueDate.value = ''
  showPayModal.value = true
}

async function confirmPay() {
  payBalanceError.value = ''
  const plan = payingPlan.value
  if (!plan) return

  const isPartial = paymentType.value === 'partial'
  const amountToPay = isPartial ? parseCurrency(paymentAmount.value) : parseFloat(plan.amount)
  
  if (isPartial && (!amountToPay || amountToPay <= 0)) {
    payBalanceError.value = 'Please enter a valid partial payment amount.'
    return
  }

  if (isPartial && amountToPay >= parseFloat(plan.amount)) {
    payBalanceError.value = 'Partial payment must be less than the total plan amount.'
    return
  }

  if (payWalletId.value) {
    const wallet = walletsStore.wallets.find(w => w.id === payWalletId.value)
    if (wallet && amountToPay > parseFloat(wallet.balance)) {
      payBalanceError.value = `Insufficient balance. ${wallet.name} only has ${formatCurrency(wallet.balance)}.`
      return
    }
  }

  const newDueDate = isPartial && paymentNewDueDate.value ? paymentNewDueDate.value : null

  await store.markPaid(plan.id, payWalletId.value, isPartial ? amountToPay : null, isPartial, newDueDate)
  showPayModal.value = false
  payingPlan.value = null
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-6xl mx-auto animate-fade-in pb-24">
    <!-- Header -->
    <div class="mb-3 flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-[16px] font-medium tracking-tight text-foreground">Plan</h1>
        <p class="text-[10px] text-muted-foreground">Manage your upcoming bills and recurring commitments.</p>
      </div>
      <UiButton @click="openCreate" class="shrink-0 h-10 px-5 rounded-[50px] font-semibold bg-primary text-white hover:bg-primary/90 shadow-sm" size="sm">
        New Plan
      </UiButton>
    </div>

    <!-- iPhone Style Calendar -->
    <div class="mb-3 bg-card border border-border shadow-sm rounded-[24px] p-3 select-none">
      <!-- Calendar Header -->
      <div class="flex items-center justify-between mb-3 px-2">
        <h2 class="text-[13px] font-bold text-foreground">
          {{ monthNames[currentMonth] }} {{ currentYear }}
        </h2>
        <div class="flex gap-2">
          <UiButton variant="ghost" size="icon" class="h-8 w-8 rounded-full hover:bg-muted" @click="prevMonth">
            <ChevronLeft class="h-4 w-4" />
          </UiButton>
          <UiButton variant="ghost" size="icon" class="h-8 w-8 rounded-full hover:bg-muted" @click="nextMonth">
            <ChevronRight class="h-4 w-4" />
          </UiButton>
        </div>
      </div>
      
      <!-- Calendar Grid -->
      <div class="grid grid-cols-7 gap-y-1 gap-x-1">
        <!-- Day Names -->
        <div v-for="day in dayNames" :key="day" class="text-center text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
          {{ day }}
        </div>
        
        <!-- Days -->
        <div 
          v-for="(day, index) in calendarDays" 
          :key="index"
          class="calendar-day-cell relative flex flex-col items-center justify-start h-8"
        >
          <!-- Day Number Bubble -->
          <div 
            class="flex items-center justify-center h-6 w-6 rounded-full text-[10px] transition-colors cursor-pointer"
            :class="[
              !day.isCurrentMonth ? 'text-muted-foreground/30 font-medium' : (day.plans.length === 0 ? 'text-foreground font-medium hover:bg-muted' : ''),
              day.isToday && day.plans.length === 0 ? 'bg-primary text-white hover:bg-primary/90' : '',
              day.isToday && day.plans.length > 0 ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-background' : '',
              selectedDate === day.dateString ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-background bg-muted' : '',
              day.plans.length > 0 ? 'border-2 border-dashed ' + getUrgentIndicatorBorderColor(day.plans) : ''
            ]"
            @click="day.plans.length > 0 ? (selectedDate === day.dateString ? selectedDate = null : selectedDate = day.dateString) : null"
          >
            {{ day.date.getDate() }}
          </div>

          <!-- Popover / Bubble Chat Info -->
          <div 
            v-if="selectedDate === day.dateString && day.plans.length > 0"
            class="absolute bottom-[110%] z-50 min-w-[140px] max-w-[200px] bg-card border border-border text-foreground text-[10px] rounded-xl shadow-xl p-2.5 space-y-2 transform -translate-x-1/2 left-1/2 animate-in zoom-in duration-200"
          >
            <!-- Triangle pointer -->
            <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-card border-r border-b border-border"></div>
            
            <div v-for="plan in day.plans" :key="plan.id" class="relative z-10 flex flex-col items-center text-center">
              <div class="font-bold truncate w-full text-[11px]">{{ plan.title }}</div>
              <div class="flex items-center justify-center mt-0.5 opacity-90 gap-1.5">
                <CurrencyAmount :amount="plan.amount" size="xs" class="font-bold tracking-tight" />
                <span v-if="plan.is_paid" class="text-[8px] bg-emerald-500 text-white px-1 rounded-sm">PAID</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Search Input & Filter -->
    <div class="mb-3 flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <UiInput v-model="searchQuery" class="pl-9 bg-card border-border/60 h-11 rounded-xl shadow-sm text-[13px]" placeholder="Search plans…" />
        </div>
        <UiButton 
          variant="outline" 
          class="h-11 px-3 shrink-0 rounded-xl bg-card border-border/60 shadow-sm text-[11px]"
          :class="filterDateFrom || filterDateTo ? 'border-primary/50 text-primary bg-primary/5' : ''"
          @click="showFilters = true"
        >
          <Filter class="h-3.5 w-3.5 mr-1.5" />
          Filter
        </UiButton>
      </div>
      <div class="flex justify-end">
        <UiButton
          variant="ghost"
          class="h-9 px-4 rounded-xl text-[11px] font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          @click="showPaidPlans = !showPaidPlans"
        >
          {{ showPaidPlans ? 'Hide paid items' : 'Show paid items' }}
        </UiButton>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="store.loading && displayPlans.length === 0" class="space-y-3">
      <SkeletonListItem v-for="i in 4" :key="i" :show-icon="false" />
    </div>

    <!-- Empty Feed State -->
    <EmptyFeedState 
      v-else-if="displayPlans.length === 0" 
      :icon="Calendar" 
      title="No upcoming bills!" 
      dashed 
    />

    <!-- Plans List -->
    <div v-else class="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/80 rounded-3xl shadow-[0_15px_35px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden relative z-10 pt-4 pb-2 mt-2">
      <div class="space-y-1 px-2">
        <div
          v-for="plan in displayPlans"
          :key="plan.id"
          class="flex items-center justify-between gap-3 p-3 transition-all hover:bg-muted/30 active:bg-muted/50 cursor-pointer relative overflow-hidden rounded-2xl"
          :class="getPlanBackgroundClass(plan)"
          @click="openEdit(plan)"
        >
        <!-- Left side: Icon + Details -->
        <div class="flex items-center gap-3 flex-1 min-w-0 z-0">
          <div class="shrink-0" :class="plan.is_paid ? 'opacity-90' : ''">
            <ExpenseIcon :title="plan.title" size="md" />
          </div>
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-1.5 min-w-0">
              <span
                class="font-bold truncate text-[13px]"
                :class="plan.is_paid ? 'text-muted-foreground line-through decoration-emerald-500/50' : 'text-foreground'"
              >{{ plan.title }}</span>
              <span v-if="plan.recurrence" class="text-[8px] uppercase tracking-widest font-black bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 px-1.5 py-0.5 rounded">{{ plan.recurrence }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-1 mt-0.5">
              <span class="text-[11px] font-semibold text-muted-foreground/80">Due {{ formatDate(plan.due_date) }}</span>
              <span v-if="plan.is_paid" class="text-[11px] font-semibold text-emerald-600/80">• Paid {{ formatDate(plan.paid_date) }}</span>
            </div>
          </div>
        </div>

        <!-- Right side: Amount + Days Left -->
        <div class="flex flex-col items-end justify-center shrink-0 z-0 text-right">
          <span v-if="!plan.is_paid" class="text-[9px] tracking-wider mb-0.5" :class="getDaysRemainingClass(plan)">
            {{ getDaysRemainingText(plan) }}
          </span>
          <CurrencyAmount 
            :amount="plan.amount" 
            :type="plan.is_paid ? 'muted' : 'debt'" 
            size="sm" 
            class="font-black tabular-nums" 
          />
          <span v-if="plan.is_paid && plan.wallet_name" class="text-[9px] font-semibold text-muted-foreground/60 mt-0.5">
            via {{ plan.wallet_name }}
          </span>
        </div>
        
        </div>
        
        <div class="pt-2">
          <LoadMoreButton 
            v-if="store.hasMore" 
            :loading="store.loading" 
            @click="loadFeed(store.nextCursor)" 
          />
        </div>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <Teleport to="body">
      <div v-if="showAddEditModal" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4 animate-in fade-in duration-200" @mousedown.self="handleClose">
        <UiCard class="flex w-full max-w-none flex-col overflow-hidden bg-background shadow-2xl border-0
          max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300
          sm:animate-in sm:zoom-in-95 sm:duration-200
          max-sm:h-[85dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-t-3xl max-sm:rounded-b-none
          sm:max-h-[90vh] sm:min-h-0 sm:max-w-md sm:rounded-3xl" @mousedown.stop>
          
          <form @submit.prevent="submitForm" class="flex flex-col h-full overflow-hidden">
            <!-- Header -->
            <div class="relative shrink-0 pt-8 pb-4 flex flex-col items-center">
              <UiButton v-if="editingPlan" type="button" variant="ghost" size="icon" @click="removePlanAndClose" class="absolute left-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-destructive/10 text-destructive transition-colors">
                <Trash2 class="h-4 w-4" />
              </UiButton>

              <UiButton type="button" variant="ghost" size="icon" @click="handleClose" class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors">
                <X class="h-5 w-5 text-muted-foreground" />
              </UiButton>
              
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm mb-3">
                <Calendar class="h-6 w-6 text-primary" />
              </div>

              <p class="text-sm font-medium text-muted-foreground">
                <template v-if="viewMode">Plan Details</template>
                <template v-else>{{ editingPlan ? 'Edit Plan' : 'New Plan' }}</template>
              </p>
              
              <div class="mt-4 flex items-center justify-center w-full px-8 relative overflow-hidden">
                <div class="flex items-center justify-center gap-1 border-b-2 border-muted-foreground/30 pb-2 transition-colors min-w-[140px] max-w-full" :class="!viewMode && 'focus-within:border-primary'">
                  <span class="text-3xl font-semibold text-muted-foreground shrink-0 leading-none mt-1">₱</span>
                  <input 
                    v-if="!viewMode"
                    v-model="form.amount" 
                    type="number" 
                    min="0.01" 
                    step="0.01" 
                    placeholder="0.00" 
                    required
                    :style="{ width: Math.max(String(form.amount || '').length, 3) + 'ch' }"
                    class="bg-transparent text-center text-5xl font-bold tracking-tight outline-none focus:ring-0 p-0 leading-none placeholder:text-muted-foreground/30"
                  />
                  <div v-else class="bg-transparent text-center text-5xl font-bold tracking-tight outline-none p-0 leading-none">{{ formatCurrency(form.amount).replace(/[^\d.,]/g, '') }}</div>
                </div>
              </div>
            </div>

            <!-- Scrollable fields -->
            <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 sm:px-6 space-y-4">
              <div class="bg-card rounded-2xl shadow-sm border border-border p-1 space-y-1">
                <div class="p-3">
                  <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Title</UiLabel>
                  <UiInput v-if="!viewMode" v-model="form.title" placeholder="Rent, Electric Bill, Netflix…" required class="border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30 h-11" />
                  <div v-else class="text-base font-medium h-11 flex items-center px-3 bg-muted/20 rounded-md border border-transparent text-muted-foreground">{{ form.title }}</div>
                </div>

                <div class="p-3 pt-1">
                  <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Due Date</UiLabel>
                  <DatePicker v-if="!viewMode" v-model="form.due_date" placeholder="Pick a due date" class="w-full border-0 bg-muted/50" />
                  <div v-else class="text-base font-medium h-10 flex items-center px-3 bg-muted/20 rounded-md border border-transparent text-muted-foreground">{{ formatDate(form.due_date) }}</div>
                </div>

                <div class="p-3 pt-1">
                  <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Repeat / Installment</UiLabel>
                  <div v-if="!viewMode" class="relative">
                    <button 
                      type="button"
                      @click="isRecurrenceDropdownOpen = !isRecurrenceDropdownOpen"
                      @blur="closeRecurrenceDropdown"
                      class="flex h-11 w-full items-center justify-between rounded-md border-0 bg-muted/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
                    >
                      <span>{{ RECURRENCE_OPTIONS.find(o => o.value === (form.recurrence || ''))?.label || 'One-time only' }}</span>
                      <ChevronDown class="h-4 w-4 opacity-50" :class="{ 'rotate-180': isRecurrenceDropdownOpen }" />
                    </button>
                    
                    <div 
                      v-if="isRecurrenceDropdownOpen"
                      class="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-md outline-none animate-in fade-in zoom-in-95"
                    >
                      <div class="p-1">
                        <button
                          v-for="opt in RECURRENCE_OPTIONS"
                          :key="opt.value || 'none'"
                          type="button"
                          @click="form.recurrence = opt.value; isRecurrenceDropdownOpen = false"
                          class="relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 px-3 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                          :class="{ 'bg-accent/50': form.recurrence === opt.value }"
                        >
                          {{ opt.label }}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-base font-medium h-10 flex items-center px-3 bg-muted/20 rounded-md text-muted-foreground">
                    {{ RECURRENCE_OPTIONS.find(o => o.value === (form.recurrence || ''))?.label || 'One-time only' }}
                  </div>
                  <p v-if="!viewMode && form.recurrence" class="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                    Shows on each {{ form.recurrence === 'weekly' ? 'week' : form.recurrence === 'monthly' ? 'month' : 'year' }} on the calendar until fully paid.
                  </p>
                </div>
              </div>

              <div class="bg-card rounded-2xl shadow-sm border border-border p-4">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Description / Notes</UiLabel>
                <UiTextarea v-if="!viewMode" v-model="form.description" placeholder="Add additional details or account info here…" rows="3" class="bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/30 resize-none rounded-xl" />
                <div v-else class="text-sm font-medium min-h-[60px] bg-muted/20 p-3 rounded-md whitespace-pre-wrap text-muted-foreground">{{ form.description || 'No description provided.' }}</div>
              </div>
              
              <p v-if="formError" class="text-sm font-medium text-destructive mt-4 text-center bg-destructive/10 rounded-xl p-3">{{ formError }}</p>
            </div>

            <!-- Actions -->
            <div v-if="viewMode" class="p-4 bg-background border-t border-border flex items-center gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <UiButton type="button" variant="secondary" class="flex-1 font-semibold" @click="viewMode = false">
                Edit
              </UiButton>
              <UiButton v-if="!editingPlan?.is_paid" type="button" class="flex-1 font-bold bg-emerald-600 hover:bg-emerald-700" @click="openPayModal(editingPlan)">
                <CheckCircle2 class="h-4 w-4 mr-2" />
                Pay Now
              </UiButton>
            </div>
            <div v-else class="p-4 bg-background border-t border-border flex items-center gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <UiButton type="button" variant="secondary" class="flex-1 font-semibold" @click="handleClose" :disabled="isSubmitting">
                Cancel
              </UiButton>
              <UiButton type="submit" class="flex-1 font-bold" :disabled="isSubmitting" :loading="isSubmitting">
                {{ isSubmitting ? 'Saving…' : 'Save changes' }}
              </UiButton>
            </div>
          </form>
        </UiCard>
      </div>

      <UnsavedChangesAlert 
        :show="showUnsavedChangesAlert"
        @save="handleSaveFromAlert"
        @discard="handleDiscardFromAlert"
        @cancel="showUnsavedChangesAlert = false"
      />
      
      <PushPromptAlert
        :show="showPushPrompt"
        @enable="handleEnablePush"
        @skip="handleSkipPush"
        @cancel="handleSkipPush"
      />

      <ConfirmAlert
        :show="showDeleteConfirm"
        title="Delete plan?"
        :message="deleteConfirmMessage"
        confirm-label="Delete"
        @confirm="confirmRemovePlan"
        @cancel="showDeleteConfirm = false"
      />
    </Teleport>

    <!-- Pay with wallet modal -->
    <Teleport to="body">
      <div v-if="showPayModal" class="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4" @mousedown.self="showPayModal = false">
        <UiCard class="flex w-full max-w-none flex-col overflow-hidden bg-card shadow-2xl animate-in fade-in zoom-in duration-200
          max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-none max-sm:pt-[env(safe-area-inset-top)]
          sm:max-h-[90vh] sm:min-h-0 sm:max-w-md sm:rounded-2xl" @mousedown.stop>
          
          <div class="shrink-0 p-6 border-b border-border bg-gradient-to-r from-emerald-600/10 to-transparent flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold tracking-tight">Mark as Paid</h2>
              <p class="text-xs text-muted-foreground mt-0.5">
                <span class="font-semibold text-foreground">{{ payingPlan?.title }}</span>
                <span class="mx-1">·</span>
                <CurrencyAmount :amount="payingPlan?.amount ?? 0" type="neutral" size="md" class="font-semibold text-foreground" />
              </p>
            </div>
            <UiButton variant="ghost" size="icon" @click="showPayModal = false" class="rounded-full h-8 w-8">
              <X class="h-4 w-4" />
            </UiButton>
          </div>

          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            <UiCardContent class="p-6 space-y-5">
              
              <!-- Payment Type Toggle -->
              <div class="flex bg-muted/50 p-1 rounded-xl shadow-sm border border-border">
                <button 
                  @click="paymentType = 'full'" 
                  class="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors"
                  :class="paymentType === 'full' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
                >
                  Full Payment
                </button>
                <button 
                  @click="paymentType = 'partial'" 
                  class="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors"
                  :class="paymentType === 'partial' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
                >
                  Partial Payment
                </button>
              </div>

              <!-- Full Payment Details -->
              <div v-if="paymentType === 'full'" class="rounded-2xl border-2 border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Paid Amount</p>
                <CurrencyAmount :amount="payingPlan?.amount ?? 0" type="income" size="lg" class="font-black" />
                <p class="text-[10px] text-muted-foreground mt-1.5 font-medium leading-normal">
                  Marking this as paid will deduct funds from the wallet and log an expense.
                </p>
              </div>

              <!-- Partial Payment Form -->
              <div v-if="paymentType === 'partial'" class="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div class="space-y-2">
                  <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-bold">Amount to Pay Now</UiLabel>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₱</span>
                    <UiInput v-model="paymentAmount" type="number" min="0.01" step="0.01" class="pl-8 text-lg font-bold" placeholder="0.00" />
                  </div>
                  <p class="text-xs text-muted-foreground">Remaining balance will still be tracked under this plan.</p>
                </div>

                <div class="space-y-2">
                  <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-bold">Next Due Date (Optional)</UiLabel>
                  <DatePicker v-model="paymentNewDueDate" placeholder="Set a new due date" class="w-full" />
                  <p class="text-xs text-muted-foreground">Leave blank to keep the original due date.</p>
                </div>
              </div>

              <!-- Wallet picker -->
              <div class="space-y-2">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                  Pay from wallet
                </UiLabel>
                <div v-if="walletsStore.wallets.length === 0" class="text-sm text-muted-foreground rounded-xl border border-dashed p-4 text-center">
                  No wallets yet — you can still mark as paid without a wallet.
                </div>
                <div v-else class="max-h-[220px] overflow-y-auto pr-1 py-1 -mr-1">
                  <div class="grid grid-cols-1 gap-2">
                    <button
                      v-for="wallet in walletsStore.wallets"
                      :key="wallet.id"
                      type="button"
                      @click="payWalletId = wallet.id"
                      class="flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all duration-150"
                      :class="payWalletId === wallet.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-muted-foreground/40'"
                    >
                      <div class="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-background border border-border shadow-sm overflow-hidden">
                        <img 
                          :src="getWalletIconUrl(wallet)" 
                          class="w-full h-full object-contain rounded" 
                          @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                        />
                        <Wallet class="h-5 w-5 text-muted-foreground" style="display:none" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold truncate">{{ wallet.name }}</p>
                        <CurrencyAmount :amount="wallet.balance" type="muted" size="sm" class="tabular-nums sensitive-balance" />
                      </div>
                      <div v-if="payWalletId === wallet.id" class="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/20">
                        <CheckCircle2 class="h-3 w-3 text-white" />
                      </div>
                    </button>
                    
                    <button
                      type="button"
                      @click="payWalletId = null"
                      class="flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all duration-150"
                      :class="payWalletId === null ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-muted-foreground/40'"
                    >
                      <div class="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-background border border-border shadow-sm text-2xl">💰</div>
                      <p class="text-sm font-bold">No wallet (external account / cash)</p>
                    </button>
                  </div>
                </div>
              </div>

              <p v-if="payBalanceError" class="text-sm text-destructive font-medium rounded-xl bg-destructive/10 px-3 py-2 text-center">
                {{ payBalanceError }}
              </p>
            </UiCardContent>
          </div>

          <div class="shrink-0 border-t border-border bg-muted/20 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-3 sm:flex-row-reverse">
            <UiButton
              @click="confirmPay"
              :disabled="store.loading"
              size="lg"
              class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
            >
              {{ store.loading ? 'Processing…' : 'Confirm Payment' }}
            </UiButton>
            <UiButton variant="secondary" @click="showPayModal = false" size="lg" class="rounded-xl">
              Cancel
            </UiButton>
          </div>
        </UiCard>
      </div>
    </Teleport>
    <TransactionFilterSheet
      v-model:show="showFilters"
      v-model:dateFrom="filterDateFrom"
      v-model:dateTo="filterDateTo"
      title="Filter Plans"
      description="Select a date range to filter your upcoming and paid plans."
      @apply="applyFilters"
      @clear="clearFilters"
    />
  </div>
</template>
