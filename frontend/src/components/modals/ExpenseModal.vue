<script setup>
import { ref, computed, watch } from 'vue'
import { useExpensesStore } from '@/stores/expenses.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { X, Trash2, Wallet, Receipt, Camera } from 'lucide-vue-next'
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
import ScanReceiptModal from '@/components/modals/ScanReceiptModal.vue'
import ReceiptItemsSection from '@/components/expense/ReceiptItemsSection.vue'

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

const form = ref({ title: '', amount: '', description: '', date: '', wallet_id: null, receipt_items: null })
const initialForm = ref(null)
const balanceError = ref('')
const showUnsavedChangesAlert = ref(false)
const showDeleteConfirm = ref(false)
const showScanReceipt = ref(false)
const isFromScan = ref(false) // Track if form opened from scan
const isEditMode = ref(false) // Track if in edit mode (for existing expenses)

// Category dropdown options (only for scanned receipts)
const categoryOptions = [
  { value: 'Groceries', label: 'Groceries' },
  { value: 'Restaurant', label: 'Restaurant' },
  { value: 'Transportation', label: 'Transportation' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Shopping', label: 'Shopping' },
  { value: 'Utilities', label: 'Utilities' },
  { value: 'Entertainment', label: 'Entertainment' },
  { value: 'Education', label: 'Education' },
  { value: 'Bills', label: 'Bills' },
  { value: 'Personal Care', label: 'Personal Care' },
  { value: 'Fitness', label: 'Fitness' },
  { value: 'Travel', label: 'Travel' },
  { value: 'Coffee & Tea', label: 'Coffee & Tea' },
  { value: 'Debt Payment', label: 'Debt Payment' },
  { value: 'Savings', label: 'Savings' },
  { value: 'Gifts', label: 'Gifts' },
  { value: 'Pet Care', label: 'Pet Care' },
  { value: 'Home & Repair', label: 'Home & Repair' },
  { value: 'Baby Needs', label: 'Baby Needs' },
  { value: 'Others', label: 'Others' }
]

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
      // Viewing/Editing existing expense
      const expense = store.expenses.find(e => e.id === props.expenseId) || store.feedItems.find(e => e.id === props.expenseId)
      if (expense) {
        form.value = {
          title: expense.title,
          amount: parseExpenseAmount(expense.amount),
          description: expense.description ?? '',
          date: typeof expense.date === 'string' ? expense.date.slice(0, 10) : expense.date,
          wallet_id: expense.wallet_id ?? null,
          receipt_items: expense.receipt_items ?? null,
        }
      }
      isFromScan.value = false // Editing is always manual
      isEditMode.value = false // Start in VIEW mode
    } else {
      // Creating new expense
      const firstWallet = walletsStore.wallets[0]
      form.value = {
        title: '', amount: '', description: '',
        date: new Date().toISOString().slice(0, 10),
        wallet_id: props.preselectedWalletId ?? firstWallet?.id ?? null,
        receipt_items: null,
      }
      isFromScan.value = false // Reset scan flag for new expense
      isEditMode.value = true // New expense is always in EDIT mode
    }
    initialForm.value = JSON.stringify(form.value)
  }
})

async function submit() {
  balanceError.value = ''
  
  // Validate category is selected for scanned receipts
  if (isFromScan.value && !form.value.title) {
    balanceError.value = 'Please select a category for the scanned receipt.'
    return
  }
  
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
  
  try {
    if (props.expenseId) {
      await store.update(props.expenseId, data)
    } else {
      await store.create(data)
    }
    emit('close')
    if (shouldFetchFromServer()) {
      dashboard.fetchStats({ month: props.selectedMonth, year: props.selectedYear })
    }
  } catch (e) {
    if (e.response?.data?.message) {
      balanceError.value = e.response.data.message
    } else {
      balanceError.value = 'Failed to save expense. Please check your inputs.'
    }
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
  if (props.expenseId && !isEditMode.value) {
    // Viewing mode - just close without checking changes
    emit('close')
    return
  }
  
  const isDirty = initialForm.value && JSON.stringify(form.value) !== initialForm.value
  if (isDirty) {
    showUnsavedChangesAlert.value = true
  } else {
    emit('close')
  }
}

function enableEditMode() {
  isEditMode.value = true
}

function cancelEdit() {
  if (props.expenseId) {
    // Cancel editing - return to VIEW mode
    isEditMode.value = false
    // Reset form to initial values
    const expense = store.expenses.find(e => e.id === props.expenseId) || store.feedItems.find(e => e.id === props.expenseId)
    if (expense) {
      form.value = {
        title: expense.title,
        amount: parseExpenseAmount(expense.amount),
        description: expense.description ?? '',
        date: typeof expense.date === 'string' ? expense.date.slice(0, 10) : expense.date,
        wallet_id: expense.wallet_id ?? null,
        receipt_items: expense.receipt_items ?? null,
      }
    }
  } else {
    // New expense - just close
    handleClose()
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

function openScanReceipt() {
  showScanReceipt.value = true
}

function handleScanned(scannedData) {
  // Set flag to show dropdown for scanned receipts
  isFromScan.value = true
  
  // Auto-fill form with scanned data
  form.value.amount = scannedData.total.toFixed(2)
  form.value.date = scannedData.date
  // Only show item count if 2 or more items
  const itemCountText = scannedData.itemCount > 1 ? ` • ${scannedData.itemCount} items` : ''
  form.value.description = `${scannedData.merchantName}${itemCountText}`
  // Leave title (category) empty for user to select from dropdown
  // Leave wallet empty for user to select
  
  // Store receipt items (will be saved to backend, but NOT displayed until saved)
  form.value.receipt_items = {
    items: scannedData.items,
    fees: scannedData.fees,
    itemsSubtotal: scannedData.itemsSubtotal,
    feesSubtotal: scannedData.feesSubtotal,
    total: scannedData.total,
    itemCount: scannedData.itemCount,
    feeCount: scannedData.feeCount,
    merchantName: scannedData.merchantName,
    scannedAt: new Date().toISOString()
  }
  
  showScanReceipt.value = false
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
            <UiButton v-if="expenseId && !isEditMode" type="button" variant="ghost" size="icon" @click="handleClose" class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors">
              <X class="h-5 w-5 text-muted-foreground" />
            </UiButton>

            <UiButton v-if="expenseId && !isEditMode" type="button" variant="ghost" size="icon" @click="requestDeleteExpense" class="absolute left-4 top-4 rounded-full h-8 w-8 bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors" title="Delete Expense">
              <Trash2 class="h-4 w-4" />
            </UiButton>

            <UiButton v-if="(expenseId && isEditMode) || !expenseId" type="button" variant="ghost" size="icon" @click="handleClose" class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors">
              <X class="h-5 w-5 text-muted-foreground" />
            </UiButton>
            
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm mb-3">
              <Receipt class="h-6 w-6 text-rose-500" />
            </div>

            <p class="text-sm font-medium text-muted-foreground">
              {{ expenseId ? (isEditMode ? 'Edit Expense' : 'Expense Details') : 'New Expense' }}
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
                  :disabled="expenseId && !isEditMode"
                  :style="{ width: Math.max(String(form.amount || '').length, 3) + 'ch' }"
                  class="bg-transparent text-center text-5xl font-bold tracking-tight outline-none focus:ring-0 p-0 leading-none placeholder:text-muted-foreground/30"
                  :class="{ 'opacity-70 cursor-not-allowed': expenseId && !isEditMode }"
                />
              </div>
            </div>

            <!-- Scan Receipt Button (only for NEW expenses without scanned data) -->
            <UiButton
              v-if="!expenseId && !isFromScan"
              type="button"
              variant="outline"
              @click="openScanReceipt"
              class="mt-4 px-4 py-2 rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-purple-500/5 to-indigo-500/5 hover:from-purple-500/10 hover:to-indigo-500/10 hover:border-primary/50 transition-all shadow-sm flex items-center gap-2"
            >
              <Camera class="h-4 w-4 text-purple-600" />
              <span class="text-sm font-semibold text-foreground">Scan Image/Receipt</span>
            </UiButton>
          </div>

          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 sm:px-6">
            <div class="bg-card rounded-2xl shadow-sm border border-border p-1 space-y-1">
              
              <div class="p-3">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">
                  Category / Title
                  <span v-if="isFromScan" class="text-destructive ml-1">*</span>
                </UiLabel>
                
                <!-- Dropdown for scanned receipts -->
                <CustomSelect
                  v-if="isFromScan"
                  v-model="form.title"
                  :options="categoryOptions"
                  placeholder="Select a category"
                  required
                  :disabled="expenseId && !isEditMode"
                />
                
                <!-- Text input for manual entry -->
                <UiInput 
                  v-else
                  v-model="form.title" 
                  placeholder="Groceries, Utilities…" 
                  required 
                  :disabled="expenseId && !isEditMode"
                  class="border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30 h-11" 
                />
              </div>

              <div class="p-3 pt-1">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Date</UiLabel>
                <DatePicker v-model="form.date" placeholder="Pick a date" class="w-full border-0 bg-muted/50" :disabled="expenseId && !isEditMode" />
              </div>
            </div>

            <!-- Description Field -->
            <div v-if="form.description || isEditMode || !expenseId" class="mt-4 bg-card rounded-2xl shadow-sm border border-border p-4 shrink-0">
              <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Description / Notes</UiLabel>
              <UiInput 
                v-model="form.description" 
                placeholder="Optional notes..." 
                :disabled="expenseId && !isEditMode"
                class="border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30 h-11" 
              />
            </div>

            <!-- Error Message (moved here for better visibility) -->
            <p v-if="balanceError" class="text-sm font-medium text-destructive mt-4 text-center bg-destructive/10 rounded-xl p-3">{{ balanceError }}</p>

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
                  :disabled="expenseId && !isEditMode"
                />
              </div>
            </div>

            <!-- Receipt Items Section - ONLY show when editing/viewing existing expense with receipt items -->
            <ReceiptItemsSection
              v-if="props.expenseId && form.receipt_items"
              :receipt-items="form.receipt_items"
            />
          </div>

          <!-- Actions -->
          <div class="p-4 bg-background border-t border-border flex items-center gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <!-- VIEW MODE (existing expense) - Show only Edit button -->
            <template v-if="expenseId && !isEditMode">
              <UiButton type="button" variant="secondary" class="flex-1 font-semibold" @click="enableEditMode">
                Edit
              </UiButton>
            </template>

            <!-- EDIT MODE or NEW EXPENSE - Show Cancel and Save buttons -->
            <template v-else>
              <UiButton type="button" variant="secondary" class="flex-1 font-semibold" @click="cancelEdit" :disabled="store.loading">
                Cancel
              </UiButton>
              <UiButton type="submit" class="flex-1 font-bold" :disabled="store.loading" :loading="store.loading">
                {{ store.loading ? 'Saving…' : (expenseId ? 'Save changes' : 'Save Expense') }}
              </UiButton>
            </template>
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

    <!-- Scan Receipt Modal -->
    <ScanReceiptModal
      :show="showScanReceipt"
      @close="showScanReceipt = false"
      @scanned="handleScanned"
    />
  </Teleport>
</template>
