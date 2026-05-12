<script setup>
import { ref, computed } from 'vue'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { Plus, Pencil, Trash2, X, Receipt, Search } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import UiBadge from '@/components/ui/Badge.vue'
import DatePicker from '@/components/ui/DatePicker.vue'

const store = useExpensesStore()
const walletsStore = useWalletsStore()
useRegisterAddAction(openCreate)

const showForm = ref(false)
const editingId = ref(null)
const search = ref('')
const form = ref({ title: '', amount: '', category: '', description: '', date: '', wallet_id: null })

// Wallet type → emoji + color
const typeEmoji = {
  cash: '💵', gcash: '📱', maya: '💚', bpi: '🏦', bdo: '🏦',
  unionbank: '🏦', metrobank: '🏦', credit_card: '💳',
  debit_card: '🏧', shopeepay: '🛍️', coins_ph: '🪙', custom: '👛',
}
const typeColor = {
  cash:        'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  gcash:       'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  maya:        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  bpi:         'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  bdo:         'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  unionbank:   'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  metrobank:   'bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-300',
  credit_card: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  debit_card:  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  shopeepay:   'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300',
  coins_ph:    'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  custom:      'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
}

function walletEmoji(wallet) {
  if (!wallet) return '💰'
  return typeEmoji[wallet.type] ?? '👛'
}

function walletColor(wallet) {
  if (!wallet) return 'bg-muted text-muted-foreground'
  return typeColor[wallet.type] ?? typeColor.custom
}

const typeAccent = {
  cash:        'border-l-[3px] border-l-green-500',
  gcash:       'border-l-[3px] border-l-blue-500',
  maya:        'border-l-[3px] border-l-emerald-500',
  bpi:         'border-l-[3px] border-l-red-600',
  bdo:         'border-l-[3px] border-l-indigo-600',
  unionbank:   'border-l-[3px] border-l-orange-500',
  metrobank:   'border-l-[3px] border-l-green-700',
  credit_card: 'border-l-[3px] border-l-violet-600',
  debit_card:  'border-l-[3px] border-l-slate-500',
  shopeepay:   'border-l-[3px] border-l-orange-400',
  coins_ph:    'border-l-[3px] border-l-yellow-500',
  custom:      'border-l-[3px] border-l-pink-500',
}
function walletCardAccent(wallet) {
  if (!wallet) return ''
  return typeAccent[wallet.type] ?? typeAccent.custom
}

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

const filteredExpenses = computed(() => {
  const q = search.value.toLowerCase()
  if (!q) return store.expenses
  return store.expenses.filter(e =>
    e.title.toLowerCase().includes(q) ||
    (e.category ?? '').toLowerCase().includes(q) ||
    (e.wallet?.name ?? '').toLowerCase().includes(q)
  )
})

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
    amount: expense.amount,
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
  const newAmount = parseFloat(form.value.amount)

  // Balance validation
  if (newWalletId) {
    const wallet = walletsStore.wallets.find(w => w.id === newWalletId)
    if (wallet) {
      const available = parseFloat(wallet.balance) + (oldWalletId === newWalletId ? oldAmount : 0)
      if (newAmount > available) {
        balanceError.value = `Insufficient balance. ${wallet.name} only has ₱${parseFloat(wallet.balance).toFixed(2)}.`
        return
      }
    }
  }

  if (editingId.value) {
    await store.update(editingId.value, form.value)
    // Reflect balance in store optimistically
    if (oldWalletId) walletsStore.adjustBalance(oldWalletId, oldAmount)
    if (newWalletId) walletsStore.adjustBalance(newWalletId, -newAmount)
  } else {
    await store.create(form.value)
    if (newWalletId) walletsStore.adjustBalance(newWalletId, -newAmount)
  }
  showForm.value = false
}

async function remove(expense) {
  await store.remove(expense.id)
  if (expense.wallet_id) walletsStore.adjustBalance(expense.wallet_id, parseFloat(expense.amount))
}

const total = computed(() =>
  store.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0).toFixed(2)
)
</script>

<template>
  <div class="p-4 md:p-6 max-w-6xl mx-auto animate-fade-in">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Expenses</h1>
        <p class="text-sm text-muted-foreground mt-1">Total: <span class="font-semibold text-foreground">₱{{ total }}</span></p>
      </div>
      <UiButton @click="openCreate" class="hidden sm:flex">
        <Plus class="h-4 w-4" /> Add Expense
      </UiButton>
    </div>

    <!-- Search bar -->
    <div class="relative mb-4">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <UiInput v-model="search" placeholder="Search expenses…" class="pl-9" />
    </div>

    <div v-if="store.loading && store.expenses.length === 0" class="text-sm text-muted-foreground">Loading…</div>

    <div v-else-if="store.expenses.length === 0" class="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed bg-muted/20">
      <Receipt class="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p class="text-sm text-muted-foreground">No expenses recorded yet.</p>
    </div>

    <!-- Mobile card list -->
    <div v-else class="flex flex-col gap-2 md:hidden">
      <div
        v-for="expense in filteredExpenses"
        :key="expense.id"
        class="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 overflow-hidden"
        :class="walletCardAccent(expense.wallet)"
      >
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" :class="walletColor(expense.wallet)">
          {{ walletEmoji(expense.wallet) }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-sm truncate">{{ expense.title }}</p>
          <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
            <UiBadge v-if="expense.category" variant="secondary" class="text-[10px]">{{ expense.category }}</UiBadge>
            <span v-if="expense.wallet" class="text-[10px] text-muted-foreground font-medium">{{ expense.wallet.name }}</span>
          </div>
          <p class="text-[11px] text-muted-foreground mt-0.5">{{ formatDateTime(expense.date, expense.created_at) }}</p>
        </div>
        <div class="shrink-0 text-right">
          <p class="font-bold text-sm text-destructive">-₱{{ parseFloat(expense.amount).toFixed(2) }}</p>
          <div class="flex gap-1 mt-1 justify-end">
            <button class="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors" @click="openEdit(expense)">
              <Pencil class="h-3 w-3 text-muted-foreground" />
            </button>
            <button class="h-6 w-6 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors" @click="remove(expense)">
              <Trash2 class="h-3 w-3 text-destructive" />
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
          <tr v-for="expense in filteredExpenses" :key="expense.id" class="hover:bg-muted/30 transition-colors">
            <td class="px-4 py-3 font-medium">{{ expense.title }}</td>
            <td class="px-4 py-3">
              <span v-if="expense.wallet" class="inline-flex items-center gap-1.5 text-sm">
                <span>{{ walletEmoji(expense.wallet) }}</span>
                <span class="text-muted-foreground">{{ expense.wallet.name }}</span>
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-4 py-3">
              <UiBadge v-if="expense.category" variant="secondary">{{ expense.category }}</UiBadge>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-4 py-3 text-muted-foreground text-xs">{{ formatDateTime(expense.date, expense.created_at) }}</td>
            <td class="px-4 py-3 text-right font-semibold tabular-nums text-destructive">-₱{{ parseFloat(expense.amount).toFixed(2) }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-1">
                <UiButton variant="ghost" size="icon" class="h-7 w-7" @click="openEdit(expense)">
                  <Pencil class="h-3.5 w-3.5" />
                </UiButton>
                <UiButton variant="ghost" size="icon" class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" @click="remove(expense)">
                  <Trash2 class="h-3.5 w-3.5" />
                </UiButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </UiCard>

    <!-- Form Modal -->
    <Teleport to="body">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" @mousedown.self="showForm = false">
        <UiCard class="w-full sm:max-w-lg shadow-xl animate-fade-in rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 pb-4 sticky top-0 bg-card border-b border-border">
            <h2 class="text-lg font-semibold">{{ editingId ? 'Edit Expense' : 'New Expense' }}</h2>
            <UiButton variant="ghost" size="icon" @click="showForm = false"><X class="h-4 w-4" /></UiButton>
          </div>
          <UiCardContent class="p-5">
            <form @submit.prevent="submit" class="space-y-5">
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
                <div v-else class="grid grid-cols-2 gap-2">
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
                    <span class="text-xl leading-none">{{ walletEmoji(wallet) }}</span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold truncate">{{ wallet.name }}</p>
                      <p class="text-[10px] text-muted-foreground">₱{{ parseFloat(wallet.balance).toLocaleString('en-PH', { minimumFractionDigits: 2 }) }}</p>
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

              <p v-if="balanceError" class="text-sm text-destructive font-medium rounded-xl bg-destructive/10 px-3 py-2">
                {{ balanceError }}
              </p>

              <div class="flex justify-end gap-2 pt-1">
                <UiButton type="button" variant="outline" @click="showForm = false">Cancel</UiButton>
                <UiButton type="submit" :disabled="store.loading">
                  {{ store.loading ? 'Saving…' : (editingId ? 'Save changes' : 'Add expense') }}
                </UiButton>
              </div>
            </form>
          </UiCardContent>
        </UiCard>
      </div>
    </Teleport>
  </div>
</template>
