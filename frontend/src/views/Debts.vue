<script setup>
import { ref, computed } from 'vue'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useDebtsStore } from '@/stores/debts.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { Plus, Pencil, Trash2, X, BadgeCheck, HandCoins, Search, Wallet } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiTextarea from '@/components/ui/Textarea.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import UiBadge from '@/components/ui/Badge.vue'
import DatePicker from '@/components/ui/DatePicker.vue'

const store = useDebtsStore()
const walletsStore = useWalletsStore()
useRegisterAddAction(openCreate)

const activeTab = ref('all')
const searchQuery = ref('')
const showForm = ref(false)
const editingId = ref(null)
const form = ref({ name: '', amount: '', type: 'owed_to_me', description: '', due_date: '' })

// Pay modal state
const showPayModal = ref(false)
const payingDebt = ref(null)
const payWalletId = ref(null)
const payBalanceError = ref('')
const payMode = ref('full') // 'full' or 'partial'
const partialAmount = ref('')

const typeEmoji = {
  cash: '💵', gcash: '📱', maya: '💚', bpi: '🏦', bdo: '🏦',
  unionbank: '🏦', metrobank: '🏦', credit_card: '💳',
  debit_card: '🏧', shopeepay: '🛍️', coins_ph: '🪙', custom: '👛',
}
function walletEmoji(wallet) {
  return wallet ? (typeEmoji[wallet.type] ?? '👛') : '💰'
}

function openCreate() {
  editingId.value = null
  const defaultType = activeTab.value === 'i_owe' ? 'i_owe' : 'owed_to_me'
  form.value = { name: '', amount: '', type: defaultType, description: '', due_date: '' }
  showForm.value = true
}

function openEdit(debt) {
  editingId.value = debt.id
  form.value = {
    name: debt.name,
    amount: debt.amount,
    type: debt.type,
    description: debt.description ?? '',
    due_date: debt.due_date ?? '',
  }
  showForm.value = true
}

async function submit() {
  if (editingId.value) {
    await store.update(editingId.value, form.value)
  } else {
    await store.create(form.value)
  }
  showForm.value = false
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
  return parseFloat(partialAmount.value) || 0
})

const partialAmountError = computed(() => {
  if (payMode.value !== 'partial') return ''
  const amt = parseFloat(partialAmount.value) || 0
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
      payBalanceError.value = `Insufficient balance. ${wallet.name} only has ₱${parseFloat(wallet.balance).toFixed(2)}.`
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
}

function formatDueDate(str) {
  if (!str) return ''
  // Handle both YYYY-MM-DD and full ISO strings
  const d = new Date(str.includes('T') ? str : str + 'T00:00:00')
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const filtered = computed(() => {
  let result = store.debts
  if (activeTab.value !== 'all') result = result.filter(d => d.type === activeTab.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) result = result.filter(d =>
    d.name.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q)
  )
  return result
})
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto animate-fade-in">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Debts</h1>
        <p class="text-sm text-muted-foreground mt-1">Track what you owe and what others owe you</p>
      </div>
      <UiButton @click="openCreate" class="hidden sm:flex">
        <Plus class="h-4 w-4" /> Add Debt
      </UiButton>
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

    <div v-if="store.loading" class="text-sm text-muted-foreground">Loading…</div>

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
        :class="[
          debt.is_paid ? 'opacity-50' : '',
          debt.type === 'owed_to_me'
            ? 'border-l-[3px] border-l-emerald-500'
            : 'border-l-[3px] border-l-destructive',
        ]"
      >
        <!-- Row 1: name + amount -->
        <div class="flex items-start justify-between gap-3">
          <p class="font-semibold text-sm leading-snug truncate flex-1">{{ debt.name }}</p>
          <span
            class="font-bold tabular-nums text-sm shrink-0"
            :class="debt.type === 'owed_to_me' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'"
          >
            {{ debt.type === 'owed_to_me' ? '+' : '-' }}₱{{ parseFloat(debt.amount).toFixed(2) }}
          </span>
        </div>

        <!-- Row 2: badges + due date + actions -->
        <div class="flex items-center justify-between gap-2 mt-2">
          <div class="flex flex-wrap items-center gap-1.5 min-w-0">
            <UiBadge
              :variant="debt.type === 'owed_to_me' ? 'success' : 'warning'"
              class="text-[10px] shrink-0"
            >
              {{ debt.type === 'owed_to_me' ? 'Owes me' : 'I owe' }}
            </UiBadge>
            <span v-if="debt.due_date" class="text-[11px] text-muted-foreground shrink-0">
              Due {{ formatDueDate(debt.due_date) }}
            </span>
            <UiBadge v-if="debt.is_paid" variant="secondary" class="text-[10px] shrink-0">Paid</UiBadge>
          </div>

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
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" @mousedown.self="showForm = false">
        <UiCard class="w-full max-w-lg shadow-xl animate-fade-in">
          <div class="flex items-center justify-between p-6 pb-4">
            <h2 class="text-lg font-semibold">{{ editingId ? 'Edit Debt' : 'New Debt' }}</h2>
            <UiButton variant="ghost" size="icon" @click="showForm = false"><X class="h-4 w-4" /></UiButton>
          </div>
          <UiCardContent>
            <form @submit.prevent="submit" class="space-y-4">
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
                <div class="space-y-1.5 col-span-2">
                  <UiLabel>Type</UiLabel>
                  <select v-model="form.type" class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="owed_to_me">They owe me</option>
                    <option value="i_owe">I owe them</option>
                  </select>
                </div>
                <div class="space-y-1.5 col-span-2">
                  <UiLabel>Notes</UiLabel>
                  <UiTextarea v-model="form.description" placeholder="Optional notes…" />
                </div>
              </div>
              <div class="flex justify-between items-center pt-2">
                <UiButton v-if="editingId" type="button" variant="destructive" size="icon" class="h-9 w-9" @click="store.remove(editingId); showForm = false">
                  <Trash2 class="h-4 w-4" />
                </UiButton>
                <div v-else></div>
                <div class="flex gap-2">
                  <UiButton type="button" variant="outline" @click="showForm = false">Cancel</UiButton>
                  <UiButton type="submit" :disabled="store.loading">
                    {{ store.loading ? 'Saving…' : (editingId ? 'Save changes' : 'Add debt') }}
                  </UiButton>
                </div>
              </div>
            </form>
          </UiCardContent>
        </UiCard>
      </div>
    </Teleport>

    <!-- Pay with wallet modal — now with Full/Partial tabs -->
    <Teleport to="body">
      <div v-if="showPayModal" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" @mousedown.self="showPayModal = false">
        <UiCard class="w-full sm:max-w-md shadow-xl animate-fade-in rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 pb-4 sticky top-0 bg-card border-b border-border">
            <div>
              <h2 class="text-lg font-semibold">Mark as Paid</h2>
              <p class="text-sm text-muted-foreground mt-0.5">
                <span class="font-semibold text-foreground">{{ payingDebt?.name }}</span>
                <span class="mx-1">·</span>
                <span class="font-semibold text-foreground">₱{{ parseFloat(payingDebt?.amount ?? 0).toFixed(2) }}</span>
              </p>
            </div>
            <UiButton variant="ghost" size="icon" @click="showPayModal = false"><X class="h-4 w-4" /></UiButton>
          </div>
          <UiCardContent class="p-5">
            <div class="space-y-4">
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
                />
                <p v-if="partialAmountError" class="text-xs text-destructive mt-1">{{ partialAmountError }}</p>
                <p v-else-if="partialAmount && !partialAmountError" class="text-xs text-muted-foreground mt-1">
                  Remaining after payment: <span class="font-semibold text-foreground">₱{{ (parseFloat(payingDebt?.amount ?? 0) - (parseFloat(partialAmount) || 0)).toFixed(2) }}</span>
                </p>
              </div>

              <!-- Full pay info -->
              <div v-if="payMode === 'full'" class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                <p class="text-sm text-muted-foreground">This will mark the debt as <span class="font-semibold text-emerald-600 dark:text-emerald-400">fully paid</span></p>
                <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">₱{{ parseFloat(payingDebt?.amount ?? 0).toFixed(2) }}</p>
              </div>

              <!-- Wallet picker -->
              <div class="space-y-2">
                <UiLabel class="text-xs text-muted-foreground">
                  {{ payingDebt?.type === 'i_owe' ? 'Pay from wallet' : 'Receive to wallet' }}
                </UiLabel>
                <div v-if="walletsStore.wallets.length === 0" class="text-sm text-muted-foreground rounded-xl border border-dashed p-4 text-center">
                  No wallets yet — you can still mark as paid without a wallet.
                </div>
                <div v-else class="grid grid-cols-1 gap-2">
                  <button
                    v-for="wallet in walletsStore.wallets"
                    :key="wallet.id"
                    type="button"
                    @click="payWalletId = wallet.id"
                    class="flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all duration-150"
                    :class="payWalletId === wallet.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'"
                  >
                    <span class="text-2xl leading-none">{{ walletEmoji(wallet) }}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold truncate">{{ wallet.name }}</p>
                      <p class="text-xs text-muted-foreground">₱{{ parseFloat(wallet.balance).toLocaleString('en-PH', { minimumFractionDigits: 2 }) }}</p>
                    </div>
                    <div v-if="payWalletId === wallet.id" class="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <span class="text-[8px] text-white font-bold">✓</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    @click="payWalletId = null"
                    class="flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all duration-150"
                    :class="payWalletId === null ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'"
                  >
                    <span class="text-2xl leading-none">💰</span>
                    <p class="text-sm font-semibold">No wallet (cash / external)</p>
                  </button>
                </div>
              </div>

              <p v-if="payBalanceError" class="text-sm text-destructive font-medium rounded-xl bg-destructive/10 px-3 py-2">
                {{ payBalanceError }}
              </p>

              <div class="flex justify-end gap-2 pt-1">
                <UiButton type="button" variant="outline" @click="showPayModal = false">Cancel</UiButton>
                <UiButton
                  @click="confirmPay"
                  :disabled="store.loading || (payMode === 'partial' && !!partialAmountError)"
                  class="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {{ store.loading ? 'Saving…' : (payMode === 'full' ? 'Confirm paid' : `Pay ₱${effectivePayAmount.toFixed(2)}`) }}
                </UiButton>
              </div>
            </div>
          </UiCardContent>
        </UiCard>
      </div>
    </Teleport>
  </div>
</template>
