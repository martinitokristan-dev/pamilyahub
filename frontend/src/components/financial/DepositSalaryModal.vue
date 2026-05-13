<script setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useWalletsStore } from '@/stores/wallets'
import { useDashboardStore } from '@/stores/dashboard'
import { useToast } from '@/composables/useToast'
import { Wallet, Plus, X, CheckCircle2, AlertCircle } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import { incomeService } from '@/services/incomeService'
import { formatCurrency } from '@/lib/utils'

const props = defineProps({
  show: Boolean
})
const emit = defineEmits(['close', 'success'])

const authStore = useAuthStore()
const walletsStore = useWalletsStore()
const dashboardStore = useDashboardStore()
const loading = ref(false)
const error = ref('')

const salary = computed(() => parseFloat(authStore.user?.monthly_salary || 0))
const baseRemaining = computed(() => dashboardStore.stats?.remaining_salary ?? salary.value)
const deposits = ref([])

// Initialize deposits when modal opens
watch(() => props.show, async (newVal) => {
  if (newVal) {
    error.value = ''
    deposits.value = walletsStore.wallets.map(w => ({
      wallet_id: w.id,
      name: w.name,
      amount: 0
    }))

    // Force a fresh fetch of the dashboard stats every time the modal opens
    dashboardStore.invalidate()
    await dashboardStore.fetchStats()
  }
})

const totalDeposited = computed(() => 
  deposits.value.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
)

const remaining = computed(() => baseRemaining.value - totalDeposited.value)

async function handleDeposit() {
  if (totalDeposited.value === 0) {
    error.value = "Please allocate some amount."
    return
  }

  loading.value = true
  error.value = ''
  
  try {
    const activeDeposits = deposits.value
      .filter(d => parseFloat(d.amount) > 0)
      .map(d => ({ wallet_id: d.wallet_id, amount: parseFloat(d.amount) }))
      
    await incomeService.depositSalary(activeDeposits)
    await walletsStore.fetchAll(true) // Refresh wallet balances
    await dashboardStore.fetchStats() // Re-fetch the remaining salary!
    useToast().success("Salary deposited successfully!")
    emit('success')
    emit('close')
  } catch (err) {
    console.error('Deposit salary error:', err)
    error.value = err.response?.data?.message || "Failed to deposit salary."
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" @mousedown.self="emit('close')">
      <UiCard class="w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 rounded-2xl overflow-hidden bg-card">
        <div class="p-6 border-b border-border bg-gradient-to-r from-emerald-600/10 to-transparent">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-xl font-bold tracking-tight">Deposit Monthly Salary</h2>
            <UiButton variant="ghost" size="icon" @click="emit('close')" class="rounded-full h-8 w-8">
              <X class="h-4 w-4" />
            </UiButton>
          </div>
          <div class="flex items-center gap-2">
            <div class="bg-emerald-100 dark:bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/20">
              <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Salary: {{ formatCurrency(salary) }}</span>
            </div>
            <div v-if="remaining !== 0" :class="remaining > 0 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' : 'bg-destructive/10 text-destructive'" class="px-3 py-1 rounded-full border border-current/20">
              <span class="text-xs font-bold uppercase tracking-wider">
                {{ remaining > 0 ? 'Remaining' : 'Over' }}: {{ formatCurrency(Math.abs(remaining)) }}
              </span>
            </div>
            <div v-else class="bg-blue-100 dark:bg-blue-500/20 text-blue-600 px-3 py-1 rounded-full border border-blue-500/20">
              <span class="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 class="h-3 w-3" /> Fully Allocated
              </span>
            </div>
          </div>
        </div>

        <UiCardContent class="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div v-if="error" class="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
            <AlertCircle class="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <p class="text-sm text-destructive font-medium">{{ error }}</p>
          </div>

          <div class="space-y-3">
            <div v-for="wallet in deposits" :key="wallet.wallet_id" class="flex items-center gap-4 p-3 rounded-2xl border border-border bg-muted/30 transition-all hover:bg-muted/50">
              <div class="h-10 w-10 rounded-xl bg-background flex items-center justify-center shrink-0 border border-border shadow-sm">
                <Wallet class="h-5 w-5 text-muted-foreground" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate">{{ wallet.name }}</p>
                <p class="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Allocation</p>
              </div>
              <div class="w-32">
                <UiInput 
                  v-model="wallet.amount" 
                  type="number" 
                  placeholder="0.00" 
                  class="h-10 text-right font-bold tabular-nums"
                  @focus="$event.target.select()"
                />
              </div>
            </div>
          </div>
        </UiCardContent>

        <div class="p-6 bg-muted/30 border-t border-border flex flex-col sm:flex-row gap-3">
          <div class="flex-1">
            <p class="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Total to Deposit</p>
            <p class="text-xl font-black tabular-nums">{{ formatCurrency(totalDeposited) }}</p>
          </div>
          <div class="flex gap-2">
            <UiButton variant="outline" @click="emit('close')" class="rounded-xl h-12 px-6">Cancel</UiButton>
            <UiButton 
              @click="handleDeposit" 
              :disabled="loading || totalDeposited <= 0" 
              class="rounded-xl h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {{ loading ? 'Depositing...' : 'Confirm Deposit' }}
            </UiButton>
          </div>
        </div>
      </UiCard>
    </div>
  </Teleport>
</template>
