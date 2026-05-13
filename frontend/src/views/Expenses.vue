<script setup>
import { ref, computed, watch } from 'vue'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { Plus, Pencil, Trash2, X, Receipt, Search, TrendingUp, Calendar } from 'lucide-vue-next'
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
useRegisterAddAction(openCreate)

const selectedMonth = ref(new Date().getMonth() + 1)
const selectedYear = ref(new Date().getFullYear())

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

watch([selectedMonth, selectedYear], () => {
  store.fetchAll({ month: selectedMonth.value, year: selectedYear.value })
}, { immediate: true })

const showForm = ref(false)
const editingId = ref(null)
const search = ref('')
const form = ref({ title: '', amount: '', category: '', description: '', date: '', wallet_id: null })

const total = computed(() =>
  store.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0).toFixed(2)
)

const salaryTarget = computed(() => parseFloat(authStore.user?.monthly_salary ?? 0))

const effectiveLimit = computed(() => salaryTarget.value)

const remainingSalary = computed(() => {
  return effectiveLimit.value - parseFloat(total.value)
})

const spendingPercentage = computed(() => {
  if (effectiveLimit.value <= 0) return 0
  return Math.min((parseFloat(total.value) / effectiveLimit.value) * 100, 100)
})

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

// Category-based color system
const categoryColors = {
  food: {
    border: 'border-l-[3px] border-l-orange-500',
    badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    emoji: '🍔',
  },
  groceries: {
    border: 'border-l-[3px] border-l-green-500',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    emoji: '🛒',
  },
  transport: {
    border: 'border-l-[3px] border-l-blue-500',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    emoji: '🚗',
  },
  transportation: {
    border: 'border-l-[3px] border-l-blue-500',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    emoji: '🚗',
  },
  bills: {
    border: 'border-l-[3px] border-l-red-500',
    badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    emoji: '📄',
  },
  utilities: {
    border: 'border-l-[3px] border-l-yellow-500',
    badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    emoji: '⚡',
  },
  entertainment: {
    border: 'border-l-[3px] border-l-purple-500',
    badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    emoji: '🎬',
  },
  health: {
    border: 'border-l-[3px] border-l-rose-500',
    badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    emoji: '💊',
  },
  shopping: {
    border: 'border-l-[3px] border-l-pink-500',
    badge: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
    emoji: '🛍️',
  },
  education: {
    border: 'border-l-[3px] border-l-indigo-500',
    badge: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    emoji: '📚',
  },
  travel: {
    border: 'border-l-[3px] border-l-teal-500',
    badge: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    emoji: '✈️',
  },
  subscription: {
    border: 'border-l-[3px] border-l-violet-500',
    badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    emoji: '📱',
  },
  snack: {
    border: 'border-l-[3px] border-l-amber-500',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    emoji: '🍿',
  },
  drinks: {
    border: 'border-l-[3px] border-l-cyan-500',
    badge: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    emoji: '🥤',
  },
  rent: {
    border: 'border-l-[3px] border-l-stone-500',
    badge: 'bg-stone-100 dark:bg-stone-900/40 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800',
    emoji: '🏠',
  },
}

const defaultCategoryColor = {
  border: 'border-l-[3px] border-l-slate-400',
  badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  emoji: '📦',
}

function getCategoryColor(category) {
  if (!category) return defaultCategoryColor
  const key = category.toLowerCase().trim()
  return categoryColors[key] ?? defaultCategoryColor
}

function getCategoryEmoji(category) {
  return getCategoryColor(category).emoji
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
}

async function remove(expense) {
  await store.remove(expense.id)
  if (expense.wallet_id) walletsStore.adjustBalance(expense.wallet_id, parseFloat(expense.amount))
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-6xl mx-auto animate-fade-in">
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Expenses</h1>
        <p class="text-sm text-muted-foreground mt-1 hidden sm:block">Track and manage your daily spending</p>
      </div>
      <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <!-- Month Picker -->
        <div class="flex items-center gap-2 bg-card border border-border shadow-sm px-3 py-1.5 rounded-2xl">
          <Calendar class="h-4 w-4 text-muted-foreground" />
          <select v-model="selectedMonth" class="bg-transparent text-sm font-bold border-none focus:ring-0 cursor-pointer">
            <option v-for="(m, i) in months" :key="m" :value="i + 1">{{ m }}</option>
          </select>
          <select v-model="selectedYear" class="bg-transparent text-sm font-bold border-none focus:ring-0 cursor-pointer">
            <option v-for="y in [2024, 2025, 2026]" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>

        <div class="bg-card border border-border shadow-sm px-4 py-2 rounded-2xl flex flex-col items-start sm:items-end min-w-[140px] transition-all hover:shadow-md">
          <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Total Expenses</span>
          <span class="text-xl font-black text-foreground tabular-nums">{{ formatCurrency(total) }}</span>
        </div>
        <UiButton @click="openCreate" class="hidden sm:flex h-12 px-6 rounded-2xl">
          <Plus class="h-5 w-5 mr-1" /> Add
        </UiButton>
      </div>
    </div>

    <!-- Salary / Budget Tracking Card -->
    <UiCard v-if="authStore.user?.monthly_salary > 0" class="mb-5 overflow-hidden border-primary/10 shadow-sm rounded-2xl bg-gradient-to-br from-card to-muted/20">
      <div class="p-4 sm:p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <div class="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp class="h-4 w-4 text-primary" />
            </div>
            <h3 class="text-sm font-bold">Spending Power ({{ months[selectedMonth - 1] }})</h3>
          </div>
          <p class="text-xs font-bold" :class="remainingSalary < 0 ? 'text-destructive' : 'text-emerald-600'">
            {{ formatCurrency(Math.abs(remainingSalary)) }} {{ remainingSalary < 0 ? 'over' : 'left' }}
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
               :style="{ width: `${spendingPercentage}%` }"
               :class="spendingPercentage > 90 ? 'bg-destructive' : spendingPercentage > 75 ? 'bg-amber-500' : 'bg-emerald-500'"
             />
          </div>
          <div class="flex justify-between items-center">
            <p class="text-[10px] text-muted-foreground italic">
               {{ spendingPercentage > 100 ? "You've exceeded your limit!" : `${(100 - spendingPercentage).toFixed(0)}% of budget remaining` }}
            </p>
            <span class="text-[10px] font-black" :class="spendingPercentage > 90 ? 'text-destructive' : 'text-emerald-600'">
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
        class="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 overflow-hidden cursor-pointer sm:cursor-default"
        @click="openEdit(expense)"
      >
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl overflow-hidden p-1.5" :class="walletColor(expense.wallet)">
          <template v-if="expense.wallet">
            <img 
              :src="expense.wallet.icon_url || `/icons/wallets/${expense.wallet.type}.png`" 
              class="w-full h-full object-contain" 
              @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
            />
            <span style="display:none">{{ walletEmoji(expense.wallet) }}</span>
          </template>
          <span v-else>{{ getCategoryEmoji(expense.category) }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-sm truncate">{{ expense.title }}</p>
          <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span
              v-if="expense.category"
              class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium border"
              :class="getCategoryColor(expense.category).badge"
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
              <div class="flex items-center gap-2">
                <template v-if="expense.wallet">
                  <div class="w-6 h-6 flex items-center justify-center rounded-md overflow-hidden" :class="walletColor(expense.wallet)">
                    <img 
                      :src="expense.wallet.icon_url || `/icons/wallets/${expense.wallet.type}.png`" 
                      class="w-full h-full object-contain p-0.5" 
                      @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                    />
                    <span style="display:none" class="text-sm">{{ walletEmoji(expense.wallet) }}</span>
                  </div>
                </template>
                <span v-else class="text-base">{{ getCategoryEmoji(expense.category) }}</span>
                {{ expense.title }}
              </div>
            </td>
            <td class="px-4 py-3">
              <span v-if="expense.wallet" class="inline-flex items-center gap-1.5 text-sm">
                <div class="w-5 h-5 flex items-center justify-center rounded-sm overflow-hidden" :class="walletColor(expense.wallet)">
                  <img 
                    :src="expense.wallet.icon_url || `/icons/wallets/${expense.wallet.type}.png`" 
                    class="w-full h-full object-contain p-0.5" 
                    @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                  />
                  <span style="display:none" class="text-xs">{{ walletEmoji(expense.wallet) }}</span>
                </div>
                <span class="text-muted-foreground">{{ expense.wallet.name }}</span>
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </td>
            <td class="px-4 py-3">
              <span
                v-if="expense.category"
                class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border"
                :class="getCategoryColor(expense.category).badge"
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
                    <div class="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-white/20 p-1">
                      <img 
                        :src="wallet.icon_url || `/icons/wallets/${wallet.type}.png`" 
                        class="w-full h-full object-contain" 
                        @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                      />
                      <span class="text-xl leading-none" style="display:none">{{ walletEmoji(wallet) }}</span>
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

              <p v-if="balanceError" class="text-sm text-destructive font-medium rounded-xl bg-destructive/10 px-3 py-2">
                {{ balanceError }}
              </p>

              <div class="flex justify-between items-center pt-1">
                <UiButton v-if="editingId" type="button" variant="destructive" size="icon" class="h-9 w-9" @click="remove({ id: editingId, amount: form.amount, wallet_id: form.wallet_id }); showForm = false">
                  <Trash2 class="h-4 w-4" />
                </UiButton>
                <div v-else></div>
                <div class="flex gap-2">
                  <UiButton type="button" variant="outline" @click="showForm = false">Cancel</UiButton>
                  <UiButton type="submit" :disabled="store.loading">
                    {{ store.loading ? 'Saving…' : (editingId ? 'Save changes' : 'Add expense') }}
                  </UiButton>
                </div>
              </div>
            </form>
          </UiCardContent>
        </UiCard>
      </div>
    </Teleport>
  </div>
</template>
