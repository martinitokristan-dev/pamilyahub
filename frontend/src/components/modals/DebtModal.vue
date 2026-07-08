<script setup>
import { ref, watch, computed } from 'vue'
import { useDebtsStore } from '@/stores/debts.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { X, Trash2, Wallet, Landmark } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiTextarea from '@/components/ui/Textarea.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import DatePicker from '@/components/ui/DatePicker.vue'
import { formatCurrency, parseCurrency } from '@/utils/format'
import { shouldFetchFromServer } from '@/lib/syncEngine.js'
import { getWalletIconUrl } from '@/lib/walletIcons.js'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'
import CustomSelect from '@/components/shared/CustomSelect.vue'
import ConfirmAlert from '@/components/shared/ConfirmAlert.vue'

const props = defineProps({
  show: Boolean,
  debtId: { type: [String, Number], default: null },
  defaultType: { type: String, default: 'owed_to_me' }
})

const emit = defineEmits(['close'])

const store = useDebtsStore()
const walletsStore = useWalletsStore()
const dashboardStore = useDashboardStore()

const balanceError = ref('')
const showDeleteConfirm = ref(false)
const form = ref({
  name: '',
  amount: '',
  type: props.defaultType,
  description: '',
  due_date: '',
  wallet_id: null
})

const walletOptions = computed(() => {
  return walletsStore.wallets.map(w => ({
    value: w.id,
    label: w.name,
    subLabel: `₱${formatCurrency(w.balance)}`,
    iconUrl: getWalletIconUrl(w)
  }))
})

watch(() => props.show, (val) => {
  if (val) {
    balanceError.value = ''
    if (props.debtId) {
      const debt = store.debts.find(d => d.id === props.debtId)
      if (debt) {
        form.value = {
          name: debt.name,
          amount: formatCurrency(debt.amount),
          type: debt.type,
          description: debt.description ?? '',
          due_date: debt.due_date ?? '',
          wallet_id: debt.wallet_id ?? null
        }
      }
    } else {
      form.value = { 
        name: '', 
        amount: '', 
        type: props.defaultType, 
        description: '', 
        due_date: '', 
        wallet_id: walletsStore.wallets[0]?.id ?? null 
      }
    }
  }
})

async function submit() {
  balanceError.value = ''
  const newAmount = parseCurrency(form.value.amount)

  if (form.value.type === 'owed_to_me' && form.value.wallet_id) {
    const wallet = walletsStore.wallets.find(w => String(w.id) === String(form.value.wallet_id))
    if (wallet) {
      let oldAmount = 0
      if (props.debtId) {
        const existingDebt = store.debts.find(d => d.id === props.debtId)
        if (existingDebt && existingDebt.type === 'owed_to_me' && String(existingDebt.wallet_id) === String(form.value.wallet_id)) {
          oldAmount = parseFloat(existingDebt.amount)
        }
      }
      
      const available = parseFloat(wallet.balance) + oldAmount
      if (newAmount > available) {
        balanceError.value = `Insufficient balance. ${wallet.name} only has ${formatCurrency(wallet.balance)}.`
        return
      }
    }
  }

  const data = {
    ...form.value,
    amount: newAmount,
  }

  try {
    if (props.debtId) {
      await store.update(props.debtId, data)
    } else {
      await store.create(data)
    }
    emit('close')
    if (shouldFetchFromServer()) {
      dashboardStore.fetchStats()
    }
  } catch (e) {
    if (e.response?.data?.message) {
      balanceError.value = e.response.data.message
    } else {
      balanceError.value = 'Failed to save debt. Please check your inputs.'
    }
  }
}

function requestDelete() {
  if (!props.debtId) return
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  showDeleteConfirm.value = false
  if (!props.debtId) return
  await store.remove(props.debtId)
  emit('close')
  if (shouldFetchFromServer()) {
    dashboardStore.fetchStats()
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
        
        <form id="debt-form" @submit.prevent="submit" class="flex flex-col h-full overflow-hidden">
          <!-- Header -->
          <div class="relative shrink-0 pt-8 pb-4 flex flex-col items-center">
            <UiButton type="button" variant="ghost" size="icon" @click="emit('close')" class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors">
              <X class="h-5 w-5 text-muted-foreground" />
            </UiButton>

            <UiButton v-if="debtId" type="button" variant="ghost" size="icon" @click="requestDelete" class="absolute left-4 top-4 rounded-full h-8 w-8 bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors" title="Delete Debt">
              <Trash2 class="h-4 w-4" />
            </UiButton>
            
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm mb-3">
              <Landmark class="h-6 w-6 text-indigo-500" />
            </div>

            <p class="text-sm font-medium text-muted-foreground">
              {{ debtId ? 'Edit Debt' : 'New Debt' }}
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
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Name</UiLabel>
                <UiInput v-model="form.name" placeholder="Person's name" required class="border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30 h-11" />
              </div>
              
              <div class="p-3 pt-1">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Type</UiLabel>
                <div class="flex p-1 bg-muted/50 rounded-xl">
                  <button
                    type="button"
                    @click="form.type = 'owed_to_me'"
                    class="flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-all duration-200"
                    :class="form.type === 'owed_to_me' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                  >
                    They owe me
                  </button>
                  <button
                    type="button"
                    @click="form.type = 'i_owe'"
                    class="flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-all duration-200"
                    :class="form.type === 'i_owe' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                  >
                    I owe them
                  </button>
                </div>
              </div>
              
              <div class="p-3 pt-1">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Due Date</UiLabel>
                <DatePicker v-model="form.due_date" placeholder="Optional due date" class="w-full border-0 bg-muted/50" />
              </div>

              <div class="p-3 pt-1">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Notes</UiLabel>
                <UiInput v-model="form.description" placeholder="Optional notes…" class="border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30 h-11" />
              </div>
            </div>

            <!-- Wallet Picker (Only for Lending) -->
            <div v-if="form.type === 'owed_to_me'" class="mt-4 bg-card rounded-2xl shadow-sm border border-border p-4 shrink-0">
              <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold block mb-3">Lend from Wallet</UiLabel>
              <CustomSelect
                v-model="form.wallet_id"
                :options="walletOptions"
                placeholder="Select wallet"
              />
            </div>

            <p v-if="balanceError" class="text-sm font-medium text-destructive mt-4 text-center bg-destructive/10 rounded-xl p-3">{{ balanceError }}</p>
          </div>

          <!-- Actions -->
          <div class="p-4 bg-background border-t border-border flex items-center gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <UiButton type="button" variant="secondary" class="flex-1 font-semibold" @click="emit('close')" :disabled="store.loading">
              Cancel
            </UiButton>
            <UiButton type="submit" class="flex-1 font-bold bg-indigo-600 hover:bg-indigo-700 text-white" :disabled="store.loading" :loading="store.loading">
              {{ store.loading ? 'Saving…' : 'Save changes' }}
            </UiButton>
          </div>
        </form>
      </UiCard>
    </div>

    <ConfirmAlert
      :show="showDeleteConfirm"
      title="Delete debt?"
      message="This will permanently remove this debt record. This action cannot be undone."
      confirm-label="Delete"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirm = false"
    />
  </Teleport>
</template>
