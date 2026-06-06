<script setup>
import { ref, computed, watch } from 'vue'
import { useExpensesStore } from '@/stores/expenses.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { X, Trash2, Wallet, Receipt } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import DatePicker from '@/components/ui/DatePicker.vue'
import { formatCurrency, parseCurrency, parseExpenseAmount } from '@/utils/format'
import { shouldFetchFromServer } from '@/lib/syncEngine.js'
import { getWalletIconUrl } from '@/lib/walletIcons.js'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'
import CustomSelect from '@/components/shared/CustomSelect.vue'
import UnsavedChangesAlert from '@/components/shared/UnsavedChangesAlert.vue'
import ConfirmAlert from '@/components/shared/ConfirmAlert.vue'

const props = defineProps({
  show: Boolean,
  expenseId: { type: [String, Number], default: null },
  preselectedWalletId: { type: [String, Number], default: null },
  selectedMonth: { type: Number, default: () => new Date().getMonth() + 1 },
  selectedYear: { type: Number, default: () => new Date().getFullYear() }
})

const emit = defineEmits(['close'])

const store = useExpensesStore()
const walletsStore = useWalletsStore()
const dashboard = useDashboardStore()

const form = ref({ title: '', amount: '', description: '', date: '', wallet_id: null })
const initialForm = ref(null)
const balanceError = ref('')
const showUnsavedChangesAlert = ref(false)
const showDeleteConfirm = ref(false)

const walletOptions = computed(() => {
  return walletsStore.wallets.map(w => ({
    value: w.id,
    label: `${w.name} (${formatCurrency(w.balance)})`
  }))
})

const selectedWallet = computed(() => {
  return form.value.wallet_id ? walletsStore.wallets.find(w => w.id === form.value.wallet_id) : null
})

watch(() => props.show, (val) => {
  if (val) {
    balanceError.value = ''
    if (props.expenseId) {
      const expense = store.expenses.find(e => e.id === props.expenseId) || store.feedItems.find(e => e.id === props.expenseId)
      if (expense) {
        form.value = {
          title: expense.title,
          amount: parseExpenseAmount(expense.amount),
          description: expense.description ?? '',
          date: typeof expense.date === 'string' ? expense.date.slice(0, 10) : expense.date,
          wallet_id: expense.wallet_id ?? null,
        }
      }
    } else {
      const firstWallet = walletsStore.wallets[0]
      form.value = {
        title: '', amount: '', description: '',
        date: new Date().toISOString().slice(0, 10),
        wallet_id: props.preselectedWalletId ?? firstWallet?.id ?? null,
      }
    }
    initialForm.value = JSON.stringify(form.value)
  }
})

async function submit() {
  balanceError.value = ''
  const oldExpense = props.expenseId ? (store.expenses.find(e => e.id === props.expenseId) || store.feedItems.find(e => e.id === props.expenseId)) : null
  const oldWalletId = oldExpense?.wallet_id ?? null
  const oldAmount = oldExpense ? parseExpenseAmount(oldExpense.amount) : 0
  const newWalletId = form.value.wallet_id
  const newAmount = parseCurrency(form.value.amount)

  // Balance validation
  if (newWalletId) {
    const wallet = walletsStore.wallets.find(w => String(w.id) === String(newWalletId))
    if (wallet) {
      const available = parseFloat(wallet.balance) + (String(oldWalletId) === String(newWalletId) ? oldAmount : 0)
      if (newAmount > available) {
        balanceError.value = `Insufficient balance. ${wallet.name} only has ${formatCurrency(wallet.balance)}.`
        return
      }
    }
  }

  const data = { ...form.value, amount: newAmount }
  if (props.expenseId) {
    await store.update(props.expenseId, data)
  } else {
    await store.create(data)
  }
  emit('close')
  if (shouldFetchFromServer()) {
    dashboard.fetchStats({ month: props.selectedMonth, year: props.selectedYear })
  }
}

function requestDeleteExpense() {
  if (!props.expenseId) return
  showDeleteConfirm.value = true
}

async function confirmDeleteExpense() {
  showDeleteConfirm.value = false
  if (!props.expenseId) return
  await store.remove(props.expenseId)
  emit('close')
  if (shouldFetchFromServer()) {
    dashboard.fetchStats({ month: props.selectedMonth, year: props.selectedYear })
  }
}

function handleClose() {
  const isDirty = initialForm.value && JSON.stringify(form.value) !== initialForm.value
  if (isDirty) {
    showUnsavedChangesAlert.value = true
  } else {
    emit('close')
  }
}

async function handleSaveFromAlert() {
  showUnsavedChangesAlert.value = false
  await submit()
}

function handleDiscardFromAlert() {
  showUnsavedChangesAlert.value = false
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4 animate-in fade-in duration-200" @mousedown.self="handleClose">
      <UiCard class="flex w-full max-w-none flex-col overflow-hidden bg-background shadow-2xl border-0
        max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300
        sm:animate-in sm:zoom-in-95 sm:duration-200
        max-sm:h-[85dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-t-3xl max-sm:rounded-b-none
        sm:max-h-[90vh] sm:min-h-0 sm:max-w-md sm:rounded-3xl" @mousedown.stop>
        
        <form id="expense-form" @submit.prevent="submit" class="flex flex-col h-full overflow-hidden">
          <!-- Header -->
          <div class="relative shrink-0 pt-8 pb-4 flex flex-col items-center">
            <UiButton type="button" variant="ghost" size="icon" @click="handleClose" class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors">
              <X class="h-5 w-5 text-muted-foreground" />
            </UiButton>

            <UiButton v-if="expenseId" type="button" variant="ghost" size="icon" @click="requestDeleteExpense" class="absolute left-4 top-4 rounded-full h-8 w-8 bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors" title="Delete Expense">
              <Trash2 class="h-4 w-4" />
            </UiButton>
            
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm mb-3">
              <Receipt class="h-6 w-6 text-rose-500" />
            </div>

            <p class="text-sm font-medium text-muted-foreground">
              {{ expenseId ? 'Edit Expense' : 'New Expense' }}
            </p>
            
            <div class="mt-4 flex items-center justify-center w-full px-8 relative overflow-hidden">
              <div class="flex items-center justify-center gap-1 border-b-2 border-muted-foreground/30 focus-within:border-primary pb-2 transition-colors min-w-[140px] max-w-full">
                <span class="text-3xl font-semibold text-muted-foreground shrink-0 leading-none mt-1">₱</span>
                <input 
                  v-model="form.amount" 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  placeholder="0.00" 
                  required
                  :style="{ width: Math.max(String(form.amount || '').length, 3) + 'ch' }"
                  class="bg-transparent text-center text-5xl font-bold tracking-tight outline-none focus:ring-0 p-0 leading-none placeholder:text-muted-foreground/30"
                />
              </div>
            </div>
          </div>

          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 sm:px-6">
            <div class="bg-card rounded-2xl shadow-sm border border-border overflow-hidden p-1 space-y-1">
              
              <div class="p-3">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Category / Title</UiLabel>
                <UiInput v-model="form.title" placeholder="Groceries, Utilities…" required class="border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30 h-11" />
              </div>

              <div class="p-3 pt-1">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Date</UiLabel>
                <DatePicker v-model="form.date" placeholder="Pick a date" class="w-full border-0 bg-muted/50" />
              </div>
            </div>

            <div class="mt-4 bg-card rounded-2xl shadow-sm border border-border p-4 shrink-0">
              <div class="flex items-center justify-between mb-3">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold block">Pay from Wallet</UiLabel>
              </div>
              <div v-if="walletsStore.wallets.length === 0" class="text-sm text-muted-foreground rounded-xl border border-dashed p-4 text-center">
                No wallets yet — add one in the <strong>Wallets</strong> tab.
              </div>
              <div v-else>
                <CustomSelect
                  v-model="form.wallet_id"
                  :options="walletOptions"
                  placeholder="Select a wallet"
                />
              </div>
            </div>
            
            <p v-if="balanceError" class="text-sm font-medium text-destructive mt-4 text-center bg-destructive/10 rounded-xl p-3">{{ balanceError }}</p>
          </div>

          <!-- Actions -->
          <div class="p-4 bg-background border-t border-border flex items-center gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <UiButton type="button" variant="secondary" class="flex-1 font-semibold" @click="handleClose" :disabled="store.loading">
              Cancel
            </UiButton>
            <UiButton type="submit" class="flex-1 font-bold" :disabled="store.loading" :loading="store.loading">
              {{ store.loading ? 'Saving…' : 'Save changes' }}
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

    <ConfirmAlert
      :show="showDeleteConfirm"
      title="Delete expense?"
      message="This will permanently remove this expense. This action cannot be undone."
      confirm-label="Delete"
      @confirm="confirmDeleteExpense"
      @cancel="showDeleteConfirm = false"
    />
  </Teleport>
</template>
