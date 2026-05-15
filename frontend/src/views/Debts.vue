<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useDebtsStore } from '@/stores/debts.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useSalaryStore } from '@/stores/salary.js'
import { Plus, Pencil, Trash2, X, BadgeCheck, HandCoins, Search, Wallet, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-vue-next'
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

const store = useDebtsStore()
const walletsStore = useWalletsStore()
const dashboardStore = useDashboardStore()
const expensesStore = useExpensesStore()
const salaryStore = useSalaryStore()
useRegisterAddAction(openCreate)

const activeTab = ref('all')
const searchQuery = ref('')
const currentPage = ref(1)
const debouncedSearch = refDebounced(searchQuery, 500)

// Reset to page 1 logic moved to combined watch below

watch([activeTab, currentPage, debouncedSearch], () => {
  const filters = {
    ...(activeTab.value !== 'all' ? { type: activeTab.value } : {}),
    ...(debouncedSearch.value.trim() ? { search: debouncedSearch.value.trim() } : {})
  }
  store.fetchAll(false, currentPage.value, 20, filters)
  dashboardStore.fetchStats()
})

// Reset to page 1 when search or tab changes
watch([activeTab, searchQuery], () => {
  currentPage.value = 1
})

onMounted(() => {
  const filters = activeTab.value === 'all' ? {} : { type: activeTab.value }
  // Use false for force parameter to enable caching
  store.fetchAll(false, currentPage.value, 20, filters)
  dashboardStore.fetchStats()
})
const showForm = ref(false)
const editingId = ref(null)
const form = ref({ name: '', amount: '', type: 'owed_to_me', description: '', due_date: '', wallet_id: null })

// Pay modal state
const showPayModal = ref(false)
const payingDebt = ref(null)
const payWalletId = ref(null)
const payBalanceError = ref('')
const payMode = ref('full') // 'full' or 'partial'
const partialAmount = ref('')
const balanceError = ref('')

function openCreate() {
  editingId.value = null
  const defaultType = activeTab.value === 'i_owe' ? 'i_owe' : 'owed_to_me'
  form.value = { name: '', amount: '', type: defaultType, description: '', due_date: '', wallet_id: walletsStore.wallets[0]?.id ?? null }
  showForm.value = true
}

function openEdit(debt) {
  editingId.value = debt.id
  form.value = {
    name: debt.name,
    amount: formatCurrency(debt.amount),
    type: debt.type,
    description: debt.description ?? '',
    due_date: debt.due_date ?? '',
    wallet_id: debt.wallet_id ?? null
  }
  showForm.value = true
}

async function submit() {
  balanceError.value = ''
  const data = {
    ...form.value,
    amount: parseCurrency(form.value.amount)
  }

  // Balance validation for lending
  if (!editingId.value && data.type === 'owed_to_me' && data.wallet_id) {
    const wallet = walletsStore.wallets.find(w => w.id === data.wallet_id)
    if (wallet && data.amount > parseFloat(wallet.balance)) {
      balanceError.value = `Insufficient balance. ${wallet.name} only has ${formatCurrency(wallet.balance)}.`
      return
    }
  }

  if (editingId.value) {
    await store.update(editingId.value, data)
  } else {
    await store.create(data)
    // Optimistic balance adjustment (only for lending)
    if (data.wallet_id && data.type === 'owed_to_me') {
      walletsStore.adjustBalance(data.wallet_id, -data.amount)
    }
  }
  showForm.value = false
  dashboardStore.fetchStats()
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
    if (payWalletId.value) {
      const delta = debt.type === 'i_owe' ? -payAmount : payAmount
      walletsStore.adjustBalance(payWalletId.value, delta)
    }
  } else {
    // Partial payment — reduce the amount via backend
    await store.partialPay(debt.id, payAmount, payWalletId.value)
    if (payWalletId.value) {
      const delta = debt.type === 'i_owe' ? -payAmount : payAmount
      walletsStore.adjustBalance(payWalletId.value, delta)
    }
  }

  showPayModal.value = false
  payingDebt.value = null
  
  // Refetch data in background
  Promise.all([
    dashboardStore.fetchStats(),
    expensesStore.fetchAll(),
    salaryStore.fetchCurrentMonth()
  ])
}

function formatDueDate(str) {
  if (!str) return ''
  // Handle both YYYY-MM-DD and full ISO strings
  const d = new Date(str.includes('T') ? str : str + 'T00:00:00')
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const filtered = computed(() => store.debts)

const totalBalance = computed(() => {
  return (dashboardStore.stats.debts_owed_to_me - dashboardStore.stats.debts_i_owe).toFixed(2)
})
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto animate-fade-in">
    <div class="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-[32px] sm:text-[40px] font-black tracking-tight text-foreground leading-none">Debts</h1>
      </div>
      <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <div class="bg-card border border-border shadow-sm px-4 py-2 rounded-2xl flex flex-col items-start sm:items-end min-w-[140px] transition-all hover:shadow-md">
          <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Net Balance</span>
          <span 
            class="text-xl font-black tabular-nums"
            :class="parseFloat(totalBalance) >= 0 ? 'text-emerald-600' : 'text-destructive'"
          >
            {{ parseFloat(totalBalance) >= 0 ? '+' : '' }}{{ formatCurrency(totalBalance) }}
          </span>
        </div>
        <UiButton @click="openCreate" class="hidden sm:flex h-12 px-6 rounded-2xl">
          <Plus class="h-5 w-5 mr-1" /> Add
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

    <div class="relative mb-5">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <UiInput v-model="searchQuery" class="pl-9" placeholder="Search by name or notes…" />
    </div>

    <!-- Pagination Controls -->
    <div v-if="store.pagination.total > 10" class="flex items-center justify-end mb-6">
      <div class="flex items-center bg-card border border-border shadow-sm rounded-full p-1 gap-1">
        <button 
          class="h-11 w-11 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-muted active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
          :disabled="currentPage <= 1"
          @click="currentPage--"
          @mouseenter="currentPage > 1 && store.fetchAll(false, currentPage - 1, 20, { ...(activeTab !== 'all' ? { type: activeTab } : {}), ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}) })"
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
          @mouseenter="currentPage < store.pagination.last_page && store.fetchAll(false, currentPage + 1, 20, { ...(activeTab !== 'all' ? { type: activeTab } : {}), ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}) })"
        >
          <ChevronRight class="h-5 w-5" />
        </button>
      </div>
    </div>

    <div v-if="store.loading" class="space-y-2">
      <SkeletonListItem v-for="i in 4" :key="i" :show-icon="false" />
    </div>

    <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed bg-muted/20">
      <HandCoins class="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p class="text-sm text-muted-foreground">No debts recorded.</p>
    </div>

    <div v-else class="space-y-2">
      <UiCard
        v-for="debt in filtered"
        :key="debt.id"
        class="px-4 py-3 transition-all duration-200 cursor-pointer sm:cursor-default"
        @click="openEdit(debt)"
      >
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
            <span
              class="font-bold tabular-nums text-sm"
              :class="debt.is_paid ? 'text-muted-foreground' : (debt.type === 'owed_to_me' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')"
            >
              <template v-if="debt.type === 'owed_to_me'">
                {{ debt.is_paid ? '+' : '' }}{{ formatCurrency(debt.amount) }}
              </template>
              <template v-else>
                {{ debt.is_paid ? '' : '-' }}{{ formatCurrency(debt.amount) }}
              </template>
            </span>
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
          <div class="flex items-center gap-0.5 shrink-0" @click.stop>
            <UiButton
              v-if="!debt.is_paid"
              variant="outline" size="sm" class="h-8 px-3 text-emerald-600 border-emerald-200 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/60 dark:hover:bg-emerald-900/30 font-semibold shadow-sm"
              title="Mark as paid"
              @click="openPayModal(debt)"
            >
              Mark as Paid
            </UiButton>
            <UiButton variant="ghost" size="icon" class="h-8 w-8 hidden sm:flex" @click="openEdit(debt)">
              <Pencil class="h-4 w-4" />
            </UiButton>
            <UiButton variant="ghost" size="icon" class="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 hidden sm:flex" @click="store.remove(debt.id)">
              <Trash2 class="h-4 w-4" />
            </UiButton>
          </div>
        </div>
      </UiCard>
    </div>

    <Teleport to="body">
      <div v-if="showForm" class="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4" @mousedown.self="showForm = false">
        <UiCard class="flex w-full max-w-none flex-col overflow-hidden bg-card shadow-2xl animate-in fade-in zoom-in duration-200
          max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-none max-sm:pt-[env(safe-area-inset-top)]
          sm:max-h-[90vh] sm:min-h-0 sm:max-w-lg sm:rounded-2xl" @mousedown.stop>
          
          <div class="shrink-0 p-6 border-b border-border bg-gradient-to-r from-primary/10 to-transparent flex items-center justify-between">
            <h2 class="text-xl font-bold tracking-tight">{{ editingId ? 'Edit Debt' : 'New Debt' }}</h2>
            <UiButton variant="ghost" size="icon" @click="showForm = false" class="rounded-full h-8 w-8">
              <X class="h-4 w-4" />
            </UiButton>
          </div>

          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            <UiCardContent class="p-6">
              <form id="debt-form" @submit.prevent="submit" class="space-y-6">
                <div class="grid grid-cols-2 gap-4">
                  <div class="space-y-1.5 col-span-2">
                    <UiLabel>Name</UiLabel>
                    <UiInput v-model="form.name" placeholder="Person's name" required />
                  </div>
                  <div class="space-y-1.5">
                    <UiLabel>Amount (₱)</UiLabel>
                    <UiInput v-model="form.amount" type="number" min="0" step="0.01" placeholder="0.00" required />
                  </div>
                  <div class="space-y-1.5">
                    <UiLabel>Due Date</UiLabel>
                    <DatePicker v-model="form.due_date" placeholder="Optional due date" />
                  </div>
                  <div class="space-y-2 col-span-2">
                    <UiLabel>Type</UiLabel>
                    <div class="flex p-1 bg-muted rounded-xl border border-border">
                      <button
                        type="button"
                        @click="form.type = 'owed_to_me'"
                        class="flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-all duration-200"
                        :class="form.type === 'owed_to_me' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                      >
                        They owe me
                      </button>
                      <button
                        type="button"
                        @click="form.type = 'i_owe'"
                        class="flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-all duration-200"
                        :class="form.type === 'i_owe' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                      >
                        I owe them
                      </button>
                    </div>
                  </div>

                  <!-- Wallet Picker (Only for Lending) -->
                  <div class="space-y-2 col-span-2" v-if="form.type === 'owed_to_me'">
                    <UiLabel>Lend from Wallet</UiLabel>
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

                  <div class="space-y-1.5 col-span-2">
                    <UiLabel>Notes</UiLabel>
                    <UiTextarea v-model="form.description" placeholder="Optional notes…" />
                  </div>
                </div>

                <p v-if="balanceError" class="text-sm text-destructive font-medium rounded-xl bg-destructive/10 px-3 py-2">
                  {{ balanceError }}
                </p>
              </form>
            </UiCardContent>
          </div>

          <div class="shrink-0 border-t border-border bg-muted/20 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-3 sm:flex-row-reverse">
            <UiButton type="submit" form="debt-form" :disabled="store.loading" class="rounded-xl h-11 px-8 bg-primary text-primary-foreground font-bold">
              {{ store.loading ? (editingId ? 'Saving…' : 'Adding…') : (editingId ? 'Save changes' : 'Add debt') }}
            </UiButton>
            <UiButton variant="outline" @click="showForm = false" class="rounded-xl h-11 px-6">
              Cancel
            </UiButton>
            <UiButton v-if="editingId" type="button" variant="destructive" @click="store.remove(editingId); showForm = false" class="rounded-xl h-11 px-4 sm:mr-auto">
              <Trash2 class="h-4 w-4 mr-2" /> Delete
            </UiButton>
          </div>
        </UiCard>
      </div>
    </Teleport>

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
                <span class="font-semibold text-foreground">{{ formatCurrency(payingDebt?.amount ?? 0) }}</span>
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
                  Remaining after payment: <span class="font-semibold text-foreground">{{ formatCurrency(parseFloat(payingDebt?.amount ?? 0) - (parseFloat(partialAmount) || 0)) }}</span>
                </p>
              </div>

              <!-- Full pay info -->
              <div v-if="payMode === 'full'" class="rounded-2xl border-2 border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total to Pay</p>
                <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400">{{ formatCurrency(payingDebt?.amount ?? 0) }}</p>
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
                          :src="wallet.icon_url || `/icons/wallets/${wallet.type === 'metrobank' ? 'metrobank.jpg' : wallet.type + '.png'}`" 
                          class="w-full h-full object-contain rounded" 
                          @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                        />
                        <Wallet class="h-5 w-5 text-muted-foreground" style="display:none" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold truncate">{{ wallet.name }}</p>
                        <p class="text-xs text-muted-foreground font-medium tabular-nums">{{ formatCurrency(wallet.balance) }}</p>
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
              class="rounded-xl h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {{ store.loading ? 'Paying…' : (payMode === 'full' ? 'Confirm paid' : `Pay ${formatCurrency(effectivePayAmount)}`) }}
            </UiButton>
            <UiButton variant="outline" @click="showPayModal = false" class="rounded-xl h-11 px-6">
              Cancel
            </UiButton>
          </div>
        </UiCard>
      </div>
    </Teleport>
  </div>
</template>
