<script setup>
defineOptions({ name: 'Dashboard' })
import { ref, computed, onMounted, onActivated, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.js'
import { useNotesStore } from '@/stores/notes.js'
import { useExpensesStore } from '@/stores/expenses.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { useSalaryStore } from '@/stores/salary.js'
import { usePlansStore } from '@/stores/plans.js'
import {
  NotebookPen, Receipt, TrendingUp, TrendingDown, Banknote, Plus, Wallet, Settings, Calendar, ArrowRight, ArrowRightLeft
} from 'lucide-vue-next'
import UiCard from '@/components/ui/Card.vue'
import UiCardHeader from '@/components/ui/CardHeader.vue'
import UiCardTitle from '@/components/ui/CardTitle.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import UiButton from '@/components/ui/Button.vue'
import UiBadge from '@/components/ui/Badge.vue'
import DepositSalaryModal from '@/components/financial/DepositSalaryModal.vue'
import dashboardService from '@/services/dashboardService.js'
import { formatCurrency, formatDateTime, isTodayInPh, parseAppDate } from '@/utils/format'
import ExpenseIcon from '@/components/shared/ExpenseIcon.vue'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'
import TransactionDetailsModal from '@/components/modals/TransactionDetailsModal.vue'
import { getDaysRemaining, getDaysRemainingText, getDaysRemainingClass, getPlanBackgroundClass } from '@/utils/planHelpers'

import { SkeletonGrid, SkeletonListItem } from '@/components/skeletons'

const router = useRouter()
const auth      = useAuthStore()
const notes     = useNotesStore()
const expenses  = useExpensesStore()
const wallets   = useWalletsStore()
const dashboard = useDashboardStore()
const salary    = useSalaryStore()
const plans     = usePlansStore()

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

const showTransactionDetails = ref(false)
const selectedTransaction = ref(null)

const upcomingPlans = computed(() => {
  if (!plans.plans) return []
  return [...plans.plans]
    .filter(p => !p.is_paid && getDaysRemaining(p) <= 7)
    .sort((a, b) => {
      const aDate = a.due_date ? new Date(a.due_date) : new Date(8640000000000000)
      const bDate = b.due_date ? new Date(b.due_date) : new Date(8640000000000000)
      return aDate - bDate
    })
})

const recentExpensesList = computed(() => {
  if (!expenses.expenses) return []
  return expenses.expenses.filter(e => e.type !== 'deposit').slice(0, 5)
})

const last7DaysExpenses = computed(() => {
  if (!expenses.expenses) return 0
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return expenses.expenses
    .filter(e => e.type === 'expense' && new Date(e.created_at) >= startOfWeek)
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
})

const weeklyExpensesByDay = computed(() => {
  const now = new Date()
  const todayIdx = now.getDay() // 0=Sun
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const days = Array.from({ length: 7 }, (_, i) => ({
    label: dayLabels[i],
    total: 0,
    isToday: i === todayIdx,
    isFuture: i > todayIdx,
  }))
  if (!expenses.expenses) return days
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - todayIdx)
  startOfWeek.setHours(0, 0, 0, 0)
  expenses.expenses
    .filter(e => e.type === 'expense' && new Date(e.created_at) >= startOfWeek)
    .forEach(e => {
      const d = new Date(e.created_at)
      days[d.getDay()].total += parseFloat(e.amount || 0)
    })
  return days
})

// Per-day bar color based on spending vs daily income budget


// Today's expense stats
const todayStats = computed(() => {
  const todayExpenses = (expenses.expenses || []).filter(
    e => e.type === 'expense' && isTodayInPh(e.created_at)
  )
  const todayDeposits = (expenses.expenses || []).filter(
    e => e.type === 'deposit' && isTodayInPh(e.created_at)
  )
  const items = [...todayExpenses, ...todayDeposits].sort(
    (a, b) => (parseAppDate(b.created_at)?.getTime() ?? 0) - (parseAppDate(a.created_at)?.getTime() ?? 0)
  )
  return {
    count: todayExpenses.length,
    total: todayExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    depositTotal: todayDeposits.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    items
  }
})

const LOTTO_ITEM_HEIGHT = 38 // 34px row + 4px gap
const lottoScrollRef = ref(null)
const lottoPad = ref(30)
const mascotVideoRef = ref(null)
const activeLottoIndex = ref(0)
const lastTodayLeadId = ref(null)

function syncLottoPad() {
  const el = lottoScrollRef.value
  if (!el) return
  lottoPad.value = Math.max(0, (el.clientHeight - 34) / 2)
}

function onLottoScroll(e) {
  const container = e.target
  const viewportCenter = container.scrollTop + container.clientHeight / 2
  const firstItemCenter = lottoPad.value + 17 // half of 34px row height
  const index = Math.round((viewportCenter - firstItemCenter) / LOTTO_ITEM_HEIGHT)
  const max = Math.max(0, todayStats.value.items.length - 1)
  activeLottoIndex.value = Math.min(Math.max(0, index), max)
}

function scrollLottoToNewest(behavior = 'auto') {
  const targetIndex = todayStats.value.items.length > 1 ? 1 : 0
  activeLottoIndex.value = targetIndex
  nextTick(() => {
    const el = lottoScrollRef.value
    if (!el) return
    syncLottoPad()
    const targetScrollTop = targetIndex * LOTTO_ITEM_HEIGHT
    el.scrollTo({ top: targetScrollTop, behavior })
    requestAnimationFrame(() => {
      if (behavior === 'auto') {
        el.scrollTop = targetScrollTop
      }
      activeLottoIndex.value = targetIndex
    })
  })
}

function playMascotVideo() {
  const el = mascotVideoRef.value
  if (!el) return
  if (el.paused || el.ended) {
    el.play().catch(() => {})
  }
}

function resumeMascotVideo() {
  const el = mascotVideoRef.value
  if (!el) return
  if (el.paused) {
    el.play().catch(() => {})
  }
}

function onFinanceChanged() {
  scrollLottoToNewest('smooth')
}

watch(
  () => todayStats.value.items.map((i) => `${i.id}:${i.created_at}`).join('|'),
  () => {
    const lead = todayStats.value.items[0]
    if (!lead) {
      lastTodayLeadId.value = null
      return
    }
    if (String(lead.id) !== String(lastTodayLeadId.value)) {
      lastTodayLeadId.value = lead.id
      scrollLottoToNewest('smooth')
    }
  },
)

function openTransaction(expense) {
  selectedTransaction.value = expense
  showTransactionDetails.value = true
}

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
    const budget = dailyIncomeBaseline
    const ratio = budget > 0 ? todaySpend / budget : null
    let tone = ''
    if (ratio !== null) {
      if (ratio >= 0.8) tone = `⚠️ That's already ${Math.round(ratio * 100)}% of your daily budget — pumipiga na.`
      else if (ratio >= 0.5) tone = `Medyo kalahati na ng daily budget mo — mindful pa rin tayo.`
      else tone = `Still within safe pace — maayos ang takbo ng araw mo!`
    }
    candidates.push({
      severity: 'info',
      score: todaySpend,
      text: `${name}, today you spent ${formatCurrency(todaySpend)} across ${todayExpenseCount} expense${todayExpenseCount > 1 ? 's' : ''}. ${topWallet ? `Most of it came from ${topWallet}. ` : ''}${tone}`,
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

function onVisibilityChange() {
  if (document.visibilityState === 'visible') playMascotVideo()
}

onMounted(async () => {
  window.addEventListener('pamilya:finance-changed', onFinanceChanged)
  document.addEventListener('visibilitychange', onVisibilityChange)
  nextTick(() => {
    playMascotVideo()
    syncLottoPad()
    scrollLottoToNewest()
  })

  // Wave 1: Fetch stats, salary, expenses, and wallets (dashboard-critical)
  const fetches = []
  const currentMonthKey = `dashboard_${new Date().getFullYear()}_${new Date().getMonth() + 1}`
  if (!dashboard.fetched || dashboard.lastCacheKey !== currentMonthKey) {
    fetches.push(dashboard.fetchStats())
  }
  if (!salary.fetched) fetches.push(salary.fetchCurrentMonth())
  if (!expenses.fetched) fetches.push(expenses.fetchAll())
  if (!wallets.fetched) fetches.push(wallets.fetchAll())
  if (!plans.fetched) fetches.push(plans.fetchAll())
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

onActivated(() => {
  nextTick(() => {
    resumeMascotVideo()
    scrollLottoToNewest()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('pamilya:finance-changed', onFinanceChanged)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

// ── Stat cards ───────────────────────────────────────────────────────────────
const remaining = computed(() => parseFloat(dashboard.stats.remaining_salary ?? 0))

const statCards = computed(() => [
  {
    label: 'Last 7 Days',
    sublabel: 'Expenses this week',
    value: formatCurrency(last7DaysExpenses.value),
    icon: Receipt,
    type: 'weekly',
    gradientFrom: '#f97316',
    gradientTo:   '#f59e0b',
  },
])
</script>

<template>
  <div class="animate-fade-in bg-background dark:bg-zinc-950 min-h-screen">
    <!-- ── Top Greeting (White Background) ── -->
    <div class="bg-background dark:bg-zinc-950 pt-10 px-5 sm:px-8 pb-4 max-w-6xl mx-auto relative">
      <!-- Settings Icon on top right (Positioned absolutely above greeting) -->
      <RouterLink to="/settings" class="absolute top-4 right-8 h-10 w-10 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 text-purple-600 dark:text-purple-500 hover:text-purple-700 hover:scale-105 transition-all flex items-center justify-center z-10">
        <Settings class="h-[20px] w-[20px] stroke-[2.5px]" />
      </RouterLink>

      <div>
        <p class="text-[10px] font-black text-muted-foreground tracking-widest uppercase mb-1">
          {{ currentDate }}
        </p>
        <h1 class="text-2xl font-medium tracking-tight text-foreground relative z-10">
          {{ greeting }}, <span class="font-black">{{ auth.user?.name?.split(' ')[0] }}!</span>
        </h1>
      </div>
    </div>

    <!-- ── Mascot Section (Triple Split: White / Purple / White) ── -->
    <div class="relative z-0" style="background: linear-gradient(to bottom, transparent 40%, #9333ea 40%, #9333ea 82%, transparent 82%)">
      
      <!-- SVG Filter for Green Screen Removal -->
      <svg width="0" height="0" class="absolute pointer-events-none">
        <defs>
          <filter id="green-screen" color-interpolation-filters="sRGB">
            <feColorMatrix type="matrix" values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              1.5 -2.5 1.5 1 0
            " />
          </filter>
        </defs>
      </svg>

      <div class="max-w-6xl mx-auto px-4 sm:px-6 pt-2 pb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div class="flex flex-col w-full relative">
          <div class="flex items-center gap-0 w-full relative">
            <div class="w-32 h-36 shrink-0 overflow-hidden z-10 flex items-start justify-center bg-transparent -ml-4">
              <video 
                ref="mascotVideoRef"
                autoplay 
                loop 
                muted 
                playsinline
                class="w-[110%] max-w-none h-auto object-cover -translate-y-[5%]"
                style="filter: url(#green-screen)"
                @loadeddata="playMascotVideo"
              >
                <source src="/icons/wallets/elefam_greenscreen.mp4" type="video/mp4" />
              </video>
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

      </div>
    </div>

    <!-- ── Main Content Area ── -->
    <div class="px-3 sm:px-6 -mt-4 pb-24 max-w-6xl mx-auto relative z-10">

      <!-- ── Financial Stats ── -->
      <div class="flex flex-col gap-3 mb-8">
        <template v-if="dashboard.loading && !dashboard.fetched">
          <div class="grid grid-cols-2 gap-3">
            <div class="h-[110px] rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            <div class="h-[110px] rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          </div>
          <div class="h-[110px] rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </template>
        <template v-else>

          <!-- ── 2-col square cards row ── -->
          <div class="grid grid-cols-2 gap-3">

            <!-- Today's Expenses card -->
            <div
              class="relative rounded-2xl p-4 bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col"
              style="height: 160px"
            >
              <div class="flex items-center justify-between mb-3 shrink-0">
                <span class="text-[9px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Today</span>
              </div>
              


              <!-- Scrolling wheel list -->
              <div class="overflow-hidden relative flex-1">
                <div
                  v-if="todayStats.items.length > 0"
                  ref="lottoScrollRef"
                  class="h-full overflow-y-auto snap-y snap-mandatory hide-scrollbar flex flex-col gap-1"
                  :style="{ paddingTop: `${lottoPad}px`, paddingBottom: `${lottoPad}px` }"
                  @scroll="onLottoScroll"
                >
                  <div
                    v-for="(item, idx) in todayStats.items"
                    :key="item.id"
                    class="flex items-center justify-center gap-3 shrink-0 h-[34px] snap-center transition-all duration-300 origin-center"
                    :class="activeLottoIndex === idx ? 'scale-100 opacity-100' : 'scale-[0.75] opacity-60'"
                  >
                    <TrendingDown v-if="item.type === 'expense'" class="h-4 w-4 text-red-500 stroke-[3px] shrink-0" />
                    <TrendingUp v-else class="h-4 w-4 text-emerald-500 stroke-[3px] shrink-0" />

                    <span class="text-[20px] font-black tracking-tight" :class="item.type === 'expense' ? 'text-zinc-900 dark:text-zinc-100' : 'text-emerald-500'">
                      {{ item.type === 'deposit' ? '+' : '' }}{{ formatCurrency(item.amount) }}
                    </span>
                  </div>
                </div>
                <div v-else class="flex items-center justify-center h-full pb-2">
                  <span class="text-[10px] font-bold text-zinc-400">No activity today</span>
                </div>
              </div>
            </div>

            <!-- Monthly Income card -->
            <div
              class="relative rounded-2xl p-4 bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col"
              style="height: 160px"
            >
              <div class="flex items-center justify-between mb-3 shrink-0">
                <span class="text-[9px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Income</span>
              </div>
              <div class="flex-1 flex flex-col justify-center">
                <p class="text-2xl font-black leading-none text-emerald-500 sensitive-stat mb-1.5">{{ formatCurrency(dashboard.stats.monthly_income) }}</p>
                <p class="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 leading-tight">Deposited this month</p>
              </div>
            </div>

          </div>

          <!-- ── Full-width Weekly Bar Chart card ── -->
          <div
            class="relative rounded-2xl px-5 pt-5 pb-5 bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800"
          >
            <!-- Top row: label + total -->
            <div class="flex items-start justify-between mb-5">
              <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100 leading-none">Last 7 Days</p>
                <p class="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 mt-1">Expenses this week</p>
              </div>
              <div class="text-right">
                <p class="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-0.5">Total</p>
                <p class="text-sm font-black leading-none text-zinc-900 dark:text-zinc-100 sensitive-stat">{{ formatCurrency(last7DaysExpenses) }}</p>
              </div>
            </div>

            <!-- Bar Chart -->
            <div class="flex items-end justify-between gap-1 h-20">
              <template v-for="(day, idx) in weeklyExpensesByDay" :key="idx">
                <div class="flex flex-col items-center justify-end flex-1 h-full gap-2">
                  <!-- Bar or dot -->
                  <div class="w-full flex items-end justify-center" style="height: 60px">
                    <template v-if="day.total > 0">
                      <div
                        class="w-2.5 rounded-full transition-all"
                        :class="day.isToday ? 'bg-emerald-500' : 'bg-emerald-500/40'"
                        :style="{
                          height: Math.max(8, Math.round((day.total / Math.max(...weeklyExpensesByDay.map(d => d.total), 1)) * 60)) + 'px'
                        }"
                      />
                    </template>
                    <template v-else>
                      <div
                        class="w-2 h-2 rounded-full"
                        :class="day.isToday ? 'bg-zinc-400 dark:bg-zinc-500' : 'bg-zinc-100 dark:bg-zinc-800'"
                      />
                    </template>
                  </div>
                  <!-- Day label -->
                  <span
                    class="text-[11px] font-black uppercase leading-none"
                    :class="day.isToday ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-600'"
                  >{{ day.label }}</span>
                </div>
              </template>
            </div>
          </div>

        </template>
      </div>

      <!-- ── Unified Overview Section ── -->
      <div class="mt-8 mb-6">
        <div class="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/80 rounded-[24px] shadow-[0_15px_35px_rgba(0,0,0,0.06)] dark:shadow-none overflow-hidden relative z-10 pt-5 pb-2">
          
          <!-- Header -->
          <div class="flex items-start justify-between mb-5 px-5">
            <div>
              <div class="flex items-center gap-2">
                <Calendar class="h-[22px] w-[22px] shrink-0 text-emerald-500 stroke-[2.5px]" />
                <h2 class="text-[19px] font-extrabold text-foreground leading-none">Upcoming</h2>
              </div>
              <p class="text-[11px] font-medium text-muted-foreground mt-2 pl-[30px]">Planned and recurring money moves</p>
            </div>
            <RouterLink to="/plans" class="text-[11px] font-black uppercase tracking-widest text-primary hover:opacity-70 transition-opacity mt-1">
              See All
            </RouterLink>
          </div>

          <!-- Items Container -->
          <div class="space-y-1 px-2">
            
            <!-- Upcoming Plans -->
            <div class="max-h-[250px] overflow-y-auto space-y-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-200 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full" v-if="upcomingPlans.length > 0">
              <div
                v-for="plan in upcomingPlans"
                :key="plan.id"
                class="flex items-center justify-between gap-4 p-4 transition-all hover:bg-muted/30 active:bg-muted/50 cursor-pointer relative overflow-hidden rounded-[20px]"
                :class="getPlanBackgroundClass(plan)"
                @click="router.push('/plans')"
              >
                <!-- Left side: Icon + Details -->
                <div class="flex items-center gap-3.5 flex-1 min-w-0 z-0">
                  <div class="shrink-0">
                    <ExpenseIcon :title="plan.title" size="lg" />
                  </div>
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span class="font-bold text-foreground truncate text-sm">{{ plan.title }}</span>
                      <span v-if="plan.recurrence" class="text-[9px] uppercase tracking-widest font-black bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 px-1.5 py-0.5 rounded shrink-0">{{ plan.recurrence }}</span>
                    </div>
                    <span class="text-xs font-semibold text-muted-foreground/80 mt-0.5">{{ formatExpenseDate(plan.due_date) }}</span>
                  </div>
                </div>

                <!-- Right side: Amount + Days Left -->
                <div class="flex flex-col items-end shrink-0 z-0 text-right">
                  <span class="text-[10px] tracking-wider mb-0.5" :class="getDaysRemainingClass(plan)">
                    {{ getDaysRemainingText(plan) }}
                  </span>
                  <CurrencyAmount 
                    :amount="plan.amount" 
                    type="muted" 
                    size="md" 
                    class="font-black tabular-nums" 
                  />
                </div>
              </div>
            </div>

            <!-- Recent Expenses Loading State -->
            <div v-if="expenses.loading && expenses.expenses.length === 0" class="p-4">
              <SkeletonListItem v-for="i in 3" :key="i" class="mb-2" />
            </div>

            <!-- Empty State -->
            <div v-else-if="recentExpensesList.length === 0 && upcomingPlans.length === 0" class="p-12 text-center">
              <div class="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-muted/30 mb-4">
                <Receipt class="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p class="text-sm font-bold text-muted-foreground">No recent expenses found</p>
              <p class="text-xs text-muted-foreground/60 mt-1">Start tracking to see them here.</p>
            </div>
            
            <!-- Recent Expenses List -->
            <template v-else>
              <div v-if="recentExpensesList.length > 0" class="text-[15px] font-extrabold tracking-widest text-destructive uppercase pt-6 pb-2 px-3">
                Expenses
              </div>
              <div
                v-for="(expense, index) in recentExpensesList"
                :key="`${expense.type || 'expense'}-${expense.id}`"
                class="flex items-center gap-3 p-4 transition-all hover:bg-muted/30 active:bg-muted/50 cursor-pointer rounded-[20px] relative"
                @click="openTransaction(expense)"
              >
                <!-- Category/Wallet Icon -->
                <template v-if="expense.type === 'transfer'">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/50 border border-border shadow-sm">
                    <ArrowRightLeft class="h-6 w-6 text-muted-foreground" />
                  </div>
                </template>
                <template v-else-if="expense.type === 'deposit'">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/50 border border-border shadow-sm">
                     <TrendingUp class="h-6 w-6 text-emerald-600" />
                  </div>
                </template>
                <template v-else-if="isLendingExpense(expense)">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-muted/50 border border-border shadow-sm">
                    <img 
                      src="/icons/wallets/lending.png" 
                      class="w-full h-full object-contain rounded dark:invert" 
                    />
                  </div>
                </template>
                <template v-else>
                  <ExpenseIcon :title="expense.title" size="lg" />
                </template>

                <!-- Details -->
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="font-semibold text-sm truncate" :class="{ 'line-through text-muted-foreground/70': expense.is_settled }">
                      <template v-if="expense.type === 'transfer'">
                        Transfer
                      </template>
                      <template v-else>
                        {{ expense.title }}
                      </template>
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <template v-if="expense.type === 'transfer'">
                       <span class="text-[10px] text-muted-foreground font-medium">{{ expense.wallet?.name }}</span>
                       <ArrowRight class="h-3 w-3 text-muted-foreground" />
                       <span class="text-[10px] text-muted-foreground font-medium">{{ expense.to_wallet?.name }}</span>
                    </template>
                    <template v-else-if="expense.wallet">
                       <span class="text-[10px] text-muted-foreground font-medium">{{ expense.wallet.name }}</span>
                    </template>
                  </div>
                  <p class="text-[11px] text-muted-foreground mt-0.5">
                    {{ formatDateTime(expense.date, expense.created_at) }}
                  </p>
                </div>

                <!-- Amount -->
                <div class="shrink-0 text-right">
                  <CurrencyAmount
                    :amount="expense.type === 'deposit' ? parseFloat(expense.amount) : -parseFloat(expense.amount)"
                    :type="expense.type === 'transfer' ? 'muted' : 'auto'"
                    :prefix="expense.type === 'deposit' ? '+' : (expense.type === 'transfer' ? '' : '-')"
                    :strikethrough="expense.is_settled"
                    size="md"
                    class="text-sm font-bold"
                  />
                  <div v-if="expense.is_settled" class="mt-1 flex justify-end">
                    <UiBadge variant="outline" class="text-[9px] uppercase tracking-wider py-0 px-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600">PAID</UiBadge>
                  </div>
                  <div v-else-if="parseFloat(expense.settled_amount || 0) > 0" class="mt-1 flex justify-end">
                    <UiBadge variant="outline" class="text-[9px] uppercase tracking-wider py-0 px-1 border-amber-500/30 bg-amber-500/10 text-amber-600">PARTIAL +<span class="font-bold">{{ formatCurrency(expense.settled_amount).replace(/^[₱\s\xa0]+/g, '') }}</span></UiBadge>
                  </div>
                </div>

                <!-- Bottom Divider Line (except last item) -->
                <div v-if="index !== expenses.expenses.slice(0, 5).length - 1" class="absolute bottom-0 left-4 right-4 h-[1px] bg-zinc-200 dark:bg-zinc-800/80 pointer-events-none"></div>
              </div>
            </template>
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
        <UiCard class="w-full max-w-2xl max-h-[90vh] overflow-hidden border-primary/20 shadow-2xl flex flex-col">
          <!-- Sticky Header -->
          <div class="shrink-0 p-5 sm:p-6 pb-0">
            <div class="flex items-start justify-between gap-3 mb-5">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Quick Start Guide</p>
                <h2 class="text-2xl sm:text-[28px] font-black tracking-tight text-foreground mt-1 leading-tight">Welcome to EleFam</h2>
                <p class="text-sm text-muted-foreground mt-2 leading-relaxed">Set up these essentials once so your budget, wallet balances, and tracking stay accurate.</p>
              </div>
              <button
                type="button"
                @click="dismissSetupGuide"
                class="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center text-2xl font-medium"
                aria-label="Close setup guide"
              >
                ×
              </button>
            </div>
          </div>

          <!-- Scrollable Steps Content -->
          <UiCardContent class="p-5 sm:p-6 pt-0 overflow-y-auto flex-1 min-h-0 thin-scrollbar">
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

    <!-- Generic Read-only Details Drawer for Transfers/Deposits -->
    <TransactionDetailsModal
      v-if="selectedTransaction"
      :show="showTransactionDetails"
      :transaction="selectedTransaction"
      read-only
      @close="showTransactionDetails = false; selectedTransaction = null"
    />
  </div>
</template>
