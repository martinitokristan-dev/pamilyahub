<script setup>
import { ref, computed, watch } from 'vue'
import { useWalletsStore } from '@/stores/wallets'
import { useSalaryStore } from '@/stores/salary'
import {
  Wallet, X, CheckCircle2, AlertCircle, ChevronRight, ArrowRight, Banknote, ArrowLeft
} from 'lucide-vue-next'
import AppBackButton from '@/components/AppBackButton.vue'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import { formatCurrency, parseCurrency } from '@/utils/format'
import { getWalletIconUrl } from '@/lib/walletIcons.js'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'

const props = defineProps({
  show:     Boolean,
  walletId: { type: [String, Number], default: null },
  isAddMore: { type: Boolean, default: false }, // true when "Deposit More" was clicked
})
const emit = defineEmits(['close', 'success'])

const walletsStore = useWalletsStore()
const salaryStore  = useSalaryStore()

// ── Step management ─────────────────────────────────────────────────────────
const step    = ref(1) // 1 = Amount, 2 = Distribution
const loading = ref(false)
const error   = ref('')

// ── Step 1 fields ────────────────────────────────────────────────────────────
const totalSalaryRaw  = ref('')   // raw string from input
const alreadySpentRaw = ref('')   // raw string from input
const notes           = ref('')

const totalSalary  = computed(() => parseCurrency(totalSalaryRaw.value)  || parseFloat(totalSalaryRaw.value)  || 0)
const alreadySpent = computed(() => parseCurrency(alreadySpentRaw.value) || parseFloat(alreadySpentRaw.value) || 0)
const available    = computed(() => Math.max(0, totalSalary.value - alreadySpent.value))

// ── Step 2 fields ────────────────────────────────────────────────────────────
const allocations = ref([]) // [{ wallet_id, name, type, icon_url, amount: string }]

const totalAllocated = computed(() =>
  allocations.value.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
)
const remaining = computed(() => available.value - totalAllocated.value)
const isFullyAllocated = computed(() => Math.abs(remaining.value) < 0.005)

// ── Modal title ──────────────────────────────────────────────────────────────
const title = computed(() =>
  props.isAddMore ? 'Add Funds' : 'Deposit Salary'
)

// ── Initialise when modal opens ──────────────────────────────────────────────
watch(() => props.show, (val) => {
  if (val) {
    step.value          = 1
    error.value         = ''
    totalSalaryRaw.value = ''
    alreadySpentRaw.value = ''
    notes.value         = ''
    allocations.value   = []
  }
})

// ── Auto-distribute when entering step 2 ────────────────────────────────────
function buildAllocations() {
  const wallets = walletsStore.wallets
  if (!wallets.length) {
    allocations.value = []
    return
  }
  // No longer auto-distributing evenly. Users must manually enter amounts.
  allocations.value = wallets.map(w => ({
    wallet_id: w.id,
    name:      w.name,
    type:      w.type,
    icon_url:  w.icon_url,
    amount:    '',
  }))
}

// ── Navigation ───────────────────────────────────────────────────────────────
function goToStep2() {
  if (totalSalary.value <= 0) {
    error.value = 'Please enter the total salary amount received.'
    return
  }
  if (alreadySpent.value >= totalSalary.value) {
    error.value = 'Already spent amount must be less than the total salary.'
    return
  }
  error.value = ''
  buildAllocations()
  step.value = 2
}

function goBack() {
  step.value  = 1
  error.value = ''
}

// ── Confirm deposit ──────────────────────────────────────────────────────────
async function handleConfirm() {
  if (!isFullyAllocated.value) {
    const diff = Math.abs(remaining.value)
    error.value = remaining.value > 0
      ? `${formatCurrency(diff)} still unallocated. Adjust wallet amounts to continue.`
      : `Over-allocated by ${formatCurrency(diff)}. Reduce wallet amounts.`
    return
  }

  loading.value = true
  error.value   = ''

  try {
    await salaryStore.deposit({
      total_amount:  parseCurrency(totalSalaryRaw.value) || totalSalary.value,
      already_spent: parseCurrency(alreadySpentRaw.value) || alreadySpent.value,
      notes:         notes.value || null,
      allocations:   allocations.value
        .filter(a => parseFloat(a.amount) > 0)
        .map(a => ({ wallet_id: a.wallet_id, amount: parseFloat(a.amount) })),
    })
    emit('success')
    emit('close')
  } catch (err) {
    console.error('Deposit error:', err)
    error.value = err.response?.data?.message || 'Failed to deposit salary.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4 animate-in fade-in duration-200" @mousedown.self="emit('close')">
      <UiCard
        class="flex w-full max-w-none flex-col overflow-hidden bg-background shadow-2xl border-0
          max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300
          sm:animate-in sm:zoom-in-95 sm:duration-200
          max-sm:h-[85dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-t-3xl max-sm:rounded-b-none
          sm:max-h-[90vh] sm:min-h-0 sm:max-w-md sm:rounded-3xl"
        @mousedown.stop
      >
        <div class="flex flex-col h-full overflow-hidden">
          <!-- ── Header Step 1 ── -->
          <div v-if="step === 1" class="relative shrink-0 pt-8 pb-4 flex flex-col items-center">
            <UiButton type="button" variant="ghost" size="icon" @click="emit('close')" class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors">
              <X class="h-5 w-5 text-muted-foreground" />
            </UiButton>
            
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm mb-3">
              <Banknote class="h-6 w-6 text-emerald-500" />
            </div>

            <p class="text-sm font-medium text-muted-foreground">
              {{ title }}
            </p>
            
            <div class="mt-4 flex flex-col items-center justify-center w-full px-8 relative overflow-hidden">
              <UiLabel class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Salary Received</UiLabel>
              <div class="flex items-center justify-center gap-1 border-b-2 border-muted-foreground/30 focus-within:border-emerald-500 pb-2 transition-colors min-w-[140px] max-w-full">
                <span class="text-3xl font-semibold text-emerald-500 shrink-0 leading-none mt-1">₱</span>
                <input 
                  v-model="totalSalaryRaw" 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  placeholder="0.00" 
                  required
                  :style="{ width: Math.max(String(totalSalaryRaw || '').length, 3) + 'ch' }"
                  class="bg-transparent text-center text-5xl font-bold tracking-tight outline-none focus:ring-0 p-0 leading-none placeholder:text-muted-foreground/30 text-emerald-500"
                  @focus="$event.target.select()"
                />
              </div>
            </div>
          </div>

          <!-- ── Header Step 2 ── -->
          <div v-if="step === 2" class="relative shrink-0 pt-8 pb-4 flex flex-col items-center">
            <UiButton type="button" variant="ghost" size="icon" @click="emit('close')" class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors">
              <X class="h-5 w-5 text-muted-foreground" />
            </UiButton>

            <UiButton type="button" variant="ghost" size="icon" @click="goBack" class="absolute left-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors" title="Back">
              <ArrowLeft class="h-5 w-5 text-muted-foreground" />
            </UiButton>
            
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm mb-3">
              <Wallet class="h-6 w-6 text-emerald-500" />
            </div>

            <p class="text-sm font-medium text-muted-foreground">
              Distribute
            </p>
            
            <div class="mt-4 flex flex-col items-center justify-center w-full px-8 relative overflow-hidden">
              <div class="flex items-center justify-center gap-1 border-b-2 border-transparent pb-2 transition-colors min-w-[140px] max-w-full">
                <span class="bg-transparent text-center text-5xl font-bold tracking-tight outline-none focus:ring-0 p-0 leading-none text-emerald-500">
                  {{ formatCurrency(available) }}
                </span>
              </div>
            </div>
          </div>

          <!-- ── Error Banner ── -->
          <div
            v-if="error"
            class="mx-4 sm:mx-6 mt-4 shrink-0 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3"
          >
            <AlertCircle class="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p class="text-sm text-destructive font-medium">{{ error }}</p>
          </div>

          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 sm:px-6 overscroll-contain">
            
            <!-- ══════════════════════════════════════════════════════════ -->
            <!-- STEP 1 — Amounts                                          -->
            <!-- ══════════════════════════════════════════════════════════ -->
            <div v-if="step === 1" class="space-y-4 pt-2">
              <div class="bg-card rounded-2xl shadow-sm border border-border overflow-hidden p-1 space-y-1">
                <div class="p-3">
                  <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">
                    Already Spent Before Deposit
                    <span class="ml-1 font-normal lowercase">(optional)</span>
                  </UiLabel>
                  <div class="flex items-center gap-2 border-b-2 border-muted-foreground/20 focus-within:border-emerald-500 pb-2 transition-colors">
                    <span class="text-3xl font-semibold text-muted-foreground shrink-0 leading-none mt-1">₱</span>
                    <input 
                      v-model="alreadySpentRaw" 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      placeholder="0.00" 
                      class="bg-transparent text-4xl font-bold tracking-tight outline-none focus:ring-0 p-0 leading-none placeholder:text-muted-foreground/30 w-full"
                      @focus="$event.target.select()"
                    />
                  </div>
                  <p class="text-[11px] text-muted-foreground leading-relaxed mt-2">
                    If you spent some salary before depositing, enter it here. It will count towards this month's spending.
                  </p>
                </div>
                
                <div class="p-3 pt-1">
                  <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Notes <span class="font-normal">(optional)</span></UiLabel>
                  <UiInput v-model="notes" placeholder="e.g. May 2026 salary" class="border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-emerald-500/30 h-11" />
                </div>
              </div>

              <!-- Available to distribute -->
              <div
                class="rounded-2xl border-2 p-4 transition-all duration-200"
                :class="available > 0
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-muted bg-muted/30'"
              >
                <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Available to Distribute
                </p>
                <p class="text-2xl font-black tabular-nums">
                  <CurrencyAmount :amount="available" :type="available > 0 ? 'income' : 'muted'" />
                </p>
                <p v-if="totalSalary > 0 && alreadySpent > 0" class="text-xs text-muted-foreground mt-1">
                  <CurrencyAmount :amount="totalSalary" type="muted" /> − <CurrencyAmount :amount="alreadySpent" type="muted" /> already spent
                </p>
              </div>
            </div>

            <!-- ══════════════════════════════════════════════════════════ -->
            <!-- STEP 2 — Wallet Distribution                              -->
            <!-- ══════════════════════════════════════════════════════════ -->
            <div v-else class="space-y-4 pt-2">
              <p class="text-sm text-muted-foreground text-center mb-4">
                Adjust amounts to distribute your available salary across your wallets.
              </p>

              <!-- Wallet rows -->
              <div class="space-y-2.5">
                <div
                  v-for="alloc in allocations"
                  :key="alloc.wallet_id"
                  class="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card shadow-sm transition-all"
                >
                  <div class="h-10 w-10 rounded-xl bg-background flex items-center justify-center shrink-0 border border-border overflow-hidden">
                    <img 
                        :src="getWalletIconUrl(alloc)" 
                        class="w-full h-full object-contain rounded"
                        @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                    />
                    <Wallet style="display:none" class="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold truncate">{{ alloc.name }}</p>
                    <p class="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Allocation</p>
                  </div>
                  <div class="w-32">
                    <UiInput
                      v-model="alloc.amount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      class="h-10 text-right font-bold tabular-nums border-muted bg-muted/50 focus-visible:ring-emerald-500/30"
                      @focus="$event.target.select()"
                    />
                  </div>
                </div>
              </div>

              <!-- Running total -->
              <div
                class="rounded-2xl border-2 p-4 transition-all duration-200 mt-4"
                :class="{
                  'border-emerald-500/40 bg-emerald-500/5': isFullyAllocated,
                  'border-amber-500/40 bg-amber-500/5': !isFullyAllocated && remaining > 0,
                  'border-destructive/40 bg-destructive/5': remaining < -0.005,
                }"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Distributed</p>
                    <CurrencyAmount :amount="totalAllocated" type="neutral" class="text-lg font-black tabular-nums" />
                  </div>
                  <div class="text-right">
                    <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                      {{ remaining >= 0 ? 'Remaining' : 'Over by' }}
                    </p>
                    <CurrencyAmount
                      :amount="Math.abs(remaining)"
                      :type="isFullyAllocated ? 'income' : (remaining < -0.005 ? 'expense' : 'neutral')"
                      class="text-lg font-black tabular-nums"
                      :class="{ '!text-amber-600 dark:!text-amber-400': !isFullyAllocated && remaining > 0 }"
                    />
                  </div>
                </div>

                <div v-if="isFullyAllocated" class="mt-2 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 class="h-4 w-4" />
                  <span class="text-xs font-bold">Fully allocated — ready to confirm</span>
                </div>
                <div v-else-if="remaining > 0" class="mt-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  <CurrencyAmount :amount="remaining" type="neutral" class="!text-amber-700 dark:!text-amber-400" /> still unallocated. Adjust wallet amounts to continue.
                </div>
                <div v-else class="mt-2 text-xs text-destructive font-medium">
                  Over-allocated by <CurrencyAmount :amount="Math.abs(remaining)" type="expense" />. Reduce wallet amounts.
                </div>
              </div>

            </div>
          </div>

          <!-- ── Footer ── -->
          <div class="p-4 bg-background border-t border-border flex items-center gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <UiButton type="button" variant="secondary" class="flex-1 font-semibold" @click="emit('close')" :disabled="loading">
              Cancel
            </UiButton>

            <!-- Step 1: Next -->
            <UiButton
              v-if="step === 1"
              @click="goToStep2"
              :disabled="totalSalary <= 0"
              class="flex-1 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Next — Distribute
            </UiButton>

            <!-- Step 2: Confirm -->
            <UiButton
              v-else
              @click="handleConfirm"
              :disabled="loading || !isFullyAllocated"
              :loading="loading"
              class="flex-1 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {{ loading ? 'Depositing…' : 'Confirm Deposit' }}
            </UiButton>
          </div>
        </div>
      </UiCard>
    </div>
  </Teleport>
</template>
