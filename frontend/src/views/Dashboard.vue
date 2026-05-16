<script setup>
defineOptions({ name: 'Dashboard' })
import { ref, computed, onMounted } from 'vue'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useAuthStore } from '@/stores/auth.js'
import { useNotesStore } from '@/stores/notes.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { useSalaryStore } from '@/stores/salary.js'
import {
  NotebookPen, Receipt, TrendingUp, TrendingDown, Banknote, Plus, Wallet
} from 'lucide-vue-next'
import UiCard from '@/components/ui/Card.vue'
import UiCardHeader from '@/components/ui/CardHeader.vue'
import UiCardTitle from '@/components/ui/CardTitle.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import UiButton from '@/components/ui/Button.vue'
import DepositSalaryModal from '@/components/financial/DepositSalaryModal.vue'
import { formatCurrency } from '@/utils/format'

import { SkeletonGrid, SkeletonListItem } from '@/components/skeletons'

const auth      = useAuthStore()
const notes     = useNotesStore()
const expenses  = useExpensesStore()
const dashboard = useDashboardStore()
const salary    = useSalaryStore()

const showDepositModal  = ref(false)
const isAddMore         = ref(false)
const eleFamBubbleLine  = ref('')

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

const firstName = computed(() => auth.user?.name?.split(' ')[0] || 'Friend')

function pickRandom(lines = []) {
  if (!lines.length) return ''
  return lines[Math.floor(Math.random() * lines.length)]
}

function getExpenseSignals() {
  const recent = expenses.expenses.slice(0, 30)
  const byWallet = {}
  const byCategory = {}

  for (const ex of recent) {
    const amount = Math.abs(parseFloat(ex.amount || 0))
    const walletName = ex.wallet?.name
    if (walletName) byWallet[walletName] = (byWallet[walletName] || 0) + amount
  }

  const topWallet = Object.entries(byWallet).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  return { topWallet }
}

function generateEleFamBubbleLine() {
  const name = firstName.value
  const monthlyIncome = parseFloat(dashboard.stats.monthly_income || 0)
  const monthlyExpenses = parseFloat(dashboard.stats.monthly_expenses || 0)
  const remaining = parseFloat(dashboard.stats.remaining_salary || 0)
  const iOwe = parseFloat(dashboard.stats.debts_i_owe || 0)
  const ratio = monthlyIncome > 0 ? monthlyExpenses / monthlyIncome : null
  const { topWallet } = getExpenseSignals()

  const lines = []

  if (remaining < 0 && topWallet) {
    lines.push(`${name}, red flag alert: you're past budget and ${topWallet} is getting hammered. Try cash-only mode for today.`)
    lines.push(`${name}, budget went negative. ${topWallet} carried most of the damage — time for a mini spending cooldown.`)
    lines.push(`${name}, your budget already left the group chat. ${topWallet} is in beast mode — maybe let it rest today.`)
    lines.push(`${name}, spending plot twist: over budget na tayo. ${topWallet} is on fire, and not the good kind.`)
  }

  if (ratio !== null && ratio >= 1.1) {
    lines.push(`${name}, expenses are doing parkour over your income. Time for a no-spend side quest.`)
    lines.push(`${name}, income is losing to expenses. Funny now, painful sa cutoff.`)
    lines.push(`${name}, your wallet called... it wants a day off.`) 
  }

  if (ratio !== null && ratio >= 0.85) {
    lines.push(`${name}, you're almost maxing this month. Maybe swap one gala day for a chill day?`)
    lines.push(`${name}, expenses are running hot. Tighten it a bit to breathe easier.`)
    lines.push(`${name}, your budget is sweating. Let's keep it steady.`)
    lines.push(`${name}, your spending is one impulse buy away from a dramatic season finale.`)
  }

  if (iOwe > 0) {
    lines.push(`${name}, you still have active payables. Small, steady payments now can save future budget panic.`)
    lines.push(`${name}, friendly reminder: utang does not expire like stories. Chip away little by little.`)
    lines.push(`${name}, debt is still in the chat. Let's mute it by paying a bit regularly.`)
  }

  if (topWallet && remaining >= 0) {
    lines.push(`${name}, most of your spend vibes are via ${topWallet}. You're still safe — keep that budget discipline sharp.`)
    lines.push(`${name}, pattern check: spending mostly from ${topWallet}. Looking good.`)
    lines.push(`${name}, ${topWallet} is your current power ally. Keep it classy, not crazy.`)
  }

  lines.push(`${name}, money check complete. Keep tracking each spend — your future self will say thank you.`)
  lines.push(`${name}, finances are behaving... for now. Keep logging everything before budget ninjas strike.`)
  lines.push(`${name}, your budget and I are besties now. We both panic when receipts multiply.`)
  lines.push(`${name}, every expense you log gives your future self +1 wisdom and -1 regret.`)
  lines.push(`${name}, you're the CEO of this budget. Approve wisely, reject dramatically.`)
  lines.push(`${name}, this is your gentle financial plot armor: track first, buy second.`)

  eleFamBubbleLine.value = pickRandom(lines)
}

onMounted(async () => {
  // Wave 1: Fetch stats, salary, and expenses (dashboard-critical)
  const fetches = []
  if (!dashboard.fetched) fetches.push(dashboard.fetchStats())
  if (!salary.fetched) fetches.push(salary.fetchCurrentMonth())
  if (!expenses.fetched) fetches.push(expenses.fetchAll())

  await Promise.all(fetches)

  generateEleFamBubbleLine()

  // Wave 2: Fetch notes only if we have idle time or if they are not fetched
  if (!notes.fetched) {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => notes.fetchAll())
    } else {
      setTimeout(() => notes.fetchAll(), 500)
    }
  }
})

// ── Stat cards ───────────────────────────────────────────────────────────────
const stats = computed(() => {
  const baseStats = []

  const remaining = parseFloat(dashboard.stats.remaining_salary ?? 0)

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
      value: formatCurrency(dashboard.stats.monthly_income),
      icon: TrendingUp,
      bg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
    },
    {
      label: 'Expenses (Monthly)',
      value: formatCurrency(dashboard.stats.monthly_expenses),
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
  <div class="animate-fade-in bg-background min-h-screen">
    <!-- ── Top Greeting (White Background) ── -->
    <div class="bg-background pt-4 px-8 pb-4 max-w-6xl mx-auto">
      <p class="text-[10px] font-black text-muted-foreground tracking-widest uppercase mb-1">
        {{ currentDate }}
      </p>
      <h1 class="text-2xl font-medium tracking-tight text-foreground">
        {{ greeting }}, <span class="font-black">{{ auth.user?.name?.split(' ')[0] }}!</span>
      </h1>
    </div>

    <!-- ── Mascot Section (Triple Split: White / Purple / White) ── -->
    <div class="relative z-0" style="background: linear-gradient(to bottom, transparent 40%, #9333ea 40%, #9333ea 82%, transparent 82%)">
      <div class="max-w-6xl mx-auto px-6 pt-2 pb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div class="flex flex-col w-full relative">
          <div class="flex items-center gap-0 w-full relative">
            <!-- Mascot Image Container -->
            <div class="w-32 h-36 shrink-0 overflow-hidden z-10 flex items-start justify-center bg-transparent -ml-4">
              <img 
                src="/icons/wallets/elefam.png" 
                alt="EleFam Mascot" 
                class="w-[110%] max-w-none h-auto object-cover -translate-y-[5%]" 
              />
            </div>
            
            <!-- Chat Bubble (Solid White) -->
            <div class="bg-white shadow-2xl rounded-[32px] p-5 relative ml-2 z-0 flex-1 min-w-0 border border-purple-100 mt-[-32px]">
              <!-- Speech bubble tail (Pointed to mouth) -->
              <div class="absolute top-[75%] -translate-y-1/2 -left-[8px] w-4 h-4 bg-white border-l border-b border-purple-100 rotate-45 rounded-sm"></div>
              
              <div class="relative z-10">
                <h3 class="font-black text-primary text-[10px] tracking-widest mb-1">EleFam</h3>
                <p class="text-xs text-muted-foreground leading-snug font-semibold">
                  {{ eleFamBubbleLine }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop Deposit Button -->
        <div class="hidden sm:flex items-center justify-end mb-4 shrink-0">
          <UiButton @click="openDeposit" class="h-12 px-6 rounded-2xl bg-white text-purple-700 hover:bg-purple-50 font-bold shadow-xl border-none">
            <Plus class="h-5 w-5 mr-1" /> Deposit
          </UiButton>
        </div>
      </div>
    </div>

    <!-- ── Main Content Area ── -->
    <div class="px-6 pt-4 pb-24 max-w-6xl mx-auto relative z-10">

      <!-- ── Financial Stats Grid ── -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <template v-if="dashboard.loading && !dashboard.fetched">
          <SkeletonGrid :count="6" variant="stat" />
        </template>
        <template v-else>
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="relative overflow-hidden rounded-2xl p-4 text-white shadow-sm"
            :class="stat.bg"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="rounded-lg bg-white/20 p-1.5">
                <component :is="stat.icon" class="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <p class="text-lg font-bold leading-none mb-1 truncate">{{ stat.value }}</p>
            <p class="text-[9px] font-bold text-white/80 uppercase tracking-widest">{{ stat.label }}</p>
          </div>
        </template>
      </div>

      <!-- ── Recent Expenses Section ── -->
      <div class="mt-4">
        <div class="flex items-center justify-between mb-4 px-2">
          <h2 class="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
            Recent Expenses
            <span class="inline-flex h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
          </h2>
          <RouterLink to="/expenses" class="text-xs font-black uppercase tracking-widest text-primary hover:opacity-70 transition-opacity">
            See All
          </RouterLink>
        </div>

        <div class="bg-card border border-border/50 rounded-[32px] shadow-sm overflow-hidden">
          <div v-if="expenses.loading && expenses.expenses.length === 0" class="divide-y divide-border/30">
            <div v-for="i in 3" :key="i" class="p-4">
              <SkeletonListItem />
            </div>
          </div>

          <div v-else-if="expenses.expenses.length === 0" class="p-12 text-center">
            <div class="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/30 mb-4">
              <Receipt class="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p class="text-sm font-bold text-muted-foreground">No recent expenses found</p>
            <p class="text-xs text-muted-foreground/60 mt-1">Start tracking to see them here.</p>
          </div>
          
          <div v-else class="divide-y divide-border/30">
            <div
              v-for="expense in expenses.expenses.slice(0, 5)"
              :key="expense.id"
              class="flex items-center gap-3 p-4 transition-all active:bg-muted/50"
            >
              <!-- Category/Wallet Icon -->
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-muted/50 border border-border shadow-sm">
                <template v-if="expense.wallet">
                  <img 
                    :src="expense.wallet.icon_url || `/icons/wallets/${expense.wallet.type === 'metrobank' ? 'metrobank.jpg' : expense.wallet.type + '.png'}`" 
                    class="w-full h-full object-contain rounded" 
                    @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='block'"
                  />
                  <Wallet class="h-5 w-5 text-muted-foreground" style="display:none" />
                </template>
                <Receipt v-else class="h-6 w-6 text-primary/60" />
              </div>

              <!-- Details -->
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-sm truncate">{{ expense.title }}</p>
                <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <!-- Category badge removed -->
                  <span v-if="expense.wallet" class="text-[10px] text-muted-foreground font-medium lowercase first-letter:uppercase">
                    {{ expense.wallet.name }}
                  </span>
                </div>
                <p class="text-[10px] text-muted-foreground mt-0.5 opacity-70">
                  Today
                </p>
              </div>

              <!-- Amount -->
              <div class="shrink-0 text-right">
                <p class="font-bold text-sm text-destructive">-{{ formatCurrency(expense.amount) }}</p>
              </div>
            </div>
          </div>

          <!-- Add Expense Shortcut -->
          <div class="p-4 bg-muted/10 border-t border-border/20">
            <RouterLink 
              to="/expenses" 
              class="flex items-center justify-center gap-2 py-3 w-full rounded-2xl bg-muted/50 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted transition-colors"
            >
              <Plus class="h-3 w-3" />
              Track New Expense
            </RouterLink>
          </div>
        </div>
      </div>
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
