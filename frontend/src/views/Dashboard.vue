<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useNotesStore } from '@/stores/notes.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { useSalaryStore } from '@/stores/salary.js'
import {
  NotebookPen, Receipt, TrendingUp, TrendingDown, Banknote,
  CheckCircle2, Clock, Plus, AlertTriangle
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

function openPrimaryDeposit() {
  isAddMore.value      = false
  showDepositModal.value = true
}
function openAddMore() {
  isAddMore.value      = true
  showDepositModal.value = true
}

const handleDepositSuccess = async () => {
  await Promise.all([dashboard.fetchStats(), salary.fetchCurrentMonth()])
}

onMounted(async () => {
  const fetches = [dashboard.fetchStats(), salary.fetchCurrentMonth()]
  if (!notes.fetched) fetches.push(notes.fetchAll())
  await Promise.all(fetches)
})

// ── Month label ──────────────────────────────────────────────────────────────
const monthLabel = computed(() => {
  if (!salary.month || !salary.year) return ''
  return new Date(salary.year, salary.month - 1, 1)
    .toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
})

// Deposit date label for "received" state
const depositedAtLabel = computed(() => {
  const dep = salary.latestDeposit
  if (!dep) return ''
  const d = new Date(dep.deposited_at)
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
})

const hasSalarySetup = computed(() => parseFloat(auth.user?.monthly_salary ?? 0) > 0)

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
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">
          Good day, {{ auth.user?.name?.split(' ')[0] }} 👋
        </h1>
        <p class="text-sm text-muted-foreground mt-1">Here's your Pamilya Hub overview</p>
      </div>
    </div>

    <!-- ── Smart Salary Status Card ── -->
    <div v-if="hasSalarySetup && salary.fetched" class="mb-5">

      <!-- PENDING state -->
      <div
        v-if="salary.isPending"
        class="rounded-2xl border-2 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
        :class="salary.isDelayed
          ? 'border-orange-500/40 bg-gradient-to-r from-orange-500/8 to-amber-500/5'
          : 'border-amber-400/40 bg-gradient-to-r from-amber-500/8 to-yellow-500/5'"
      >
        <div class="flex items-center gap-3">
          <div
            class="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            :class="salary.isDelayed ? 'bg-orange-500/15' : 'bg-amber-500/15'"
          >
            <component
              :is="salary.isDelayed ? AlertTriangle : Clock"
              class="h-5 w-5"
              :class="salary.isDelayed ? 'text-orange-500' : 'text-amber-500'"
            />
          </div>
          <div>
            <p class="font-bold text-sm leading-tight">
              Salary Pending — {{ monthLabel }}
            </p>
            <p
              class="text-xs mt-0.5"
              :class="salary.isDelayed ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'"
            >
              <template v-if="salary.isDelayed">
                Your salary is delayed — deposit when you receive it
              </template>
              <template v-else>
                No salary deposited yet this month
              </template>
            </p>
          </div>
        </div>
        <UiButton
          @click="openPrimaryDeposit"
          class="rounded-xl h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-500/20 shrink-0 gap-2"
        >
          <Banknote class="h-4 w-4" />
          Salary Received
        </UiButton>
      </div>

      <!-- RECEIVED state -->
      <div
        v-else-if="salary.isReceived"
        class="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-500/8 to-teal-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <CheckCircle2 class="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p class="font-bold text-sm text-emerald-700 dark:text-emerald-400 leading-tight">
              Salary Deposited — {{ monthLabel }}
            </p>
            <p class="text-xs text-muted-foreground mt-0.5">
              <template v-if="salary.latestDeposit?.is_delayed">
                Deposited late — {{ depositedAtLabel }}
              </template>
              <template v-else>
                Deposited on {{ depositedAtLabel }}
              </template>
            </p>
          </div>
        </div>
        <UiButton
          @click="openAddMore"
          variant="outline"
          class="rounded-xl h-9 px-4 text-sm font-semibold shrink-0 gap-1.5 border-emerald-500/30 hover:bg-emerald-500/10"
        >
          <Plus class="h-4 w-4" />
          Deposit More
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

    <!-- ── Deposit Modal ── -->
    <DepositSalaryModal
      :show="showDepositModal"
      :is-add-more="isAddMore"
      @close="showDepositModal = false"
      @success="handleDepositSuccess"
    />

  </div>
</template>
