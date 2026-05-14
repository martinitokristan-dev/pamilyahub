<script setup>
import { ref, computed, watch } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { Plus, Pencil, Trash2, X, Receipt, Search, TrendingUp, Calendar, ChevronDown, Wallet, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth.js'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import UiBadge from '@/components/ui/Badge.vue'
import DatePicker from '@/components/ui/DatePicker.vue'
import { formatCurrency, parseCurrency } from '@/utils/format'

const store = useExpensesStore()
const walletsStore = useWalletsStore()
const authStore = useAuthStore()
const dashboard = useDashboardStore()
useRegisterAddAction(openCreate)

const selectedMonth = ref(new Date().getMonth() + 1)
const selectedYear = ref(new Date().getFullYear())
const showMonthPicker = ref(false)
const showYearPicker = ref(false)

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Generate years dynamically based on data or default range
const availableYears = computed(() => {
  const currentYear = new Date().getFullYear()
  if (store.expenses.length === 0) {
    // Default range if no data: currentYear - 2 to currentYear + 1
    const years = []
    for (let y = currentYear - 2; y <= currentYear + 1; y++) {
      years.push(y)
    }
    return years
  }
  
  // Find earliest and latest years from expense dates
  const years = new Set()
  store.expenses.forEach(expense => {
    const date = new Date(expense.date)
    years.add(date.getFullYear())
  })
  
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years, currentYear)
  
  const yearList = []
  for (let y = minYear; y <= maxYear + 1; y++) {
    yearList.push(y)
  }
  return yearList.sort((a, b) => b - a) // Sort descending
})

const currentPage = ref(1)

const total = computed(() => dashboard.stats.expenses_total || 0)

const showForm = ref(false)
const editingId = ref(null)
const search = ref('')
const form = ref({ title: '', amount: '', category: '', description: '', date: '', wallet_id: null })

const debouncedSearch = refDebounced(search, 500)

// Reset to page 1 when filter or search changes
watch([selectedMonth, selectedYear, search], () => {
  currentPage.value = 1
})

watch([selectedMonth, selectedYear], () => {
  dashboard.fetchStats({ month: selectedMonth.value, year: selectedYear.value })
}, { immediate: true })

watch([selectedMonth, selectedYear, currentPage, debouncedSearch], () => {
  store.fetchAll(currentPage.value, { 
    month: selectedMonth.value, 
    year: selectedYear.value,
    search: debouncedSearch.value.trim() || undefined
  })
}, { immediate: true })

// total is now computed from dashboard stats

const effectiveLimit = computed(() => parseFloat(dashboard.stats.income_total ?? 0))

const remainingSalary = computed(() => {
  return effectiveLimit.value - parseFloat(total.value)
})

const spendingPercentage = computed(() => {
  if (effectiveLimit.value <= 0) {
    return parseFloat(total.value) > 0 ? 100 : 0
  }
  return (parseFloat(total.value) / effectiveLimit.value) * 100
})

// Wallet type → emoji + color
// Balance validation error
const balanceError = ref('')

function formatDateTime(dateStr, createdAt) {
  const datePart = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  if (!createdAt) return datePart
  const timePart = new Date(createdAt).toLocaleTimeString('en-PH', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  return `${datePart} · ${timePart}`
}

const filteredExpenses = computed(() => store.expenses)

function openCreate() {
  editingId.value = null
  const firstWallet = walletsStore.wallets[0]
  form.value = {
    title: '', amount: '', category: '', description: '',
    date: new Date().toISOString().slice(0, 10),
    wallet_id: firstWallet?.id ?? null,
  }
  showForm.value = true
}

function openEdit(expense) {
  editingId.value = expense.id
  form.value = {
    title: expense.title,
    amount: formatCurrency(expense.amount),
    category: expense.category ?? '',
    description: expense.description ?? '',
    date: typeof expense.date === 'string' ? expense.date.slice(0, 10) : expense.date,
    wallet_id: expense.wallet_id ?? null,
  }
  showForm.value = true
}

async function submit() {
  balanceError.value = ''
  const oldExpense = editingId.value ? store.expenses.find(e => e.id === editingId.value) : null
  const oldWalletId = oldExpense?.wallet_id ?? null
  const oldAmount = oldExpense ? parseFloat(oldExpense.amount) : 0
  const newWalletId = form.value.wallet_id
  const newAmount = parseCurrency(form.value.amount)

  // Balance validation
  if (newWalletId) {
    const wallet = walletsStore.wallets.find(w => w.id === newWalletId)
    if (wallet) {
      const available = parseFloat(wallet.balance) + (oldWalletId === newWalletId ? oldAmount : 0)
      if (newAmount > available) {
        balanceError.value = `Insufficient balance. ${wallet.name} only has ${formatCurrency(wallet.balance)}.`
        return
      }
    }
  }

  const data = { ...form.value, amount: newAmount }
  if (editingId.value) {
    await store.update(editingId.value, data)
    // Reflect balance in store optimistically
    if (oldWalletId) walletsStore.adjustBalance(oldWalletId, oldAmount)
    if (newWalletId) walletsStore.adjustBalance(newWalletId, -newAmount)
  } else {
    await store.create(data)
    if (newWalletId) walletsStore.adjustBalance(newWalletId, -newAmount)
  }
  showForm.value = false
  dashboard.fetchStats({ month: selectedMonth.value, year: selectedYear.value })
}

async function remove(expense) {
  await store.remove(expense.id)
  if (expense.wallet_id) walletsStore.adjustBalance(expense.wallet_id, parseFloat(expense.amount))
  dashboard.fetchStats({ month: selectedMonth.value, year: selectedYear.value })
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-6xl mx-auto animate-fade-in">
    <div class="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-[32px] sm:text-[40px] font-black tracking-tight text-foreground leading-none">Expenses</h1>
      </div>
      <div class="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
        <div class="bg-card border border-border shadow-sm px-3 sm:px-4 py-2 rounded-2xl flex flex-col items-center sm:items-end flex-1 sm:flex-none sm:min-w-[140px] transition-all hover:shadow-md min-w-0">
          <span class="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1 truncate w-full text-center sm:text-right">Total Expenses</span>
          <span class="text-base sm:text-xl font-black text-foreground tabular-nums truncate w-full text-center sm:text-right">{{ formatCurrency(total) }}</span>
        </div>

        <!-- iOS-style Date Filter -->
        <div class="flex items-center gap-1 sm:gap-2 bg-card border border-border shadow-sm rounded-2xl px-1 py-1 shrink-0">
          <button
            @click="showMonthPicker = true"
            class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors min-h-[40px] sm:min-h-[44px]"
          >
            <Calendar class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            <span class="text-xs sm:text-sm font-semibold">{{ months[selectedMonth - 1] }}</span>
            <ChevronDown class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </button>
          <button
            @click="showYearPicker = true"
            class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors min-h-[40px] sm:min-h-[44px]"
          >
            <span class="text-xs sm:text-sm font-semibold">{{ selectedYear }}</span>
            <ChevronDown class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </button>
        </div>

        <UiButton @click="openCreate" class="hidden sm:flex h-12 px-6 rounded-2xl">
          <Plus class="h-5 w-5 mr-1" /> Add
        </UiButton>
      </div>
    </div>

    <!-- Salary / Budget Tracking Card -->
    <UiCard class="mb-5 overflow-hidden border-primary/10 shadow-sm rounded-2xl bg-gradient-to-br from-card to-muted/20">
      <div class="p-4 sm:p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp class="h-4 w-4 text-primary" />
            </div>
            <h3 class="text-sm font-bold">Spending Power ({{ months[selectedMonth - 1] }})</h3>
          </div>
          <p class="text-xs font-bold" :class="remainingSalary < 0 ? 'text-destructive' : 'text-emerald-600'">
            {{ formatCurrency(Math.abs(remainingSalary)) }} {{ remainingSalary < 0 ? 'over budget' : 'left' }}
          </p>
        </div>
        
        <div class="space-y-2.5">
          <div class="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <span>Spent: {{ formatCurrency(total) }}</span>
            <span>Budget: {{ formatCurrency(effectiveLimit) }}</span>
          </div>
          <div class="h-2 w-full bg-muted rounded-full overflow-hidden flex">
             <div 
               class="h-full transition-all duration-700 ease-out" 
               :style="{ width: `${Math.min(spendingPercentage, 100)}%` }"
               :class="spendingPercentage > 100 ? 'bg-destructive' : spendingPercentage > 90 ? 'bg-destructive' : spendingPercentage > 75 ? 'bg-amber-500' : 'bg-emerald-500'"
             />
          </div>
          <div class="flex justify-between items-center">
            <p class="text-[10px] text-muted-foreground italic">
               {{ spendingPercentage > 100 ? "You've exceeded your limit!" : `${(100 - spendingPercentage).toFixed(0)}% of budget remaining` }}
            </p>
            <span class="text-[10px] font-black" :class="spendingPercentage > 100 ? 'text-destructive' : spendingPercentage > 90 ? 'text-destructive' : 'text-emerald-600'">
              {{ spendingPercentage.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
    </UiCard>

    <!-- Search bar -->
    <div class="relative mb-4">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <UiInput v-model="search" placeholder="Search expenses…" class="pl-9" />
    </div>

    <!-- Pagination Controls -->
    <div v-if="store.pagination.total > 10" class="flex items-center justify-end mb-6">
      <div class="flex items-center bg-card border border-border shadow-sm rounded-full p-1 gap-1">
        <button 
          class="h-11 w-11 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-muted active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
          :disabled="currentPage <= 1"
          @click="currentPage--"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>
        
        <div class="px-4 py-1 text-xs font-bold tracking-tight text-foreground flex items-center gap-1.5 border-x border-border/50">
          <span class="text-primary">{{ currentPage }}</span>
          <span class="text-muted-foreground/50">/</span>
          <span>{{ store.pagination.last_page }}</span>
        </div>

        <button 
          class="h-11 w-11 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-muted active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
          :disabled="currentPage >= store.pagination.last_page"
          @click="currentPage++"
        >
          <ChevronRight class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- Skeletons / No Data -->
    <template v-if="store.loading && !store.fetched">
      <!-- Mobile Skeletons -->
      <div class="flex flex-col gap-2 md:hidden">
        <div v-for="i in 5" :key="i" class="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
          <UiSkeleton class="h-12 w-12 rounded-xl" />
          <div class="flex-1 space-y-2">
            <UiSkeleton class="h-4 w-1/3" />
            <UiSkeleton class="h-3 w-1/2" />
          </div>
          <UiSkeleton class="h-4 w-16" />
        </div>
      </div>
      <!-- Desktop Skeletons -->
      <UiCard class="overflow-hidden hidden md:block">
        <div class="p-4 space-y-4">
          <div v-for="i in 5" :key="i" class="flex items-center gap-4">
            <UiSkeleton class="h-10 w-full" />
          </div>
        </div>
      </UiCard>
    </template>

    <div v-else-if="store.expenses.length === 0" class="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed bg-muted/20">
      <Receipt class="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p class="text-sm text-muted-foreground">No expenses for {{ months[selectedMonth - 1] }} {{ selectedYear }}</p>
      <p class="text-xs text-muted-foreground mt-1">Try selecting a different month or add a new expense</p>
    </div>

    <!-- Mobile card list -->
    <div v-else class="flex flex-col gap-2 md:hidden">
      <div
        v-for="expense in filteredExpenses"
        :key="expense.id"
        class="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 overflow-hidden cursor-pointer sm:cursor-default"
        @click="openEdit(expense)"
      >
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-muted/50 border border-border shadow-sm">
          <template v-if="expense.wallet">
            <img 
              :src="expense.wallet.icon_url || `/icons/wallets/${expense.wallet.type === 'metrobank' ? 'metrobank.jpg' : expense.wallet.type + '.png'}`" 
              class="w-full h-full object-contain rounded" 
              @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
            />
            <Wallet class="h-5 w-5 text-muted-foreground" style="display:none" />
          </template>
          <span v-else class="text-xl">📦</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-sm truncate">{{ expense.title }}</p>
          <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span
              v-if="expense.category"
              class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium border bg-muted/50 text-muted-foreground border-border"
            >
              {{ expense.category }}
            </span>
            <span v-if="expense.wallet" class="text-[10px] text-muted-foreground font-medium">{{ expense.wallet.name }}</span>
          </div>
          <p class="text-[11px] text-muted-foreground mt-0.5">{{ formatDateTime(expense.date, expense.created_at) }}</p>
        </div>
        <div class="shrink-0 text-right">
          <p class="font-bold text-sm text-destructive">-{{ formatCurrency(expense.amount) }}</p>
          <div class="hidden sm:flex gap-1 mt-1 justify-end" @click.stop>
            <button class="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors" @click="openEdit(expense)">
              <Pencil class="h-4 w-4 text-muted-foreground" />
            </button>
            <button class="h-8 w-8 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors" @click="remove(expense)">
              <Trash2 class="h-4 w-4 text-destructive" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop table -->
    <UiCard v-if="store.expenses.length > 0" class="overflow-hidden hidden md:block">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/40">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Wallet</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date &amp; Time</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
            <th class="px-4 py-3 w-20"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="expense in filteredExpenses"
            :key="expense.id"
            class="hover:bg-muted/30 transition-colors"
          >
            <td class="px-4 py-3 font-medium">
              <div class="flex items-center gap-2.5">
                <template v-if="expense.wallet">
                  <div class="w-8 h-8 flex items-center justify-center rounded-lg overflow-hidden bg-muted/50 border border-border shadow-sm">
                    <img 
                      :src="expense.wallet.icon_url || `/icons/wallets/${expense.wallet.type === 'metrobank' ? 'metrobank.jpg' : expense.wallet.type + '.png'}`" 
                      class="w-full h-full object-contain rounded" 
                      @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                    />
                    <Wallet class="h-4 w-4 text-muted-foreground" style="display:none" />
                  </div>
                </template>
                <span v-else class="text-xl w-8 h-8 flex items-center justify-center">📦</span>
                {{ expense.title }}
              </div>
            </td>
            <td class="px-4 py-3">
              <span v-if="expense.wallet" class="inline-flex items-center gap-2 text-sm">
                <div class="w-6 h-6 flex items-center justify-center rounded-md overflow-hidden bg-muted/50 border border-border">
                  <img 
                    :src="expense.wallet.icon_url || `/icons/wallets/${expense.wallet.type === 'metrobank' ? 'metrobank.jpg' : expense.wallet.type + '.png'}`" 
                    class="w-full h-full object-contain rounded" 
                    @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                  />
                  <Wallet class="h-3 w-3 text-muted-foreground" style="display:none" />
                </div>
                <span class="text-muted-foreground font-medium">{{ expense.wallet.name }}</span>
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-4 py-3">
              <span
                v-if="expense.category"
                class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-muted/50 text-muted-foreground border-border"
              >
                {{ expense.category }}
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-4 py-3 text-muted-foreground text-xs">{{ formatDateTime(expense.date, expense.created_at) }}</td>
            <td class="px-4 py-3 text-right font-semibold tabular-nums text-destructive">-{{ formatCurrency(expense.amount) }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-1">
                <UiButton variant="ghost" size="icon" class="h-8 w-8" @click="openEdit(expense)">
                  <Pencil class="h-4 w-4" />
                </UiButton>
                <UiButton variant="ghost" size="icon" class="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" @click="remove(expense)">
                  <Trash2 class="h-4 w-4" />
                </UiButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </UiCard>

    <!-- Form Modal -->
    <Teleport to="body">
      <div v-if="showForm" class="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4" @mousedown.self="showForm = false">
        <UiCard class="flex w-full max-w-none flex-col overflow-hidden bg-card shadow-2xl animate-in fade-in zoom-in duration-200
          max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-none max-sm:pt-[env(safe-area-inset-top)]
          sm:max-h-[90vh] sm:min-h-0 sm:max-w-lg sm:rounded-2xl" @mousedown.stop>
          
          <div class="shrink-0 p-6 border-b border-border bg-gradient-to-r from-destructive/10 to-transparent flex items-center justify-between">
            <h2 class="text-xl font-bold tracking-tight">{{ editingId ? 'Edit Expense' : 'New Expense' }}</h2>
            <UiButton variant="ghost" size="icon" @click="showForm = false" class="rounded-full h-8 w-8">
              <X class="h-4 w-4" />
            </UiButton>
          </div>

          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            <UiCardContent class="p-6">
              <form id="expense-form" @submit.prevent="submit" class="space-y-5">
                <div class="space-y-1.5">
                  <UiLabel>Title</UiLabel>
                  <UiInput v-model="form.title" placeholder="Groceries, Utilities…" required />
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5">
                    <UiLabel>Amount (₱)</UiLabel>
                    <UiInput v-model="form.amount" type="number" min="0" step="0.01" placeholder="0.00" required />
                  </div>
                  <div class="space-y-1.5">
                    <UiLabel>Date</UiLabel>
                    <DatePicker v-model="form.date" placeholder="Pick a date" />
                  </div>
                </div>

                <div class="space-y-1.5">
                  <UiLabel>Category</UiLabel>
                  <UiInput v-model="form.category" placeholder="Food, Transport…" />
                </div>

                <!-- Wallet Picker -->
                <div class="space-y-2">
                  <UiLabel>Pay from Wallet</UiLabel>
                  <div v-if="walletsStore.wallets.length === 0" class="text-sm text-muted-foreground rounded-xl border border-dashed p-4 text-center">
                    No wallets yet — add one in the <strong>Wallets</strong> tab.
                  </div>
                  <div v-else class="max-h-[160px] overflow-y-auto pr-1 py-1 -mr-1">
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        v-for="wallet in walletsStore.wallets"
                        :key="wallet.id"
                        type="button"
                        @click="form.wallet_id = wallet.id"
                        class="flex items-center gap-2.5 rounded-xl border-2 p-3 text-left transition-all duration-150"
                        :class="form.wallet_id === wallet.id
                          ? 'border-primary bg-primary/5 scale-[1.02]'
                          : 'border-border hover:border-muted-foreground/40'"
                      >
                        <div class="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-white/20">
                          <img 
                            :src="wallet.icon_url || `/icons/wallets/${wallet.type === 'metrobank' ? 'metrobank.jpg' : wallet.type + '.png'}`" 
                            class="w-full h-full object-contain rounded" 
                            @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                          />
                          <Wallet class="h-4 w-4 text-muted-foreground" style="display:none" />
                        </div>
                        <div class="min-w-0">
                          <p class="text-xs font-semibold truncate">{{ wallet.name }}</p>
                          <p class="text-[10px] text-muted-foreground">{{ formatCurrency(wallet.balance) }}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        @click="form.wallet_id = null"
                        class="flex items-center gap-2.5 rounded-xl border-2 p-3 text-left transition-all duration-150"
                        :class="form.wallet_id === null
                          ? 'border-primary bg-primary/5 scale-[1.02]'
                          : 'border-border hover:border-muted-foreground/40'"
                      >
                        <span class="text-xl leading-none">💰</span>
                        <div><p class="text-xs font-semibold">No wallet</p></div>
                      </button>
                    </div>
                  </div>
                </div>

                <p v-if="balanceError" class="text-sm text-destructive font-medium rounded-xl bg-destructive/10 px-3 py-2">
                  {{ balanceError }}
                </p>
              </form>
            </UiCardContent>
          </div>

          <div class="shrink-0 border-t border-border bg-muted/20 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-3 sm:flex-row-reverse">
            <UiButton type="submit" form="expense-form" :disabled="store.loading" class="rounded-xl h-11 px-8 bg-primary text-primary-foreground font-bold">
              {{ store.loading ? (editingId ? 'Saving…' : 'Adding…') : (editingId ? 'Save changes' : 'Add expense') }}
            </UiButton>
            <UiButton variant="outline" @click="showForm = false" class="rounded-xl h-11 px-6">
              Cancel
            </UiButton>
            <UiButton v-if="editingId" type="button" variant="destructive" @click="remove({ id: editingId, amount: form.amount, wallet_id: form.wallet_id }); showForm = false" class="rounded-xl h-11 px-4 sm:mr-auto">
              <Trash2 class="h-4 w-4 mr-2" /> Delete
            </UiButton>
          </div>
        </UiCard>
      </div>
    </Teleport>

    <!-- Month Picker Bottom Sheet -->
    <Teleport to="body">
      <div v-if="showMonthPicker" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm" @click.self="showMonthPicker = false">
        <div class="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-xl animate-slide-up">
          <div class="p-4 border-b border-border">
            <h3 class="text-lg font-semibold text-center">Select Month</h3>
          </div>
          <div class="max-h-[50vh] overflow-y-auto">
            <button
              v-for="(m, i) in months"
              :key="m"
              @click="selectedMonth = i + 1; showMonthPicker = false"
              class="w-full px-6 py-4 text-left transition-colors min-h-[44px] flex items-center"
              :class="selectedMonth === i + 1 ? 'bg-primary text-white font-semibold' : 'hover:bg-muted'"
            >
              {{ m }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Year Picker Bottom Sheet -->
    <Teleport to="body">
      <div v-if="showYearPicker" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm" @click.self="showYearPicker = false">
        <div class="w-full max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-xl animate-slide-up">
          <div class="p-4 border-b border-border">
            <h3 class="text-lg font-semibold text-center">Select Year</h3>
          </div>
          <div class="max-h-[50vh] overflow-y-auto">
            <button
              v-for="y in availableYears"
              :key="y"
              @click="selectedYear = y; showYearPicker = false"
              class="w-full px-6 py-4 text-left transition-colors min-h-[44px] flex items-center"
              :class="selectedYear === y ? 'bg-primary text-white font-semibold' : 'hover:bg-muted'"
            >
              {{ y }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
