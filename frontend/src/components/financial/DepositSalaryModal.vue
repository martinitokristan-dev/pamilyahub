<script setup>
import { ref, computed, watch } from 'vue'
import { useWalletsStore } from '@/stores/wallets'
import { useDashboardStore } from '@/stores/dashboard'
import { useSalaryStore } from '@/stores/salary'
import { useToast } from '@/composables/useToast'
import {
  Wallet, X, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, ArrowRight
} from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import { salaryService } from '@/services/salaryService.js'
import { formatCurrency, parseCurrency } from '@/utils/format'

const props = defineProps({
  show:     Boolean,
  isAddMore: { type: Boolean, default: false }, // true when "Deposit More" was clicked
})
const emit = defineEmits(['close', 'success'])

const walletsStore   = useWalletsStore()
const dashboardStore = useDashboardStore()
const salaryStore    = useSalaryStore()
const { success: toastSuccess } = useToast()

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
    await salaryService.deposit({
      total_amount:  parseCurrency(totalSalaryRaw.value) || totalSalary.value,
      already_spent: parseCurrency(alreadySpentRaw.value) || alreadySpent.value,
      notes:         notes.value || null,
      allocations:   allocations.value
        .filter(a => parseFloat(a.amount) > 0)
        .map(a => ({ wallet_id: a.wallet_id, amount: parseFloat(a.amount) })),
    })

    // Invalidate all relevant stores
    walletsStore.invalidate()
    dashboardStore.invalidate()
    salaryStore.invalidate()
    import('@/stores/expenses').then(m => m.useExpensesStore().invalidate())
    await salaryStore.fetchCurrentMonth()

    toastSuccess('Salary deposited successfully!')
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
    <div
      v-if="show"
      class="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4"
      @mousedown.self="emit('close')"
    >
      <UiCard
        class="flex w-full max-w-none flex-col overflow-hidden bg-card shadow-2xl animate-in fade-in zoom-in duration-200
          max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-none max-sm:pt-[env(safe-area-inset-top)]
          sm:max-h-[90vh] sm:min-h-0 sm:max-w-lg sm:rounded-2xl"
        @mousedown.stop
      >

        <!-- ── Header ── -->
        <div class="shrink-0 p-6 border-b border-border bg-gradient-to-r from-emerald-600/10 to-transparent">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <button
                v-if="step === 2"
                @click="goBack"
                class="rounded-full p-1.5 hover:bg-muted transition-colors"
              >
                <ChevronLeft class="h-4 w-4" />
              </button>
              <div>
                <h2 class="text-xl font-bold tracking-tight">{{ title }}</h2>
                <p class="text-xs text-muted-foreground mt-0.5">
                  Step {{ step }} of 2 — {{ step === 1 ? 'Enter amounts' : 'Distribute to wallets' }}
                </p>
              </div>
            </div>
            <UiButton variant="ghost" size="icon" @click="emit('close')" class="rounded-full h-8 w-8">
              <X class="h-4 w-4" />
            </UiButton>
          </div>

          <!-- Step indicators -->
          <div class="flex gap-2 mt-1">
            <div class="h-1 flex-1 rounded-full transition-all duration-300"
              :class="step >= 1 ? 'bg-emerald-500' : 'bg-muted'" />
            <div class="h-1 flex-1 rounded-full transition-all duration-300"
              :class="step >= 2 ? 'bg-emerald-500' : 'bg-muted'" />
          </div>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        <!-- ── Error Banner ── -->
        <div
          v-if="error"
          class="mx-6 mt-4 shrink-0 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3"
        >
          <AlertCircle class="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p class="text-sm text-destructive font-medium">{{ error }}</p>
        </div>

        <!-- ══════════════════════════════════════════════════════════ -->
        <!-- STEP 1 — Amounts                                          -->
        <!-- ══════════════════════════════════════════════════════════ -->
        <UiCardContent v-if="step === 1" class="p-6 space-y-5">

          <!-- Total Salary -->
          <div class="space-y-1.5">
            <UiLabel class="font-semibold">Total Salary Received</UiLabel>
            <UiInput
              v-model="totalSalaryRaw"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 50000"
              class="h-12 text-lg font-bold tabular-nums"
              @focus="$event.target.select()"
            />
          </div>

          <!-- Already Spent -->
          <div class="space-y-1.5">
            <UiLabel class="font-semibold">
              Already Spent Before This Deposit
              <span class="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
            </UiLabel>
            <UiInput
              v-model="alreadySpentRaw"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 18000"
              class="h-12 text-lg font-bold tabular-nums"
              @focus="$event.target.select()"
            />
            <p class="text-xs text-muted-foreground leading-relaxed">
              If you already spent some of your salary before depositing, enter that amount here.
              It will count towards this month's spending.
            </p>
          </div>

          <!-- Available to distribute (live) -->
          <div
            class="rounded-2xl border-2 p-4 transition-all duration-200"
            :class="available > 0
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-muted bg-muted/30'"
          >
            <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
              Available to Distribute
            </p>
            <p class="text-2xl font-black tabular-nums"
              :class="available > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'"
            >
              {{ formatCurrency(available) }}
            </p>
            <p v-if="totalSalary > 0 && alreadySpent > 0" class="text-xs text-muted-foreground mt-1">
              {{ formatCurrency(totalSalary) }} − {{ formatCurrency(alreadySpent) }} already spent
            </p>
          </div>

          <!-- Optional notes -->
          <div class="space-y-1.5">
            <UiLabel class="text-xs text-muted-foreground">Notes <span class="font-normal">(optional)</span></UiLabel>
            <UiInput v-model="notes" placeholder="e.g. May 2026 salary" class="h-10" />
          </div>

        </UiCardContent>

        <!-- ══════════════════════════════════════════════════════════ -->
        <!-- STEP 2 — Wallet Distribution                              -->
        <!-- ══════════════════════════════════════════════════════════ -->
        <UiCardContent v-else class="p-6 space-y-4">

          <p class="text-sm text-muted-foreground">
            Distribute <span class="font-bold text-foreground">{{ formatCurrency(available) }}</span>
            across your wallets. Adjust amounts as needed.
          </p>

          <!-- Wallet rows -->
          <div class="space-y-2.5">
            <div
              v-for="alloc in allocations"
              :key="alloc.wallet_id"
              class="flex items-center gap-3 p-3 rounded-2xl border border-border bg-muted/30 hover:bg-muted/50 transition-all"
            >
              <div class="h-10 w-10 rounded-xl bg-background flex items-center justify-center shrink-0 border border-border shadow-sm overflow-hidden">
                <img 
                    :src="alloc.icon_url || `/icons/wallets/${alloc.type === 'metrobank' ? 'metrobank.jpg' : alloc.type + '.png'}`" 
                    class="w-full h-full object-contain rounded"
                    @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                />
                <Wallet style="display:none" class="h-5 w-5 text-muted-foreground" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate">{{ alloc.name }}</p>
                <p class="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Allocation</p>
              </div>
              <div class="w-36">
                <UiInput
                  v-model="alloc.amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="h-10 text-right font-bold tabular-nums"
                  @focus="$event.target.select()"
                />
              </div>
            </div>
          </div>

          <!-- Running total -->
          <div
            class="rounded-2xl border-2 p-4 transition-all duration-200"
            :class="{
              'border-emerald-500/40 bg-emerald-500/5': isFullyAllocated,
              'border-amber-500/40 bg-amber-500/5': !isFullyAllocated && remaining > 0,
              'border-destructive/40 bg-destructive/5': remaining < -0.005,
            }"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Distributed</p>
                <p class="text-lg font-black tabular-nums">{{ formatCurrency(totalAllocated) }}</p>
              </div>
              <div class="text-right">
                <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                  {{ remaining >= 0 ? 'Remaining' : 'Over by' }}
                </p>
                <p class="text-lg font-black tabular-nums"
                  :class="{
                    'text-emerald-600 dark:text-emerald-400': isFullyAllocated,
                    'text-amber-600 dark:text-amber-400': !isFullyAllocated && remaining > 0,
                    'text-destructive': remaining < -0.005,
                  }"
                >
                  {{ formatCurrency(Math.abs(remaining)) }}
                </p>
              </div>
            </div>

            <div v-if="isFullyAllocated" class="mt-2 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 class="h-4 w-4" />
              <span class="text-xs font-bold">Fully allocated — ready to confirm</span>
            </div>
            <div v-else-if="remaining > 0" class="mt-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
              {{ formatCurrency(remaining) }} still unallocated. Adjust wallet amounts to continue.
            </div>
            <div v-else class="mt-2 text-xs text-destructive font-medium">
              Over-allocated by {{ formatCurrency(Math.abs(remaining)) }}. Reduce wallet amounts.
            </div>
          </div>

        </UiCardContent>

        </div>

        <!-- ── Footer ── -->
        <div
          class="shrink-0 border-t border-border bg-muted/20 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-3 justify-end sm:flex-row"
        >
          <UiButton variant="outline" @click="emit('close')" class="rounded-xl h-11 px-6">
            Cancel
          </UiButton>

          <!-- Step 1: Next -->
          <UiButton
            v-if="step === 1"
            @click="goToStep2"
            :disabled="totalSalary <= 0"
            class="rounded-xl h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
          >
            Next — Distribute
            <ArrowRight class="h-4 w-4" />
          </UiButton>

          <!-- Step 2: Confirm -->
          <UiButton
            v-else
            @click="handleConfirm"
            :disabled="loading || !isFullyAllocated"
            class="rounded-xl h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {{ loading ? 'Depositing...' : 'Confirm Deposit' }}
          </UiButton>
        </div>

      </UiCard>
    </div>
  </Teleport>
</template>
