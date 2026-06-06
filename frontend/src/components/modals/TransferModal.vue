<script setup>
import { ref, computed, watch } from 'vue'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { X, ArrowRightLeft, ChevronDown, Check } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import DatePicker from '@/components/ui/DatePicker.vue'
import { formatCurrency, parseCurrency, parseExpenseAmount } from '@/utils/format'
import { shouldFetchFromServer } from '@/lib/syncEngine.js'
import { transferService } from '@/services/transferService.js'
import { getWalletIconUrl } from '@/lib/walletIcons.js'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'
import CustomSelect from '@/components/shared/CustomSelect.vue'
import { useToast } from '@/composables/useToast.js'

const props = defineProps({
  show: Boolean,
  selectedMonth: { type: Number, default: () => new Date().getMonth() + 1 },
  selectedYear: { type: Number, default: () => new Date().getFullYear() }
})

const emit = defineEmits(['close'])

const walletsStore = useWalletsStore()
const dashboard = useDashboardStore()
const expensesStore = useExpensesStore()
const toast = useToast()

const form = ref({ amount: '', from_wallet_id: null, to_wallet_id: null, description: '', date: '' })
const balanceError = ref('')
const loading = ref(false)

const walletOptions = computed(() => {
  return walletsStore.wallets.map(w => ({
    value: w.id,
    label: `${w.name} (${formatCurrency(w.balance)})`
  }))
})

watch(() => props.show, (val) => {
  if (val) {
    balanceError.value = ''
    form.value = {
      amount: '',
      from_wallet_id: null,
      to_wallet_id: null,
      description: '',
      date: new Date().toISOString().slice(0, 10),
    }
  }
})

async function submit() {
  balanceError.value = ''
  if (!form.value.from_wallet_id || !form.value.to_wallet_id) {
    balanceError.value = 'Please select both source and destination wallets.'
    return
  }
  if (form.value.from_wallet_id === form.value.to_wallet_id) {
    balanceError.value = 'Source and destination wallets must be different.'
    return
  }

  const newAmount = parseCurrency(form.value.amount)
  if (newAmount <= 0) {
    balanceError.value = 'Amount must be greater than zero.'
    return
  }
  
  const fromWallet = walletsStore.wallets.find(w => String(w.id) === String(form.value.from_wallet_id))
  if (fromWallet) {
    const available = parseFloat(fromWallet.balance)
    if (newAmount > available) {
      balanceError.value = `Insufficient balance. ${fromWallet.name} only has ${formatCurrency(fromWallet.balance)}.`
      return
    }
  }

  try {
    loading.value = true
    const data = { ...form.value, amount: newAmount }
    
    await walletsStore.createTransfer(data)
    
    toast.wallet('Transfer Successful', `Moved ${formatCurrency(newAmount)}`)
    emit('close')
  } catch (error) {
    console.error('Transfer failed:', error)
    balanceError.value = error.response?.data?.message || 'Failed to process transfer.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4 animate-in fade-in duration-200" @mousedown.self="emit('close')">
      <UiCard class="flex w-full max-w-none flex-col overflow-hidden bg-background shadow-2xl border-0
        max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300
        sm:animate-in sm:zoom-in-95 sm:duration-200
        max-sm:h-[85dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-t-3xl max-sm:rounded-b-none
        sm:max-h-[90vh] sm:min-h-0 sm:max-w-md sm:rounded-3xl" @mousedown.stop>
        
        <form id="transfer-form" @submit.prevent="submit" class="flex flex-col h-full overflow-hidden">
          <!-- Header -->
          <div class="relative shrink-0 pt-8 pb-4 flex flex-col items-center">
            <UiButton type="button" variant="ghost" size="icon" @click="emit('close')" class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors">
              <X class="h-5 w-5 text-muted-foreground" />
            </UiButton>
            
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm mb-3">
              <ArrowRightLeft class="h-6 w-6 text-indigo-500" />
            </div>

            <p class="text-sm font-medium text-muted-foreground">
              New Transfer
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
            <div class="bg-card rounded-2xl shadow-sm border border-border p-1 space-y-1">
              
              <div class="p-3 border-b border-border/50">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">From Wallet</UiLabel>
                <CustomSelect
                  v-model="form.from_wallet_id"
                  :options="walletOptions"
                  placeholder="Select source wallet"
                />
              </div>
              
              <div class="p-3 border-b border-border/50">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">To Wallet</UiLabel>
                <CustomSelect
                  v-model="form.to_wallet_id"
                  :options="walletOptions"
                  placeholder="Select destination wallet"
                />
              </div>

              <div class="p-3 border-b border-border/50">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Note (Optional)</UiLabel>
                <UiInput v-model="form.description" placeholder="Transfer description..." class="border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30 h-11" />
              </div>

              <div class="p-3 pt-1">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Date</UiLabel>
                <DatePicker v-model="form.date" placeholder="Pick a date" class="w-full border-0 bg-muted/50" />
              </div>
            </div>
            
            <p v-if="balanceError" class="text-sm font-medium text-destructive mt-4 text-center bg-destructive/10 rounded-xl p-3">{{ balanceError }}</p>
          </div>

          <!-- Actions -->
          <div class="p-4 bg-background border-t border-border flex items-center gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <UiButton type="button" variant="secondary" class="flex-1 font-semibold" @click="emit('close')" :disabled="loading">
              Cancel
            </UiButton>
            <UiButton type="submit" class="flex-1 font-bold shadow-sm" :disabled="loading" :loading="loading">
              {{ loading ? 'Transferring...' : 'Transfer' }}
            </UiButton>
          </div>
        </form>
      </UiCard>
    </div>
  </Teleport>
</template>
