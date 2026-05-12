<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.js'
import { useNotesStore } from '@/stores/notes.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { NotebookPen, Receipt, FolderOpen, TrendingUp, TrendingDown } from 'lucide-vue-next'
import UiCard from '@/components/ui/Card.vue'
import UiCardHeader from '@/components/ui/CardHeader.vue'
import UiCardTitle from '@/components/ui/CardTitle.vue'
import UiCardContent from '@/components/ui/CardContent.vue'

const auth = useAuthStore()
const notes = useNotesStore()
const expenses = useExpensesStore()
const dashboard = useDashboardStore()

onMounted(async () => {
  await Promise.all([
    dashboard.fetchStats(),
    notes.fetchAll(),
    expenses.fetchAll(),
  ])
})

const stats = computed(() => [
  {
    label: 'Notes',
    value: dashboard.stats.notes_count,
    icon: NotebookPen,
    gradient: 'from-blue-500 to-indigo-600',
    bg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    light: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Total Expenses',
    value: `₱${parseFloat(dashboard.stats.expenses_total).toFixed(2)}`,
    icon: Receipt,
    gradient: 'from-orange-500 to-amber-500',
    bg: 'bg-gradient-to-br from-orange-500 to-amber-500',
    light: 'bg-orange-50 dark:bg-orange-950/30',
    text: 'text-orange-600 dark:text-orange-400',
  },
  {
    label: 'Owed to Me',
    value: `₱${parseFloat(dashboard.stats.debts_owed_to_me).toFixed(2)}`,
    icon: TrendingUp,
    gradient: 'from-emerald-500 to-green-600',
    bg: 'bg-gradient-to-br from-emerald-500 to-green-600',
    light: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'I Owe',
    value: `₱${parseFloat(dashboard.stats.debts_i_owe).toFixed(2)}`,
    icon: TrendingDown,
    gradient: 'from-rose-500 to-red-600',
    bg: 'bg-gradient-to-br from-rose-500 to-red-600',
    light: 'bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-600 dark:text-rose-400',
  },
  {
    label: 'Files',
    value: dashboard.stats.files_count,
    icon: FolderOpen,
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-gradient-to-br from-violet-500 to-purple-600',
    light: 'bg-violet-50 dark:bg-violet-950/30',
    text: 'text-violet-600 dark:text-violet-400',
  },
])
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto animate-fade-in">
    <div class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight">
        Good day, {{ auth.user?.name?.split(' ')[0] }} 👋
      </h1>
      <p class="text-sm text-muted-foreground mt-1">Here's your Pamilya Hub overview</p>
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
              <span class="text-sm font-semibold tabular-nums">₱{{ parseFloat(expense.amount).toFixed(2) }}</span>
            </div>
          </div>
        </UiCardContent>
      </UiCard>
    </div>
  </div>
</template>
