<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useAuthStore } from '@/stores/auth.js'
import { useNotesStore } from '@/stores/notes.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { useSalaryStore } from '@/stores/salary.js'
import {
  NotebookPen, Receipt, TrendingUp, TrendingDown, Banknote, Plus
} from 'lucide-vue-next'
import UiCard from '@/components/ui/Card.vue'
import UiCardHeader from '@/components/ui/CardHeader.vue'
import UiCardTitle from '@/components/ui/CardTitle.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import UiButton from '@/components/ui/Button.vue'
import DepositSalaryModal from '@/components/financial/DepositSalaryModal.vue'
import { formatCurrency } from '@/utils/format'

const auth      = useAuthStore()
const notes     = useNotesStore()
const expenses  = useExpensesStore()
const dashboard = useDashboardStore()
const salary    = useSalaryStore()

const showDepositModal  = ref(false)
const isAddMore         = ref(false)

// Use the exact same global floating action button / plus shortcut as other pages
useRegisterAddAction(openDeposit)

function openDeposit() {
  // If already received, this acts as "Add More"
  isAddMore.value = salary.isReceived
  showDepositModal.value = true
}

const handleDepositSuccess = async () => {
  await Promise.all([dashboard.fetchStats(), salary.fetchCurrentMonth()])
}

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})

const currentDate = computed(() => {
  return new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  }).toUpperCase()
})

onMounted(async () => {
  const fetches = [dashboard.fetchStats(), salary.fetchCurrentMonth()]
  if (!notes.fetched) fetches.push(notes.fetchAll())
  await Promise.all(fetches)
})

// ── Stat cards ───────────────────────────────────────────────────────────────
const stats = computed(() => {
  const baseStats = []

  const incomeTotal   = parseFloat(dashboard.stats.income_total ?? 0)
  const expensesTotal = parseFloat(dashboard.stats.expenses_total ?? 0)
  const remaining     = parseFloat(dashboard.stats.remaining_salary ?? 0)

  baseStats.push({
    label: 'Budget Left',
    value: formatCurrency(remaining),
    icon: Banknote,
    bg: remaining < 0
      ? 'bg-gradient-to-br from-rose-500 to-red-600'
      : 'bg-gradient-to-br from-emerald-500 to-teal-600',
  })

  baseStats.push(
    {
      label: 'Notes',
      value: dashboard.stats.notes_count,
      icon: NotebookPen,
      bg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    },
    {
      label: 'Income (Monthly)',
      value: formatCurrency(incomeTotal),
      icon: TrendingUp,
      bg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
    },
    {
      label: 'Expenses (Monthly)',
      value: formatCurrency(expensesTotal),
      icon: Receipt,
      bg: 'bg-gradient-to-br from-orange-500 to-amber-500',
    },
    {
      label: 'Owed to Me',
      value: formatCurrency(dashboard.stats.debts_owed_to_me),
      icon: TrendingUp,
      bg: 'bg-gradient-to-br from-blue-400 to-blue-600',
    },
    {
      label: 'I Owe',
      value: formatCurrency(dashboard.stats.debts_i_owe),
      icon: TrendingDown,
      bg: 'bg-gradient-to-br from-rose-500 to-red-600',
    }
  )

  return baseStats
})
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto animate-fade-in">

    <!-- ── Page header ── -->
    <div class="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <!-- Mascot Greeting UI (Takes full available width on left) -->
      <div class="flex flex-col w-full relative">
        <div class="mb-3 pl-2">
          <p class="text-[11px] font-bold text-muted-foreground/80 tracking-widest uppercase mb-1">
            {{ currentDate }}
          </p>
          <h1 class="text-2xl font-medium tracking-tight text-foreground">
            {{ greeting }}, <span class="font-extrabold">{{ auth.user?.name?.split(' ')[0] }}!</span>
          </h1>
        </div>
        <div class="flex items-center gap-0 w-full relative">
          <!-- Mascot Image Container -->
          <div class="w-36 h-40 shrink-0 overflow-hidden rounded-bl-3xl z-10 flex items-start justify-center bg-transparent -ml-2">
            <img 
              src="/icons/wallets/elefam.png" 
              alt="EleFam Mascot" 
              class="w-[110%] max-w-none h-auto object-cover -translate-y-[5%] -translate-x-[6%]" 
            />
          </div>
          
          <!-- Chat Bubble (Expands to fill remaining space) -->
          <div class="bg-card border border-border shadow-sm rounded-2xl p-4 relative ml-2 z-0 flex-1 min-w-0">
            <!-- Speech bubble tail pointing to EleFam -->
            <div class="absolute top-1/2 -translate-y-1/2 -left-[7px] w-4 h-4 bg-card border-l border-b border-border rotate-45 rounded-sm"></div>
            
            <div class="relative z-10">
              <h3 class="font-bold text-emerald-600 text-sm mb-1">EleFam</h3>
              <p class="text-sm text-muted-foreground leading-snug">
                Ready to track those finances? Keep an eye on that budget before lifestyle creep sneaks in!
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Deposit Button (Aligned to the right) -->
      <div class="flex items-center justify-end sm:mb-4 shrink-0">
        <UiButton @click="openDeposit" class="hidden sm:flex h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-500/20">
          <Plus class="h-5 w-5 mr-1" /> Deposit
        </UiButton>
      </div>
    </div>

    <!-- ── Stat Cards ── -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="relative overflow-hidden rounded-2xl p-4 text-white shadow-md"
        :class="stat.bg"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="rounded-xl bg-white/20 p-2">
            <component :is="stat.icon" class="h-4 w-4 text-white" />
          </div>
        </div>
        <p class="text-xl font-bold leading-none mb-1 truncate">{{ stat.value }}</p>
        <p class="text-[11px] font-medium text-white/80 uppercase tracking-wider">{{ stat.label }}</p>
        <div class="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-white/10" />
      </div>
    </div>

    <!-- ── Bottom grid ── -->
    <div class="grid grid-cols-1 gap-6">
      <UiCard>
        <UiCardHeader>
          <UiCardTitle class="text-sm">Recent Expenses</UiCardTitle>
        </UiCardHeader>
        <UiCardContent>
          <p v-if="expenses.expenses.length === 0" class="text-sm text-muted-foreground">No expenses yet.</p>
          <div v-else class="space-y-2">
            <div
              v-for="expense in expenses.expenses.slice(0, 5)"
              :key="expense.id"
              class="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5"
            >
              <div>
                <p class="text-sm font-medium leading-none mb-1">{{ expense.title }}</p>
                <p class="text-xs text-muted-foreground">{{ expense.category ?? 'Uncategorized' }}</p>
              </div>
              <span class="text-sm font-semibold tabular-nums text-destructive">-{{ formatCurrency(expense.amount) }}</span>
            </div>
          </div>
        </UiCardContent>
      </UiCard>
    </div>

    <!-- ── Deposit Modal ── -->
    <DepositSalaryModal
      :show="showDepositModal"
      :is-add-more="isAddMore"
      @close="showDepositModal = false"
      @success="handleDepositSuccess"
    />

  </div>
</template>
