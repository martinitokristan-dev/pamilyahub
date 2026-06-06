<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { useDebtsStore } from '@/stores/debts.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useSalaryStore } from '@/stores/salary.js'
import { Plus, Pencil, Trash2, X, BadgeCheck, HandCoins, Search, Wallet, CheckCircle2 } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiTextarea from '@/components/ui/Textarea.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import UiBadge from '@/components/ui/Badge.vue'
import DatePicker from '@/components/ui/DatePicker.vue'
import { SkeletonListItem } from '@/components/skeletons'
import { formatCurrency, parseCurrency } from '@/utils/format'
import { shouldFetchFromServer } from '@/lib/syncEngine.js'
import { useModalsStore } from '@/stores/modals.js'
import { getWalletIconUrl } from '@/lib/walletIcons.js'
import ArchiveWarningBanner from '@/components/shared/ArchiveWarningBanner.vue'
import LoadMoreButton from '@/components/shared/LoadMoreButton.vue'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'
import EmptyFeedState from '@/components/shared/EmptyFeedState.vue'
import TransactionFilterSheet from '@/components/shared/TransactionFilterSheet.vue'
import ExpenseIcon from '@/components/shared/ExpenseIcon.vue'

const store = useDebtsStore()
const walletsStore = useWalletsStore()
const dashboardStore = useDashboardStore()
const expensesStore = useExpensesStore()
const salaryStore = useSalaryStore()
const modals = useModalsStore()
const route = useRoute()
const router = useRouter()

const activeTab = ref('all')
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, 500)

const showFilterSheet = ref(false)
const filterFrom = ref('')
const filterTo = ref('')
const hasActiveFilter = computed(() => !!store.filters.dateFrom || !!store.filters.dateTo)

const isArchiveRange = computed(() => {
  if (!store.filters.dateFrom) return false
  const limitDate = new Date()
  limitDate.setMonth(limitDate.getMonth() - 6)
  return new Date(store.filters.dateFrom) < limitDate
})

onMounted(() => {
  dashboardStore.fetchStats()
  
  if (route.query.action === 'add') {
    openCreate()
    router.replace({ query: { ...route.query, action: undefined } })
  }
})

watch([debouncedSearch, activeTab], () => {
  store.fetchFeed({
    refresh: true,
    startDate: store.filters.dateFrom,
    endDate: store.filters.dateTo,
    search: debouncedSearch.value.trim() || undefined,
    type: activeTab.value !== 'all' ? activeTab.value : undefined
  })
}, { immediate: true })

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
    type: activeTab.value !== 'all' ? activeTab.value : undefined
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
    type: activeTab.value !== 'all' ? activeTab.value : undefined
  })
}

function loadMoreFeed() {
  store.fetchFeed({
    refresh: false,
    startDate: store.filters.dateFrom,
    endDate: store.filters.dateTo,
    search: debouncedSearch.value.trim() || undefined,
    type: activeTab.value !== 'all' ? activeTab.value : undefined
  })
}

// Display debts combines the backend cursor feed items with any local/offline pending items
const displayDebts = computed(() => {
  // Get pending items from store.debts that are not already in store.feedItems
  let pending = store.debts.filter(d => d._pending)
  
  if (activeTab.value !== 'all') {
    pending = pending.filter(d => d.type === activeTab.value)
  }
  if (debouncedSearch.value) {
    const s = debouncedSearch.value.toLowerCase()
    pending = pending.filter(d => (d.name || '').toLowerCase().includes(s) || (d.notes || '').toLowerCase().includes(s))
  }
  
  const pendingIds = new Set(pending.map(p => String(p.id)))
  const feedIds = new Set(store.feedItems.map(f => String(f.id)))
  
  // Filter out any duplicates
  const filteredPending = pending.filter(p => !feedIds.has(String(p.id)))
  const filteredFeed = store.feedItems.filter(f => !pendingIds.has(String(f.id)))
  
  const list = [...filteredPending, ...filteredFeed]
  if (!hasActiveFilter.value) return list

  return list.slice().sort((a, b) => {
    const dA = (a.created_at || a.due_date || '').slice(0, 19)
    const dB = (b.created_at || b.due_date || '').slice(0, 19)
    if (dA !== dB) return dA.localeCompare(dB)
    return String(a.id).localeCompare(String(b.id))
  })
})

// Pay modal state
const showPayModal = ref(false)
const payingDebt = ref(null)
const payWalletId = ref(null)
const payBalanceError = ref('')
const payMode = ref('full') // 'full' or 'partial'
const partialAmount = ref('')
const balanceError = ref('')

function openCreate() {
  if (isArchiveRange.value) return
  modals.openDebtModal()
}

function openEdit(debt) {
  if (isArchiveRange.value) return
  modals.openDebtModal(debt.id)
}

function openPayModal(debt) {
  payingDebt.value = debt
  payWalletId.value = walletsStore.wallets[0]?.id ?? null
  payBalanceError.value = ''
  payMode.value = 'full'
  partialAmount.value = ''
  showPayModal.value = true
}

const effectivePayAmount = computed(() => {
  if (!payingDebt.value) return 0
  if (payMode.value === 'full') return parseFloat(payingDebt.value.amount)
  return parseCurrency(partialAmount.value) || 0
})

const partialAmountError = computed(() => {
  if (payMode.value !== 'partial') return ''
  const amt = parseCurrency(partialAmount.value) || 0
  const total = parseFloat(payingDebt.value?.amount ?? 0)
  if (amt <= 0) return 'Enter a valid amount'
  if (amt >= total) return 'Amount must be less than the total. Use "Pay Full" instead.'
  return ''
})

async function confirmPay() {
  payBalanceError.value = ''
  const debt = payingDebt.value
  if (!debt) return

  if (payMode.value === 'partial' && partialAmountError.value) return

  const payAmount = effectivePayAmount.value

  // Balance validation for i_owe (you are paying out)
  if (debt.type === 'i_owe' && payWalletId.value) {
    const wallet = walletsStore.wallets.find(w => w.id === payWalletId.value)
    if (wallet && payAmount > parseFloat(wallet.balance)) {
      payBalanceError.value = `Insufficient balance. ${wallet.name} only has ${formatCurrency(wallet.balance)}.`
      return
    }
  }

  if (payMode.value === 'full') {
    // Full payment — mark as paid
    await store.markPaid(debt.id, payWalletId.value)
  } else {
    // Partial payment — reduce the amount via backend
    await store.partialPay(debt.id, payAmount, payWalletId.value)
  }

  showPayModal.value = false
  payingDebt.value = null
  
  if (shouldFetchFromServer()) {
    Promise.all([
      dashboardStore.fetchStats(),
      expensesStore.fetchAll(),
      salaryStore.fetchCurrentMonth()
    ])
  }
}

function formatDueDate(str) {
  if (!str) return ''
  // Handle both YYYY-MM-DD and full ISO strings
  const d = new Date(str.includes('T') ? str : str + 'T00:00:00')
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const totalBalance = computed(() => {
  return (dashboardStore.stats.debts_owed_to_me - dashboardStore.stats.debts_i_owe).toFixed(2)
})

async function remove(debt) {
  if (isArchiveRange.value) return
  await store.remove(debt.id)
  if (shouldFetchFromServer()) {
    dashboardStore.fetchStats()
  }
}


</script>

<template>
  <div class="p-6 max-w-4xl mx-auto animate-fade-in">
    <div class="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-medium tracking-tight text-foreground">Debts</h1>
      </div>
      <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <div class="bg-card border border-border shadow-sm px-4 py-2 rounded-2xl flex flex-col items-start sm:items-end min-w-[140px] transition-all hover:shadow-md">
          <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Net Balance</span>
          <CurrencyAmount :amount="totalBalance" type="balance" size="lg" class="tabular-nums sensitive-balance" />
        </div>
        <UiButton @click="openCreate" class="hidden sm:flex shrink-0 h-10 px-5 rounded-[50px] font-semibold bg-primary text-white hover:bg-primary/90 shadow-sm" size="sm" :disabled="isArchiveRange">
          Add Debt
        </UiButton>
      </div>
    </div>

    <div class="mb-3 flex flex-wrap gap-2">
      <UiButton
        v-for="tab in [{ key: 'all', label: 'All' }, { key: 'owed_to_me', label: 'Owed to Me' }, { key: 'i_owe', label: 'I Owe' }]"
        :key="tab.key"
        :variant="activeTab === tab.key ? 'default' : 'outline'"
        size="sm"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </UiButton>
    </div>

    <div class="mb-5 flex flex-col gap-2.5 bg-muted/30 p-3 rounded-2xl border border-border/50">
      <div class="flex items-center gap-2">
        <div class="relative flex-1 min-w-0">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <UiInput v-model="searchQuery" class="pl-9 bg-background" placeholder="Search by name or notes…" />
        </div>
        <button
          type="button"
          class="relative h-12 w-12 rounded-2xl border border-border bg-card shadow-sm flex items-center justify-center transition-colors hover:bg-muted/40 shrink-0"
          @click="openFilterSheet"
          aria-label="Filter debt log by date"
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
      description="Date range applies to the debt log below only. Net Balance at the top is not affected."
      info-text="Log entries show oldest → newest within this range."
      @apply="applyFilters"
      @clear="clearFilters"
    />


    <div v-if="store.feedLoading && displayDebts.length === 0" class="space-y-2">
      <SkeletonListItem v-for="i in 4" :key="i" :show-icon="false" />
    </div>

    <EmptyFeedState 
      v-else-if="displayDebts.length === 0" 
      :icon="HandCoins" 
      title="No debts recorded." 
      dashed 
    />

    <div v-else class="space-y-2">
      <UiCard
        v-for="debt in displayDebts"
        :key="debt._clientKey || debt.id"
        class="px-4 py-3 transition-all duration-200"
        :class="isArchiveRange ? 'opacity-80' : 'cursor-pointer sm:cursor-default'"
        @click="!isArchiveRange && openEdit(debt)"
      >
        <div class="flex items-start gap-3">
          <ExpenseIcon :title="debt.name" size="lg" class="mt-0.5" />
          
          <div class="flex-1 min-w-0">
            <!-- Row 1: name + type + amount -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                <div class="flex items-center gap-2 text-sm leading-snug truncate">
                  <span class="font-bold uppercase">{{ debt.name }}</span>
                  <span class="text-foreground font-black">·</span>
                  <span class="text-xs font-black uppercase" :class="debt.type === 'owed_to_me' ? 'text-emerald-600' : 'text-amber-600'">
                    {{ debt.type === 'owed_to_me' ? 'Owes me' : 'I owe' }}
                  </span>
                </div>
              </div>
              
              <div class="flex flex-col items-end gap-1 shrink-0">
                  <template v-if="debt.type === 'owed_to_me'">
                    <CurrencyAmount :amount="debt.amount" :type="debt.is_paid ? 'muted' : 'income'" :prefix="debt.is_paid ? '+' : ''" size="md" class="tabular-nums" />
                  </template>
                  <template v-else>
                    <CurrencyAmount :amount="debt.amount" :type="debt.is_paid ? 'muted' : 'debt'" :prefix="debt.is_paid ? '' : '-'" size="md" class="tabular-nums" />
                  </template>
                <span v-if="debt.is_paid" class="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-500/20">
                  <CheckCircle2 class="h-2.5 w-2.5" />
                  Paid
                </span>
              </div>
            </div>

            <!-- Row 2: due date + actions -->
            <div class="flex items-center justify-between gap-2 mt-2">
              <p v-if="debt.due_date" class="text-xs text-muted-foreground shrink-0">
                Due {{ formatDueDate(debt.due_date) }}
              </p>
              <div v-else></div> <!-- Spacer if no due date -->

              <!-- Action buttons -->
              <div v-if="!isArchiveRange" class="flex items-center gap-0.5 shrink-0" @click.stop>
                <UiButton
                  v-if="!debt.is_paid"
                  variant="outline" size="sm" class="h-8 px-3 text-emerald-600 border-emerald-200 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/60 dark:hover:bg-emerald-900/30 font-semibold shadow-sm"
                  title="Mark as paid"
                  @click="openPayModal(debt)"
                >
                  Mark as Paid
                </UiButton>
                <UiButton variant="ghost" size="icon" class="h-8 w-8 hidden xl:flex" @click="openEdit(debt)">
                  <Pencil class="h-4 w-4" />
                </UiButton>
                <UiButton variant="ghost" size="icon" class="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 hidden xl:flex" @click="remove(debt)">
                  <Trash2 class="h-4 w-4" />
                </UiButton>
              </div>
            </div>
          </div>
        </div>
      </UiCard>
    </div>

    <!-- Load More Control -->
    <LoadMoreButton :is-loading="store.feedLoading" :has-more="store.feedHasMore" @load-more="loadMoreFeed" />

    <!-- Pay with wallet modal — now with Full/Partial tabs -->
    <Teleport to="body">
      <div v-if="showPayModal" class="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4" @mousedown.self="showPayModal = false">
        <UiCard class="flex w-full max-w-none flex-col overflow-hidden bg-card shadow-2xl animate-in fade-in zoom-in duration-200
          max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-none max-sm:pt-[env(safe-area-inset-top)]
          sm:max-h-[90vh] sm:min-h-0 sm:max-w-md sm:rounded-2xl" @mousedown.stop>
          
          <div class="shrink-0 p-6 border-b border-border bg-gradient-to-r from-emerald-600/10 to-transparent flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold tracking-tight">Mark as Paid</h2>
              <p class="text-xs text-muted-foreground mt-0.5">
                <span class="font-semibold text-foreground">{{ payingDebt?.name }}</span>
                <span class="mx-1">·</span>
                <CurrencyAmount :amount="payingDebt?.amount ?? 0" type="neutral" size="md" class="font-semibold text-foreground" />
              </p>
            </div>
            <UiButton variant="ghost" size="icon" @click="showPayModal = false" class="rounded-full h-8 w-8">
              <X class="h-4 w-4" />
            </UiButton>
          </div>

          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            <UiCardContent class="p-6 space-y-4">
              <!-- Full / Partial toggle -->
              <div class="flex gap-2 p-1 bg-muted rounded-xl">
                <button
                  type="button"
                  @click="payMode = 'full'"
                  class="flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200"
                  :class="payMode === 'full' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                >
                  Pay Full
                </button>
                <button
                  type="button"
                  @click="payMode = 'partial'"
                  class="flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200"
                  :class="payMode === 'partial' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                >
                  Pay Partial
                </button>
              </div>

              <!-- Partial amount input -->
              <div v-if="payMode === 'partial'" class="space-y-1.5">
                <UiLabel>Amount to pay (₱)</UiLabel>
                <UiInput
                  v-model="partialAmount"
                  type="number"
                  min="1"
                  :max="parseFloat(payingDebt?.amount ?? 0) - 0.01"
                  step="0.01"
                  placeholder="0.00"
                  class="h-12 text-lg font-bold tabular-nums"
                />
                <p v-if="partialAmountError" class="text-xs text-destructive mt-1">{{ partialAmountError }}</p>
                <p v-else-if="partialAmount && !partialAmountError" class="text-xs text-muted-foreground mt-1">
                  Remaining after payment: <CurrencyAmount :amount="parseFloat(payingDebt?.amount ?? 0) - (parseFloat(partialAmount) || 0)" type="neutral" size="md" class="font-semibold text-foreground" />
                </p>
              </div>

              <!-- Full pay info -->
              <div v-if="payMode === 'full'" class="rounded-2xl border-2 border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total to Pay</p>
                <CurrencyAmount :amount="payingDebt?.amount ?? 0" type="income" size="lg" class="font-black" />
                <p class="text-[10px] text-muted-foreground mt-1 font-medium italic">This will mark the debt as fully paid</p>
              </div>

              <!-- Wallet picker -->
              <div class="space-y-2">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                  {{ payingDebt?.type === 'i_owe' ? 'Pay from wallet' : 'Receive to wallet' }}
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
                      <p class="text-sm font-bold">No wallet (cash / external)</p>
                    </button>
                  </div>
                </div>
              </div>

              <p v-if="payBalanceError" class="text-sm text-destructive font-medium rounded-xl bg-destructive/10 px-3 py-2">
                {{ payBalanceError }}
              </p>
            </UiCardContent>
          </div>

          <div class="shrink-0 border-t border-border bg-muted/20 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-3 sm:flex-row-reverse">
            <UiButton
              @click="confirmPay"
              :disabled="store.loading || (payMode === 'partial' && !!partialAmountError)"
              size="lg"
              class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {{ store.loading ? 'Paying…' : (payMode === 'full' ? 'Confirm paid' : `Pay ${formatCurrency(effectivePayAmount)}`) }}
            </UiButton>
            <UiButton variant="secondary" @click="showPayModal = false" size="lg">
              Cancel
            </UiButton>
          </div>
        </UiCard>
      </div>
    </Teleport>
  </div>
</template>
