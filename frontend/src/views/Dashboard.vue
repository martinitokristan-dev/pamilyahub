<script setup>
defineOptions({ name: 'Dashboard' })
import { ref, computed, onMounted, watch } from 'vue'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useAuthStore } from '@/stores/auth.js'
import { useNotesStore } from '@/stores/notes.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useWalletsStore } from '@/stores/wallets.js'
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
import dashboardService from '@/services/dashboardService.js'
import { formatCurrency } from '@/utils/format'

import { SkeletonGrid, SkeletonListItem } from '@/components/skeletons'

const auth      = useAuthStore()
const notes     = useNotesStore()
const expenses  = useExpensesStore()
const wallets   = useWalletsStore()
const dashboard = useDashboardStore()
const salary    = useSalaryStore()

const showDepositModal  = ref(false)
const isAddMore         = ref(false)
const eleFamBubbleLine  = ref('')
const previousMonthStats = ref(null)
const previousMonthLoaded = ref(false)
const setupGuideDismissedKey = 'elefam_setup_guide_dismissed'
const isSetupGuideDismissed = ref(typeof window !== 'undefined' && localStorage.getItem(setupGuideDismissedKey) === '1')

const hasWallets = computed(() => wallets.wallets.length > 0)
const hasSalary = computed(() => parseFloat(auth.user?.monthly_salary || 0) > 0)
const hasDeposited = computed(() => salary.isReceived)
const hasExpenses = computed(() => expenses.fetched && expenses.expenses.length > 0)

const setupSteps = computed(() => [
  {
    id: 'wallet',
    title: 'Add your first Wallet',
    done: hasWallets.value,
    description: 'Create at least one wallet (GCash, Cash, Bank) so your money has a place to be tracked.',
    ctaLabel: 'Go to Wallets',
    to: '/wallets',
  },
  {
    id: 'salary',
    title: 'Set your Monthly Salary',
    done: hasSalary.value,
    description: 'This is your monthly budget baseline in Settings. It powers Budget Left and spending pressure insights.',
    ctaLabel: 'Set in Settings',
    to: '/settings',
  },
  {
    id: 'deposit',
    title: 'Deposit your Salary',
    done: hasDeposited.value,
    description: 'Deposit loads real money into a selected wallet so you can spend from actual balances.',
    ctaLabel: 'Deposit now',
    action: 'deposit',
  },
  {
    id: 'expense',
    title: 'Track your first Expense',
    done: hasExpenses.value,
    description: 'Log daily spending to update wallet balances and budget tracking in real time.',
    ctaLabel: 'Track Expense',
    to: '/expenses',
  },
])

const showSetupGuide = computed(() => !isSetupGuideDismissed.value)

function stepNumber(stepId) {
  const order = {
    wallet: 1,
    salary: 2,
    deposit: 3,
    expense: 4,
  }
  return order[stepId] ?? 0
}

// Use the exact same global floating action button / plus shortcut as other pages
useRegisterAddAction(openDeposit)

function openDeposit() {
  // If already received, this acts as "Add More"
  isAddMore.value = salary.isReceived
  showDepositModal.value = true
}

function dismissSetupGuide() {
  isSetupGuideDismissed.value = true
  if (typeof window !== 'undefined') {
    localStorage.setItem(setupGuideDismissedKey, '1')
  }
}

function openAiChat() {
  window.dispatchEvent(new Event('pamilya:open-chat'))
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
const MESSAGE_SEVERITY = {
  critical: 4,
  warning: 3,
  info: 2,
  positive: 1,
  fallback: 0,
}

function selectBestMessage(candidates = []) {
  if (!candidates.length) return null

  const sorted = [...candidates].sort((a, b) => {
    const bySeverity = (MESSAGE_SEVERITY[b.severity] ?? 0) - (MESSAGE_SEVERITY[a.severity] ?? 0)
    if (bySeverity !== 0) return bySeverity
    return (b.score ?? 0) - (a.score ?? 0)
  })

  return sorted[0]
}

function isLendingExpense(expense) {
  if (!expense) return false
  const title = (expense.title || '').toLowerCase()
  const desc = (expense.description || '').toLowerCase()
  return title.includes('lent') || title.includes('lend') || desc.includes('lent') || desc.includes('lend')
}

function formatExpenseDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const dDate = d.toDateString()
  if (dDate === today.toDateString()) return 'Today'
  if (dDate === yesterday.toDateString()) return 'Yesterday'

  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function parseExpenseDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(`${dateStr}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function getPreviousMonthParams(baseDate = new Date()) {
  const previous = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1)
  return {
    month: previous.getMonth() + 1,
    year: previous.getFullYear(),
  }
}

async function fetchPreviousMonthStats() {
  const { month, year } = getPreviousMonthParams()
  try {
    const res = await dashboardService.getStats({ month, year })
    previousMonthStats.value = res.data?.data || null
    previousMonthLoaded.value = true
  } catch {
    previousMonthStats.value = null
    previousMonthLoaded.value = false
  }
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString()
}


function getExpenseSignals() {
  const recent = expenses.expenses.slice(0, 90)
  const byWallet = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const rollingWeekStart = new Date(today)
  rollingWeekStart.setDate(rollingWeekStart.getDate() - 6)

  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(thisWeekStart.getDate() - 6)

  const previousWeekStart = new Date(today)
  previousWeekStart.setDate(previousWeekStart.getDate() - 13)

  let todaySpend = 0
  let todayExpenseCount = 0
  let yesterdaySpend = 0
  let last7DaysSpend = 0
  let thisWeekSpend = 0
  let previousWeekSpend = 0
  let oldestExpenseDate = null

  for (const ex of recent) {
    const amount = Math.abs(parseFloat(ex.amount || 0))
    if (!amount) continue

    const walletName = ex.wallet?.name
    if (walletName) byWallet[walletName] = (byWallet[walletName] || 0) + amount

    const expenseDate = parseExpenseDate(ex.date)
    if (!expenseDate) continue

    if (!oldestExpenseDate || expenseDate < oldestExpenseDate) {
      oldestExpenseDate = expenseDate
    }

    if (isSameDay(expenseDate, today)) {
      todaySpend += amount
      todayExpenseCount += 1
    }

    if (isSameDay(expenseDate, yesterday)) {
      yesterdaySpend += amount
    }

    if (expenseDate >= thisWeekStart && expenseDate <= today) {
      thisWeekSpend += amount
    }

    if (expenseDate >= previousWeekStart && expenseDate < thisWeekStart) {
      previousWeekSpend += amount
    }

    if (expenseDate >= rollingWeekStart && expenseDate <= today) {
      last7DaysSpend += amount
    }
  }

  const topWallet = Object.entries(byWallet).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  const weekDailyAverage = last7DaysSpend / 7
  const hasTwoWeekCoverage = oldestExpenseDate ? oldestExpenseDate <= previousWeekStart : false

  return {
    topWallet,
    todaySpend,
    todayExpenseCount,
    yesterdaySpend,
    weekDailyAverage,
    thisWeekSpend,
    previousWeekSpend,
    hasTwoWeekCoverage,
  }
}

const expenseSignalFingerprint = computed(() => {
  return expenses.expenses
    .slice(0, 90)
    .map(ex => `${ex.id}:${ex.amount}:${ex.date}:${ex.wallet?.name || ''}`)
    .join('|')
})

function generateEleFamBubbleLine() {
  try {
    const name = firstName.value
    const monthlyIncome = parseFloat(dashboard.stats.monthly_income || 0)
    const monthlyExpenses = parseFloat(dashboard.stats.monthly_expenses || 0)
    const remaining = parseFloat(dashboard.stats.remaining_salary || 0)
    const iOwe = parseFloat(dashboard.stats.debts_i_owe || 0)
    const ratio = monthlyIncome > 0 ? monthlyExpenses / monthlyIncome : null
    const dailyIncomeBaseline = monthlyIncome > 0 ? (monthlyIncome / 30) : 0
    const {
      topWallet,
      todaySpend,
      todayExpenseCount,
      yesterdaySpend,
      weekDailyAverage,
      thisWeekSpend,
      previousWeekSpend,
      hasTwoWeekCoverage,
    } = getExpenseSignals()
    const previousMonthExpenses = parseFloat(previousMonthStats.value?.monthly_expenses || 0)
    const hasPreviousMonthExpenses = previousMonthLoaded.value && previousMonthExpenses > 0
    const todayVsWeekRatio = weekDailyAverage > 0 ? (todaySpend / weekDailyAverage) : null
    const todayVsBaselineRatio = dailyIncomeBaseline > 0 ? (todaySpend / dailyIncomeBaseline) : null
    const todayVsYesterdayRatio = yesterdaySpend > 0 ? (todaySpend / yesterdaySpend) : null
    const thisWeekVsPreviousWeekRatio = previousWeekSpend > 0 ? (thisWeekSpend / previousWeekSpend) : null
    const thisMonthVsPreviousMonthRatio = hasPreviousMonthExpenses ? (monthlyExpenses / previousMonthExpenses) : null

    const candidates = []

  if (todayVsBaselineRatio !== null && todayVsBaselineRatio >= 1.2) {
    candidates.push({
      severity: 'critical',
      score: todayVsBaselineRatio,
      text: `${name}, you've spent ${formatCurrency(todaySpend)} today — that's above your daily pace (${formatCurrency(dailyIncomeBaseline)}). Take it easy muna today.`,
      rule: 'daily_vs_baseline_critical',
    })
  }

  if (todayVsWeekRatio !== null && todayVsWeekRatio >= 1.5) {
    candidates.push({
      severity: 'warning',
      score: todayVsWeekRatio,
      text: `${name}, today's spending (${formatCurrency(todaySpend)}) is much higher than your recent daily average (${formatCurrency(weekDailyAverage)}). Slow down muna tayo today.`,
      rule: 'daily_vs_week_warning',
    })
  }

  if (todayVsYesterdayRatio !== null && todayVsYesterdayRatio >= 1.25) {
    candidates.push({
      severity: 'warning',
      score: todayVsYesterdayRatio,
      text: `${name}, mas malaki ang gastos mo today (${formatCurrency(todaySpend)}) vs yesterday (${formatCurrency(yesterdaySpend)}). Konting alalay muna.`,
      rule: 'today_vs_yesterday_warning',
    })
  }

  if (todayVsYesterdayRatio !== null && todayVsYesterdayRatio <= 0.8 && todaySpend > 0) {
    candidates.push({
      severity: 'positive',
      score: 1 - todayVsYesterdayRatio,
      text: `${name}, nice! Mas mababa ang gastos mo today (${formatCurrency(todaySpend)}) kaysa kahapon (${formatCurrency(yesterdaySpend)}). Keep this pacing up.`,
      rule: 'today_vs_yesterday_positive',
    })
  }

  if (todaySpend > 0 && (todayVsBaselineRatio === null || todayVsBaselineRatio < 1.2)) {
    candidates.push({
      severity: 'info',
      score: todaySpend,
      text: `${name}, today you spent ${formatCurrency(todaySpend)} across ${todayExpenseCount} expense${todayExpenseCount > 1 ? 's' : ''}. ${topWallet ? `Most of it came from ${topWallet}. ` : ''}Tuloy lang sa mindful spending today.`,
      rule: 'today_activity_summary',
    })
  }

  if (hasTwoWeekCoverage && thisWeekVsPreviousWeekRatio !== null && thisWeekVsPreviousWeekRatio >= 1.2) {
    candidates.push({
      severity: 'warning',
      score: thisWeekVsPreviousWeekRatio,
      text: `${name}, mas mataas ang gastos mo this week (${formatCurrency(thisWeekSpend)}) compared sa last week (${formatCurrency(previousWeekSpend)}). Baka pwedeng bawasan muna ang non-essentials.`,
      rule: 'week_over_week_warning',
    })
  }

  if (hasTwoWeekCoverage && thisWeekVsPreviousWeekRatio !== null && thisWeekVsPreviousWeekRatio <= 0.85) {
    candidates.push({
      severity: 'positive',
      score: 1 - thisWeekVsPreviousWeekRatio,
      text: `${name}, great job — mas mababa ang gastos mo this week (${formatCurrency(thisWeekSpend)}) kaysa last week (${formatCurrency(previousWeekSpend)}). Tuloy lang ang good budgeting.`,
      rule: 'week_over_week_positive',
    })
  }

  if (thisMonthVsPreviousMonthRatio !== null && thisMonthVsPreviousMonthRatio >= 1.1) {
    candidates.push({
      severity: 'warning',
      score: thisMonthVsPreviousMonthRatio,
      text: `${name}, mas mataas na ang spending mo this month (${formatCurrency(monthlyExpenses)}) kaysa last month (${formatCurrency(previousMonthExpenses)}). Let's tighten spending a bit this month.`,
      rule: 'month_over_month_warning',
    })
  }

  if (thisMonthVsPreviousMonthRatio !== null && thisMonthVsPreviousMonthRatio <= 0.9) {
    candidates.push({
      severity: 'positive',
      score: 1 - thisMonthVsPreviousMonthRatio,
      text: `${name}, galing! You spent less this month (${formatCurrency(monthlyExpenses)}) than last month (${formatCurrency(previousMonthExpenses)}). Keep up the good budgeting.`,
      rule: 'month_over_month_positive',
    })
  }

  // Case 1: Over budget / negative balance
  if (remaining < 0) {
    if (topWallet) {
      candidates.push({
        severity: 'critical',
        score: Math.abs(remaining),
        text: `Huy ${name}, over budget na tayo this month at mukhang si ${topWallet} ang medyo bugbog sarado. Baka pwede nating dahan-dahanin muna ang spending natin?`,
        rule: 'remaining_negative_with_top_wallet',
      })
    } else {
      candidates.push({
        severity: 'critical',
        score: Math.abs(remaining),
        text: `Huy ${name}, lagpas na tayo sa budget limit natin this month. Sobrang pula na ng balance—iwas-iwas muna sa mga hindi naman kailangang bilhin ngayon, ha?`,
        rule: 'remaining_negative',
      })
    }
  }

  // Case 2: Expenses significantly exceed income (ratio >= 1.1)
  if (ratio !== null && ratio >= 1.1) {
    candidates.push({
      severity: 'critical',
      score: ratio,
      text: `Ay, lagpas-lagpas na ang nagastos natin kumpara sa kita natin, ${name}. Konting higpit muna ng sinturon bago dumating ang susunod na sahod.`,
      rule: 'monthly_ratio_critical',
    })
  }

  // Case 3: Expenses are near income (ratio >= 0.85)
  if (ratio !== null && ratio >= 0.85 && ratio < 1.1) {
    candidates.push({
      severity: 'warning',
      score: ratio,
      text: `Lapit na natin maubos ang budget natin for the month, ${name}. Kaya pa natin 'tong i-salba! Bawas-bawasan muna natin ang gala or kape sa labas.`,
      rule: 'monthly_ratio_warning',
    })
  }

  // Case 4: Has outstanding debts (iOwe > 0)
  if (iOwe > 0) {
    candidates.push({
      severity: 'info',
      score: iOwe,
      text: `A gentle reminder to check on our payables, ${name}. Kahit paunti-unting bayad, malaking tulong para gumaan ang pakiramdam sa finances natin.`,
      rule: 'debts_info',
    })
  }

  // Case 5: Normal/Good state (remaining >= 0) and has a top wallet
  if (topWallet && remaining >= 0) {
    candidates.push({
      severity: 'positive',
      score: 1,
      text: `Mukhang si ${topWallet} ang paborito mong gamitin lately. Ayos naman ang takbo ng budget natin, ituloy lang natin ang tamang tracking!`,
      rule: 'top_wallet_positive',
    })
  }

  if (todaySpend === 0 && remaining >= 0) {
    candidates.push({
      severity: 'positive',
      score: 2,
      text: `Nice one, ${name}. Wala pang gastos today — keep this calm pace hanggang mamaya.`,
      rule: 'no_spend_today_positive',
    })
  }

  if (expenses.expenses.length === 0) {
    candidates.push({
      severity: 'info',
      score: 0,
      text: `${name}, wala pa tayong na-log na expenses this month. Track lang agad para accurate lagi ang reminders ko.`,
      rule: 'no_expenses_info',
    })
  }

    // General fallback/default lines (when finances are stable or behaving well)
    candidates.push({
      severity: 'fallback',
      score: 0,
      text: `Good job sa pag-track ng bawat gastos today! Malaking tulong 'to para alam natin kung saan talaga napupunta ang pera natin.`,
      rule: 'fallback_general',
    })

    const winner = selectBestMessage(candidates)
    eleFamBubbleLine.value = winner?.text || ''
  } catch {
    eleFamBubbleLine.value = 'I\'m checking your latest spending data now. Keep tracking and I\'ll update your insight in a moment.'
  }
}

watch(
  () => [
    firstName.value,
    dashboard.stats.monthly_income,
    dashboard.stats.monthly_expenses,
    dashboard.stats.remaining_salary,
    dashboard.stats.debts_i_owe,
    previousMonthLoaded.value,
    previousMonthStats.value?.monthly_expenses || 0,
    expenseSignalFingerprint.value,
  ],
  () => {
    generateEleFamBubbleLine()
  }
)

onMounted(async () => {
  // Wave 1: Fetch stats, salary, expenses, and wallets (dashboard-critical)
  const fetches = []
  const currentMonthKey = `dashboard_${new Date().getFullYear()}_${new Date().getMonth() + 1}`
  if (!dashboard.fetched || dashboard.lastCacheKey !== currentMonthKey) {
    fetches.push(dashboard.fetchStats())
  }
  if (!salary.fetched) fetches.push(salary.fetchCurrentMonth())
  if (!expenses.fetched) fetches.push(expenses.fetchAll())
  if (!wallets.fetched) fetches.push(wallets.fetchAll())
  fetches.push(fetchPreviousMonthStats())

  try {
    await Promise.all(fetches)
  } catch {
    // Keep page usable even if one data source fails; individual stores already manage their own errors.
  }

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
  <div class="animate-fade-in bg-[#e9eff6] dark:bg-zinc-950 min-h-screen">
    <!-- ── Top Greeting (White Background) ── -->
    <div class="bg-[#e9eff6] dark:bg-zinc-950 pt-4 px-8 pb-4 max-w-6xl mx-auto">
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
            
            <!-- Chat Bubble (Solid White / Dark Mode Aware) -->
            <div class="bg-white dark:bg-zinc-900 shadow-2xl rounded-2xl p-5 relative ml-2 z-0 flex-1 min-w-0 border border-purple-100 dark:border-zinc-800/80 mt-[-32px]">
              <!-- Speech bubble tail (Pointed to mouth) -->
              <div class="absolute top-[75%] -translate-y-1/2 -left-[8px] w-4 h-4 bg-white dark:bg-zinc-900 border-l border-b border-purple-100 dark:border-zinc-800/80 rotate-45 rounded-sm"></div>
              
              <div class="relative z-10">
                <h3 class="font-black text-primary text-[10px] tracking-widest mb-1">EleFam</h3>
                <p class="text-xs text-muted-foreground dark:text-zinc-300 leading-snug font-semibold">
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

        <div class="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/80 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden relative z-10">
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
                <template v-if="isLendingExpense(expense)">
                  <img 
                    src="/icons/wallets/lending.png" 
                    class="w-full h-full object-contain rounded dark:invert" 
                  />
                </template>
                <template v-else-if="expense.wallet">
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
                  {{ formatExpenseDate(expense.date) }}
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

    <!-- ── Setup Guide Modal ── -->
    <Teleport to="body">
      <div
        v-if="showSetupGuide"
        class="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
        @mousedown.self="dismissSetupGuide"
      >
        <UiCard class="w-full max-w-2xl max-h-[90vh] overflow-hidden border-primary/20 shadow-2xl">
          <UiCardContent class="p-5 sm:p-6 overflow-y-auto max-h-[90vh]">
            <div class="flex items-start justify-between gap-3 mb-5">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Quick Start Guide</p>
                <h2 class="text-2xl sm:text-[28px] font-black tracking-tight text-foreground mt-1 leading-tight">Welcome to EleFam</h2>
                <p class="text-sm text-muted-foreground mt-2 leading-relaxed">Set up these essentials once so your budget, wallet balances, and tracking stay accurate.</p>
              </div>
              <button
                type="button"
                @click="dismissSetupGuide"
                class="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Close setup guide"
              >
                ×
              </button>
            </div>

            <div class="space-y-3.5">
              <div
                v-for="step in setupSteps"
                :key="step.id"
                class="rounded-xl border border-border bg-card/80 p-3.5 sm:p-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="text-[15px] font-bold text-foreground flex items-center gap-2.5 leading-snug">
                      <span
                        class="inline-flex h-6 min-w-6 px-1 items-center justify-center rounded-full text-[11px] font-black"
                        :class="step.done ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground border border-border'"
                      >
                        {{ step.done ? '✓' : stepNumber(step.id) }}
                      </span>
                      {{ step.title }}
                    </p>
                    <p class="text-[13px] text-muted-foreground leading-relaxed mt-2.5">{{ step.description }}</p>
                  </div>

                  <div class="shrink-0">
                    <UiButton
                      v-if="step.action === 'deposit'"
                      size="sm"
                      class="rounded-xl h-8 px-3 text-[11px] font-semibold"
                      @click="() => { dismissSetupGuide(); openDeposit(); }"
                    >
                      {{ step.ctaLabel }}
                    </UiButton>
                    <UiButton
                      v-else
                      as-child
                      size="sm"
                      variant="outline"
                      class="rounded-xl h-8 px-3 text-[11px] font-semibold"
                    >
                      <RouterLink :to="step.to" @click="dismissSetupGuide">{{ step.ctaLabel }}</RouterLink>
                    </UiButton>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-4">
              <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Pro Tip: Use EleFam AI</p>
              <p class="text-[13px] text-emerald-900 dark:text-emerald-100 mt-2 leading-relaxed">
                You can automate setup in chat instead of doing every step manually.
              </p>
              <div class="mt-3 grid gap-2">
                <p class="rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 px-2.5 py-1.5 text-[12px] text-emerald-900 dark:text-emerald-100 font-mono">new wallet GCash</p>
                <p class="rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 px-2.5 py-1.5 text-[12px] text-emerald-900 dark:text-emerald-100 font-mono">set salary 25000</p>
                <p class="rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 px-2.5 py-1.5 text-[12px] text-emerald-900 dark:text-emerald-100 font-mono">deposit 25000 to GCash</p>
                <p class="rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 px-2.5 py-1.5 text-[12px] text-emerald-900 dark:text-emerald-100 font-mono">spent 500 on food from GCash</p>
                <p class="rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 px-2.5 py-1.5 text-[12px] text-emerald-900 dark:text-emerald-100 font-mono">set my budget to 15000</p>
                <p class="rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 px-2.5 py-1.5 text-[12px] text-emerald-900 dark:text-emerald-100 font-mono">transfer 1000 from GCash to Maya</p>
              </div>
              <UiButton size="sm" class="rounded-xl h-8 px-3 mt-3 text-[11px] font-semibold" @click="() => { dismissSetupGuide(); openAiChat(); }">
                Open EleFam Chat
              </UiButton>
            </div>
          </UiCardContent>
        </UiCard>
      </div>
    </Teleport>

    <!-- ── Deposit Modal ── -->
    <DepositSalaryModal
      :show="showDepositModal"
      :is-add-more="isAddMore"
      @close="showDepositModal = false"
      @success="handleDepositSuccess"
    />
  </div>
</template>
