<script setup>
defineOptions({ name: 'Expenses' })
import { ref, computed, watch, onMounted } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { useExpensesStore } from '@/stores/expenses.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { Plus, Pencil, Trash2, X, Receipt, Search, TrendingUp, Wallet, Calendar, ChevronDown, ArrowRightLeft, ArrowRight } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiCard from '@/components/ui/Card.vue'
import UiBadge from '@/components/ui/Badge.vue'
import DatePicker from '@/components/ui/DatePicker.vue'
import { SkeletonListItem, SkeletonTable } from '@/components/skeletons'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { shouldFetchFromServer } from '@/lib/syncEngine.js'
import { useModalsStore } from '@/stores/modals.js'
import { getWalletIconUrl } from '@/lib/walletIcons.js'
import ArchiveWarningBanner from '@/components/shared/ArchiveWarningBanner.vue'
import LoadMoreButton from '@/components/shared/LoadMoreButton.vue'
import EmptyFeedState from '@/components/shared/EmptyFeedState.vue'
import TransactionFilterSheet from '@/components/shared/TransactionFilterSheet.vue'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'
import TransactionDetailsModal from '@/components/modals/TransactionDetailsModal.vue'
import ExpenseIcon from '@/components/shared/ExpenseIcon.vue'

const store = useExpensesStore()
const dashboard = useDashboardStore()
const walletsStore = useWalletsStore()
const modals = useModalsStore()
const route = useRoute()
const router = useRouter()

const selectedMonth = ref(new Date().getMonth() + 1)
const selectedYear = ref(new Date().getFullYear())
const showMonthPicker = ref(false)
const showYearPicker = ref(false)
const showTransactionDetails = ref(false)
const selectedTransaction = ref(null)

onMounted(() => {
  dashboard.fetchStats({ month: selectedMonth.value, year: selectedYear.value })
  if (!walletsStore.fetched) walletsStore.fetchAll()
  if (route.query.action === 'add') {
    modals.openExpenseModal(null, route.query.wallet_id)
    router.replace({ query: { ...route.query, action: undefined, wallet_id: undefined } })
  }
})

watch([selectedMonth, selectedYear], () => {
  dashboard.fetchStats({ month: selectedMonth.value, year: selectedYear.value })
})

const showFilterSheet = ref(false)
const filterFrom = ref('')
const filterTo = ref('')

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const availableYears = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    years.push(y)
  }
  return years.sort((a, b) => b - a)
})

const hasActiveFilter = computed(() => !!store.filters.dateFrom || !!store.filters.dateTo)

const isArchiveRange = computed(() => {
  if (!store.filters.dateFrom) return false
  const limitDate = new Date()
  limitDate.setMonth(limitDate.getMonth() - 6)
  return new Date(store.filters.dateFrom) < limitDate
})

const total = computed(() => parseFloat(dashboard.stats.monthly_expenses || 0))
const search = ref('')
const debouncedSearch = refDebounced(search, 500)

// Spending power: wallet balances count as available funds (initial balance, not just deposits).
const monthlyIncome = computed(() => parseFloat(dashboard.stats.monthly_income ?? 0))
const fundsLeft = computed(() => parseFloat(walletsStore.totalBalance ?? 0))
const effectiveLimit = computed(() => {
  const spent = total.value
  const walletBasedBudget = fundsLeft.value + spent
  return Math.max(monthlyIncome.value, walletBasedBudget)
})

const remainingSalary = computed(() => fundsLeft.value)

const spendingPercentage = computed(() => {
  if (effectiveLimit.value <= 0) {
    return parseFloat(total.value) > 0 ? 100 : 0
  }
  return (parseFloat(total.value) / effectiveLimit.value) * 100
})

// Fetch feed on search changes (filters are applied explicitly)
watch(debouncedSearch, () => {
  store.fetchFeed({
    refresh: true,
    startDate: store.filters.dateFrom,
    endDate: store.filters.dateTo,
    search: debouncedSearch.value.trim() || undefined,
  })
}, { immediate: true })

// Display expenses combines the backend cursor feed items with any local/offline pending items
const displayExpenses = computed(() => {
  // Get pending items from store.expenses that are not already in store.feedItems
  const pending = store.expenses.filter(e => e._pending && !e.title?.toLowerCase().startsWith('debt repayment:'))
  const pendingIds = new Set(pending.map(p => String(p.id)))
  const feedIds = new Set(store.feedItems.map(f => String(f.id)))
  
  // Filter out any duplicates
  const filteredPending = pending.filter(p => !feedIds.has(String(p.id)))
  const filteredFeed = store.feedItems.filter(f => !pendingIds.has(String(f.id)))
  
  const list = [...filteredPending, ...filteredFeed]
  if (!hasActiveFilter.value) return list

  return list.slice().sort((a, b) => {
    const dA = (a.date || '').slice(0, 10)
    const dB = (b.date || '').slice(0, 10)
    if (dA !== dB) return dA.localeCompare(dB)
    return String(a.id).localeCompare(String(b.id))
  })
})

function isLendingExpense(expense) {
  if (!expense) return false
  const title = (expense.title || '').toLowerCase()
  const desc = (expense.description || '').toLowerCase()
  return title.includes('lent') || title.includes('lend') || desc.includes('lent') || desc.includes('lend')
}

function openCreate() {
  if (isArchiveRange.value) return
  modals.openExpenseModal()
}

function openEdit(expense) {
  if (isArchiveRange.value) return
  modals.openExpenseModal(expense.id)
}

function openTransaction(expense) {
  if (expense.type === 'transfer' || expense.type === 'deposit') {
    selectedTransaction.value = expense
    showTransactionDetails.value = true
  } else {
    openEdit(expense)
  }
}

async function remove(expense) {
  if (isArchiveRange.value) return
  await store.remove(expense.id)
  if (shouldFetchFromServer()) {
    dashboard.fetchStats({ month: selectedMonth.value, year: selectedYear.value })
  }
}

function openFilterSheet() {
  filterFrom.value = store.filters.dateFrom || ''
  filterTo.value = store.filters.dateTo || ''
  showFilterSheet.value = true
}

function applyFilters() {
  store.applyFilters(filterFrom.value, filterTo.value)
  showFilterSheet.value = false
  store.fetchFeed({
    refresh: true,
    startDate: store.filters.dateFrom,
    endDate: store.filters.dateTo,
    search: debouncedSearch.value.trim() || undefined,
  })
}

function clearFilters() {
  filterFrom.value = ''
  filterTo.value = ''
  store.clearFilters()
  showFilterSheet.value = false
  store.fetchFeed({
    refresh: true,
    search: debouncedSearch.value.trim() || undefined,
  })
}

function changeTab(tabId) {
  store.applyFilters(store.filters.dateFrom, store.filters.dateTo, tabId)
  store.fetchFeed({
    refresh: true,
    startDate: store.filters.dateFrom,
    endDate: store.filters.dateTo,
    search: debouncedSearch.value.trim() || undefined,
  })
}

function loadMoreFeed() {
  store.fetchFeed({
    refresh: false,
    startDate: store.filters.dateFrom,
    endDate: store.filters.dateTo,
    search: debouncedSearch.value.trim() || undefined,
  })
}
</script>

<template>
  <div class="px-3 py-4 md:p-6 max-w-6xl mx-auto animate-fade-in">
    <div class="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div class="space-y-1">
        <h1 class="text-2xl font-medium tracking-tight text-foreground">Expenses</h1>
      </div>
      <div class="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto overflow-hidden">
        <div class="bg-card border border-border shadow-sm px-4 py-2 rounded-2xl flex flex-col items-start sm:items-end min-w-[140px] transition-all hover:shadow-md">
          <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Expenses</span>
          <span v-if="dashboard.loading" class="text-base sm:text-xl font-black text-muted-foreground animate-pulse">...</span>
          <span v-else class="tabular-nums sensitive-stat"><CurrencyAmount :amount="total" type="balance" size="lg" /></span>
        </div>

        <!-- Month / Year selector (summary stats only) -->
        <div class="flex items-center gap-1 sm:gap-2 bg-card border border-border shadow-sm rounded-2xl px-1 py-1 shrink-0">
          <button
            type="button"
            @click="showMonthPicker = true"
            class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors min-h-[40px] sm:min-h-[44px]"
          >
            <Calendar class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
            <span class="text-xs sm:text-sm font-semibold">{{ months[selectedMonth - 1] }}</span>
            <ChevronDown class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            @click="showYearPicker = true"
            class="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors min-h-[40px] sm:min-h-[44px]"
          >
            <span class="text-xs sm:text-sm font-semibold">{{ selectedYear }}</span>
            <ChevronDown class="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </button>
        </div>

        <UiButton @click="openCreate" class="hidden sm:flex shrink-0 h-10 px-5 rounded-[50px] font-semibold bg-primary text-white hover:bg-primary/90 shadow-sm" size="sm" :disabled="isArchiveRange">
          Add Expense
        </UiButton>
      </div>
    </div>

    <!-- Salary / Budget Tracking Card -->
    <div v-if="!isArchiveRange" class="mb-4 overflow-hidden border border-primary/10 shadow-sm rounded-2xl bg-gradient-to-br from-card to-muted/20">
      <div class="p-4 sm:p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2 min-w-0">
            <div class="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp class="h-4 w-4 text-primary" />
            </div>
            <h3 class="text-sm font-bold truncate">Spending Power ({{ months[selectedMonth - 1] }})</h3>
          </div>
          <p v-if="dashboard.loading" class="text-xs font-bold text-muted-foreground animate-pulse shrink-0 ml-2">
            ...
          </p>
          <p v-else class="shrink-0 ml-2 flex items-baseline" :class="remainingSalary < 0 ? 'text-destructive' : 'text-emerald-600'">
            <CurrencyAmount size="sm" :amount="Math.abs(remainingSalary)" :type="remainingSalary < 0 ? 'expense' : 'income'" class="sensitive-stat" /> 
            <span class="uppercase tracking-wider ml-1 text-[10px] font-bold">{{ remainingSalary < 0 ? 'over budget' : 'left' }}</span>
          </p>
        </div>
        
        <div class="space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Spent:</span>
              <span v-if="dashboard.loading" class="animate-pulse text-[13px] font-bold">...</span>
              <CurrencyAmount v-else size="xs" :amount="total" type="muted" class="sensitive-stat text-foreground" />
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Budget:</span>
              <span v-if="dashboard.loading" class="animate-pulse text-[13px] font-bold">...</span>
              <CurrencyAmount v-else size="xs" :amount="effectiveLimit" type="muted" class="sensitive-stat text-foreground" />
            </div>
          </div>
          <div class="h-2 w-full bg-muted rounded-full overflow-hidden flex">
             <div 
               class="h-full transition-all duration-700 ease-out" 
               :style="{ width: `${dashboard.loading ? 0 : Math.min(spendingPercentage, 100)}%` }"
               :class="spendingPercentage > 100 ? 'bg-destructive' : spendingPercentage > 90 ? 'bg-destructive' : spendingPercentage > 75 ? 'bg-amber-500' : 'bg-emerald-500'"
             />
          </div>
          <div class="flex justify-between items-center">
            <p class="text-[10px] text-muted-foreground italic">
               <span v-if="dashboard.loading" class="animate-pulse">Calculating remaining budget...</span>
               <span v-else>{{ spendingPercentage > 100 ? "You've exceeded your limit!" : `${(100 - spendingPercentage).toFixed(0)}% of budget remaining` }}</span>
            </p>
            <span v-if="dashboard.loading" class="text-[10px] font-black text-muted-foreground animate-pulse">...</span>
            <span v-else class="text-[10px] font-black" :class="spendingPercentage > 100 ? 'text-destructive' : spendingPercentage > 90 ? 'text-destructive' : 'text-emerald-600'">
              {{ spendingPercentage.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="mb-5 flex overflow-x-auto hide-scrollbar md:justify-center">
      <div class="flex items-center gap-2 px-1 w-max pb-1">
        <button
          v-for="tab in [
            { id: 'all', label: 'All' },
            { id: 'expense', label: 'Expenses' },
            { id: 'transfer', label: 'Transfer' },
            { id: 'deposit', label: 'Deposit' }
          ]"
          :key="tab.id"
          @click="changeTab(tab.id)"
          :class="[
            'h-9 px-4 flex items-center justify-center text-[13px] font-bold rounded-full transition-all border shadow-sm',
            store.filters.type === tab.id 
              ? 'bg-primary border-primary text-primary-foreground' 
              : 'bg-card border-border text-slate-800 hover:text-slate-900 hover:bg-muted dark:text-slate-200 dark:hover:bg-slate-800'
          ]"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Search bar & feed date filter -->
    <div class="mb-5 flex flex-col gap-2.5">
      <div class="flex items-center gap-2">
        <div class="relative flex-1 min-w-0">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
          <UiInput v-model="search" placeholder="Search expenses…" class="pl-11 h-12 bg-card border-border shadow-sm rounded-2xl text-[15px]" />
        </div>
        <button
          type="button"
          class="relative h-12 w-12 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-center transition-colors hover:bg-muted shrink-0"
          @click="openFilterSheet"
          aria-label="Filter expense log by date"
        >
          <svg
            viewBox="0 0 24 24"
            class="h-5 w-5"
            :class="hasActiveFilter ? 'text-primary' : 'text-muted-foreground'"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 4h18l-7 8v5l-4 3v-8L3 4z" />
          </svg>
          <span
            v-if="hasActiveFilter"
            class="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary"
          ></span>
        </button>
      </div>
      <ArchiveWarningBanner :show="isArchiveRange" class="w-fit" />
    </div>

    <!-- Feed date range filter sheet -->
    <TransactionFilterSheet 
      v-model:show="showFilterSheet" 
      v-model:date-from="filterFrom" 
      v-model:date-to="filterTo"
      title="Filter log"
      description="Date range applies to the expense log below only. Total Expenses, Spending Power, and the budget bar use the month and year selectors above."
      info-text="Log entries show oldest → newest within this range."
      @apply="applyFilters"
      @clear="clearFilters"
    />

    <!-- Skeletons -->
    <template v-if="store.feedLoading && displayExpenses.length === 0">
      <!-- Mobile Skeletons -->
      <div class="flex flex-col gap-2 md:hidden">
        <SkeletonListItem v-for="i in 5" :key="i" />
      </div>
      <!-- Desktop Skeletons -->
      <div class="hidden md:block">
        <SkeletonTable :rows="5" :columns="5" />
      </div>
    </template>

    <!-- No Data State -->
    <EmptyFeedState 
      v-else-if="displayExpenses.length === 0" 
      :icon="Receipt" 
      title="No expenses found for the selected range" 
      description="Try selecting a different range or add a new expense" 
      dashed 
    />

    <!-- Mobile/Tablet card list -->
    <div v-else class="flex flex-col gap-1.5 xl:hidden p-0.5">
      <div
        v-for="expense in displayExpenses"
        :key="`${expense.type || 'expense'}-${expense.id}`"
        class="flex items-center gap-3 p-3 bg-card hover:bg-muted/30 transition-all border border-border shadow-sm rounded-2xl cursor-pointer min-h-[44px] active:scale-[0.99]"
        @click="openTransaction(expense)"
      >
        <template v-if="expense.type === 'transfer'">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/50 border border-border shadow-sm">
            <ArrowRightLeft class="h-5 w-5 text-muted-foreground" />
          </div>
        </template>
        <template v-else-if="expense.type === 'deposit'">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/50 border border-border shadow-sm">
             <TrendingUp class="h-5 w-5 text-emerald-600" />
          </div>
        </template>
        <template v-else-if="isLendingExpense(expense)">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-muted/50 border border-border shadow-sm">
            <img 
              src="/icons/wallets/lending.png" 
              class="w-full h-full object-contain rounded dark:invert" 
            />
          </div>
        </template>
        <template v-else>
          <ExpenseIcon :title="expense.title" size="md" />
        </template>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="font-bold text-[13px] leading-tight truncate" :class="{ 'line-through text-muted-foreground/70': expense.is_settled }">
              <template v-if="expense.type === 'transfer'">
                Transfer
              </template>
              <template v-else>
                {{ expense.title }}
              </template>
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
            <template v-if="expense.type === 'transfer'">
               <span class="text-[10px] text-muted-foreground font-medium">{{ expense.wallet?.name }}</span>
               <ArrowRight class="h-3 w-3 text-muted-foreground" />
               <span class="text-[10px] text-muted-foreground font-medium">{{ expense.to_wallet?.name }}</span>
            </template>
          </div>
          <p class="text-[11px] text-muted-foreground mt-0.5">{{ formatDateTime(expense.date, expense.created_at) }}</p>
        </div>
        <div class="shrink-0 text-right">
          <CurrencyAmount
            :amount="expense.type === 'deposit' ? parseFloat(expense.amount) : -parseFloat(expense.amount)"
            :type="expense.type === 'transfer' ? 'muted' : 'auto'"
            :prefix="expense.type === 'deposit' ? '+' : (expense.type === 'transfer' ? '' : '-')"
            :strikethrough="expense.is_settled"
            size="sm"
            class="font-black tabular-nums shrink-0"
          />
          <span v-if="expense.type !== 'transfer' && expense.wallet" class="text-[10px] font-semibold text-muted-foreground/60 mt-0.5 block">
            via {{ expense.wallet.name }}
          </span>
          <div v-if="expense.is_settled" class="mt-1 flex justify-end">
            <UiBadge variant="outline" class="text-[9px] uppercase tracking-wider py-0 px-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600">PAID</UiBadge>
          </div>
          <div v-else-if="parseFloat(expense.settled_amount || 0) > 0" class="mt-1 flex justify-end">
            <UiBadge variant="outline" class="text-[9px] uppercase tracking-wider py-0 px-1 border-amber-500/30 bg-amber-500/10 text-amber-600">PARTIAL +<span class="font-bold">{{ formatCurrency(expense.settled_amount).replace(/^[₱\s\xa0]+/g, '') }}</span></UiBadge>
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop table -->
    <UiCard v-if="displayExpenses.length > 0" class="overflow-hidden hidden xl:block">
      <table class="w-full text-sm">
        <thead class="border-b bg-muted/40">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Wallet</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date &amp; Time</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
            <th class="px-4 py-3 w-20" v-if="!isArchiveRange"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr 
            v-for="expense in displayExpenses" 
            :key="`${expense.type || 'expense'}-${expense.id}`" 
            class="hover:bg-muted/30 transition-colors cursor-pointer"
            @click="openTransaction(expense)"
          >
            <td class="px-4 py-3 font-medium">
              <div class="flex items-center gap-2.5">
                <template v-if="expense.type === 'transfer'">
                  <div class="w-8 h-8 flex items-center justify-center rounded-lg overflow-hidden bg-muted/50 border border-border shadow-sm">
                    <ArrowRightLeft class="h-4 w-4 text-muted-foreground" />
                  </div>
                </template>
                <template v-else-if="expense.type === 'deposit'">
                  <div class="w-8 h-8 flex items-center justify-center rounded-lg overflow-hidden bg-muted/50 border border-border shadow-sm">
                    <TrendingUp class="h-4 w-4 text-emerald-600" />
                  </div>
                </template>
                <template v-else-if="isLendingExpense(expense)">
                  <div class="w-8 h-8 flex items-center justify-center rounded-lg overflow-hidden bg-muted/50 border border-border shadow-sm">
                    <img 
                      src="/icons/wallets/lending.png" 
                      class="w-full h-full object-contain rounded dark:invert" 
                    />
                  </div>
                </template>
                <template v-else>
                  <ExpenseIcon :title="expense.title" size="sm" />
                </template>
                <span :class="{ 'line-through text-muted-foreground/70': expense.is_settled }">
                  <template v-if="expense.type === 'transfer'">
                    Transfer
                  </template>
                  <template v-else>
                    {{ expense.title }}
                  </template>
                </span>
                <UiBadge v-if="expense.is_settled" variant="outline" class="shrink-0 ml-1.5 text-[9px] uppercase tracking-wider py-0 px-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600">PAID</UiBadge>
                <UiBadge v-else-if="parseFloat(expense.settled_amount || 0) > 0" variant="outline" class="shrink-0 ml-1.5 text-[9px] uppercase tracking-wider py-0 px-1 border-amber-500/30 bg-amber-500/10 text-amber-600">PARTIAL +<span class="font-bold">{{ formatCurrency(expense.settled_amount).replace(/^[₱\s\xa0]+/g, '') }}</span></UiBadge>
              </div>
            </td>
            <td class="px-4 py-3">
              <span v-if="expense.type === 'transfer'" class="inline-flex items-center gap-2 text-sm">
                 <span class="text-muted-foreground">{{ expense.wallet?.name }}</span>
                 <ArrowRight class="h-3 w-3 text-muted-foreground" />
                 <span class="text-muted-foreground">{{ expense.to_wallet?.name }}</span>
              </span>
              <span v-else-if="expense.wallet" class="inline-flex items-center gap-2 text-sm">
                <div class="w-6 h-6 flex items-center justify-center rounded-md overflow-hidden bg-muted/50 border border-border">
                  <img 
                    :src="getWalletIconUrl(expense.wallet)" 
                    class="w-full h-full object-contain rounded" 
                    @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                  />
                  <Wallet class="h-3 w-3 text-muted-foreground" style="display:none" />
                </div>
                <span class="text-muted-foreground font-medium">{{ expense.wallet.name }}</span>
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-4 py-3 text-muted-foreground text-xs">{{ formatDateTime(expense.date, expense.created_at) }}</td>
            <td class="px-4 py-3 text-right tabular-nums">
              <CurrencyAmount
                :amount="expense.type === 'deposit' ? parseFloat(expense.amount) : -parseFloat(expense.amount)"
                :type="expense.type === 'transfer' ? 'muted' : 'auto'"
                :prefix="expense.type === 'deposit' ? '+' : (expense.type === 'transfer' ? '' : '-')"
                :strikethrough="expense.is_settled"
                size="sm"
                class="font-black"
              />
            </td>
            <td class="px-4 py-3" v-if="!isArchiveRange">
              <div class="flex justify-end gap-1" @click.stop>
                <UiButton variant="ghost" size="icon" class="h-8 w-8" @click="openEdit(expense)" :disabled="expense.type === 'transfer' || expense.type === 'deposit'">
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

    <!-- Load More Control -->
    <LoadMoreButton :is-loading="store.feedLoading" :has-more="store.feedHasMore" @load-more="loadMoreFeed" />

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
              type="button"
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
        <div class="w-full max-w-sm bg-card rounded-t-2xl sm:rounded-2xl shadow-xl animate-slide-up">
          <div class="p-4 border-b border-border">
            <h3 class="text-lg font-semibold text-center">Select Year</h3>
          </div>
          <div class="max-h-[50vh] overflow-y-auto">
            <button
              v-for="year in availableYears"
              :key="year"
              type="button"
              @click="selectedYear = year; showYearPicker = false"
              class="w-full px-6 py-4 text-left transition-colors min-h-[44px] flex items-center"
              :class="selectedYear === year ? 'bg-primary text-white font-semibold' : 'hover:bg-muted'"
            >
              {{ year }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Transaction Details Modal -->
    <TransactionDetailsModal 
      :show="showTransactionDetails" 
      :transaction="selectedTransaction" 
      @close="showTransactionDetails = false"
      @edit="showTransactionDetails = false; openEdit(selectedTransaction)"
      @delete="showTransactionDetails = false; remove(selectedTransaction)"
    />
  </div>
</template>
