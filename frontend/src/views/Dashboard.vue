<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useNotesStore } from '@/stores/notes.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { NotebookPen, Receipt, FolderOpen, TrendingUp, TrendingDown, Banknote } from 'lucide-vue-next'
import UiCard from '@/components/ui/Card.vue'
import UiCardHeader from '@/components/ui/CardHeader.vue'
import UiCardTitle from '@/components/ui/CardTitle.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import UiButton from '@/components/ui/Button.vue'
import DepositSalaryModal from '@/components/financial/DepositSalaryModal.vue'
import { formatCurrency } from '@/lib/utils'

const auth = useAuthStore()
const notes = useNotesStore()
const expenses = useExpensesStore()
const dashboard = useDashboardStore()
const showDepositModal = ref(false)

const handleDepositSuccess = async () => {
  await dashboard.fetchStats()
}

onMounted(async () => {
  await Promise.all([
    dashboard.fetchStats(),
    notes.fetchAll(),
    expenses.fetchAll(),
  ])
})

const stats = computed(() => {
  const baseStats = []

  // Use either the actual income deposited or the target salary setting
  const salary = parseFloat(auth.user?.monthly_salary ?? 0)
  const incomeTotal = parseFloat(dashboard.stats.income_total ?? 0)
  const expensesTotal = parseFloat(dashboard.stats.expenses_total ?? 0)
  const effectiveBudget = salary

  if (effectiveBudget > 0) {
    const remaining = effectiveBudget - expensesTotal
    baseStats.push({
      label: 'Budget Left',
      value: formatCurrency(remaining),
      icon: Banknote,
      bg: remaining < 0 ? 'bg-gradient-to-br from-rose-500 to-red-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600',
    })
  }

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
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Good day, {{ auth.user?.name?.split(' ')[0] }} 👋
        </h1>
        <p class="text-sm text-muted-foreground mt-1">Here's your Pamilya Hub overview</p>
      </div>
      <UiButton 
        v-if="parseFloat(auth.user?.monthly_salary) > 0" 
        @click="showDepositModal = true"
        class="rounded-2xl h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20 gap-2 shrink-0"
      >
        <Banknote class="h-5 w-5" /> Deposit Salary
      </UiButton>
    </div>

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

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <UiCard>
        <UiCardHeader>
          <UiCardTitle class="text-sm">Recent Notes</UiCardTitle>
        </UiCardHeader>
        <UiCardContent>
          <p v-if="notes.notes.length === 0" class="text-sm text-muted-foreground">No notes yet.</p>
          <div v-else class="space-y-2">
            <div
              v-for="note in notes.notes.slice(0, 5)"
              :key="note.id"
              class="rounded-lg bg-muted/50 px-3 py-2.5"
            >
              <p class="text-sm font-medium leading-none mb-1">{{ note.title }}</p>
              <p class="text-xs text-muted-foreground line-clamp-1">{{ note.content }}</p>
            </div>
          </div>
        </UiCardContent>
      </UiCard>

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
              <span class="text-sm font-semibold tabular-nums">{{ formatCurrency(expense.amount) }}</span>
            </div>
          </div>
        </UiCardContent>
      </UiCard>
    </div>

    <DepositSalaryModal 
      :show="showDepositModal" 
      @close="showDepositModal = false" 
      @success="handleDepositSuccess" 
    />
  </div>
</template>
