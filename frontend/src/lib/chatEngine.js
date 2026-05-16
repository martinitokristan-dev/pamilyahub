import { detectIntent, isFinanceRelated, normalizeText, getIntentType } from '@/lib/chatIntents.js'
import {
  extractAmount,
  detectCategory,
  extractExpenseReason,
  matchWallet,
  extractPersonName,
  extractWalletNameForCreate,
  extractWalletTypeFromText,
  canonicalWalletNameFromType,
  inferWalletType,
} from '@/lib/chatEntities.js'

import { useExpensesStore } from '@/stores/expenses.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDebtsStore } from '@/stores/debts.js'
import { useSalaryStore } from '@/stores/salary.js'
import { useDashboardStore } from '@/stores/dashboard.js'

export const eleFamProfile = {
  name: 'EleFam',
  greeting: 'Hi! I am EleFam. I can help with expenses, deposits, debts, wallets, and finance questions inside this app.',
  guardReply: 'I can only answer finance and app-related questions in EleFam.',
}

const HELP_MESSAGE = [
  'You can type directly (no buttons needed):',
  '• "spent 500 food from gcash"',
  '• "deposit 2000 to maya"',
  '• "i owe Ana 800" / "Mark owes me 400"',
  '• "pay Ana 300 from gcash"',
  '• "new wallet Travel Fund 1000"',
  '• "how much did I spend today?"',
  '• "how much did I spend today in gcash?"',
  '• "what wallet do I not have?"',
].join('\n')

const SYSTEM_WALLET_TYPES = [
  { type: 'cash', label: 'Cash' },
  { type: 'gcash', label: 'GCash' },
  { type: 'maya', label: 'Maya' },
  { type: 'bpi', label: 'BPI' },
  { type: 'bdo', label: 'BDO' },
  { type: 'unionbank', label: 'UnionBank' },
  { type: 'metrobank', label: 'Metrobank' },
  { type: 'credit_card', label: 'Credit Card' },
  { type: 'debit_card', label: 'Debit Card' },
  { type: 'shopeepay', label: 'ShopeePay' },
  { type: 'coins_ph', label: 'Coins.ph' },
]

function formatMoney(value) {
  return `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pickRandom(lines = []) {
  if (!lines.length) return ''
  return lines[Math.floor(Math.random() * lines.length)]
}

function normalizeName(value = '') {
  const v = String(value).trim()
  if (!v) return ''
  return v.charAt(0).toUpperCase() + v.slice(1)
}

async function ensureLoaded() {
  const wallets = useWalletsStore()
  const expenses = useExpensesStore()
  const debts = useDebtsStore()
  const dashboard = useDashboardStore()

  // Use a Promise.all but with a short timeout or just don't block if we have cached data
  // For offline first, if we have local data, we can proceed.
  const loaders = []
  if (!wallets.fetched) loaders.push(wallets.fetchAll().catch(() => {}))
  if (!expenses.fetched) loaders.push(expenses.fetchAll().catch(() => {}))
  if (!debts.fetched) loaders.push(debts.fetchAll().catch(() => {}))
  if (!dashboard.fetched) loaders.push(dashboard.fetchStats().catch(() => {}))

  if (loaders.length > 0) {
    // If we have NO data at all, we might need to wait a bit.
    // But if we've already hydrated from IndexedDB (indicated by length > 0 or stats exist), 
    // we should NOT block the UI for network timeouts.
    const hasLocalData = wallets.wallets.length > 0 || expenses.expenses.length > 0
    if (!hasLocalData) {
      await Promise.all(loaders)
    } else {
      // Run in background, don't await
      Promise.all(loaders)
    }
  }
}

function findDebtByName(inputText, debts = []) {
  const normalized = normalizeText(inputText)
  const openDebts = debts.filter((d) => !(d.is_paid || String(d.status || '').toLowerCase() === 'paid'))
  return openDebts.find((d) => normalized.includes(String(d.name || '').toLowerCase())) || null
}

function financeTipFromStats(stats = {}) {
  const expensesStore = useExpensesStore()
  const walletsStore = useWalletsStore()

  const expenses = parseFloat(stats.monthly_expenses || 0)
  const left = parseFloat(stats.remaining_salary || 0)
  const debt = parseFloat(stats.debts_i_owe || 0)

  // 1. Check for critical budget state
  if (left <= 0) {
    return pickRandom([
      'Tip: Your budget is on life support. Non-essential spending is strictly cancelled until further notice.',
      'Tip: Budget went negative. Time to enter monk mode — no gala, no extras, just survival.'
    ])
  }

  // 2. Check for Wallet Dominance (Personalized Activity)
  const recentExpenses = expensesStore.expenses.slice(0, 50)
  if (recentExpenses.length >= 5) {
    const walletCounts = {}
    recentExpenses.forEach(e => {
      walletCounts[e.wallet_id] = (walletCounts[e.wallet_id] || 0) + 1
    })

    const mostUsedWalletId = Object.keys(walletCounts).reduce((a, b) => walletCounts[a] > walletCounts[b] ? a : b)
    const dominance = walletCounts[mostUsedWalletId] / recentExpenses.length

    if (dominance > 0.7) {
      const wallet = walletsStore.wallets.find(w => String(w.id) === String(mostUsedWalletId))
      if (wallet) {
        return `Tip: You've been using your ${wallet.name} for ${Math.round(dominance * 100)}% of your recent activity. Consider using other wallets to balance your funds!`
      }
    }
  }

  // 3. High Spending vs Salary
  if (expenses > 0 && left > 0 && expenses > left * 2) {
    return pickRandom([
      'Tip: Your spending is sprinting while your budget is crawling. Review your transactions before it gets dramatic.',
      'Tip: Expenses are doing parkour over your remaining budget. Time to pause and plan, not panic-buy.'
    ])
  }

  // 4. Debt awareness
  if (debt > 0) {
    return pickRandom([
      'Tip: Debt is still in your DMs. Pay the high-priority ones first before they start calling.',
      'Tip: You have active payables. Small bites now prevent a big budget stomachache later.'
    ])
  }

  // 5. Default encouraging tips
  return pickRandom([
    'Tip: You are doing well. Keep logging daily — consistency beats perfection.',
    'Tip: Finances looking calm. Let\'s keep it that way by tracking every sneaky small expense.'
  ])
}

async function handleLogExpense(text) {
  const expensesStore = useExpensesStore()
  const walletsStore = useWalletsStore()
  const dashboardStore = useDashboardStore()

  const amount = extractAmount(text)
  if (!amount || amount <= 0) {
    return { ok: false, message: 'Please include a valid amount. Example: "spent 500 food from gcash".' }
  }

  const wallet = matchWallet(text, walletsStore.wallets)
  if (!wallet) {
    return { ok: false, message: 'I could not find the wallet. Please include wallet name (e.g., GCash, Maya, BPI).' }
  }

  const reason = extractExpenseReason(text, walletsStore.wallets)
  const category = detectCategory(text)
  const title = reason || category || 'Expense via EleFam'

  await expensesStore.create({
    title,
    amount,
    description: 'Logged via EleFam',
    date: new Date().toISOString().slice(0, 10),
    wallet_id: wallet.id,
  })
  dashboardStore.fetchStats().catch(() => { })

  const wittyDone = [
    `Successfully logged ${title} ${formatMoney(amount)}. Noted, boss!`,
    `Successfully logged ${title} ${formatMoney(amount)}. Keep the receipts warm!`,
    `Successfully logged ${title} ${formatMoney(amount)}. Your wallet felt that one!`,
    `Successfully logged ${title} ${formatMoney(amount)}. Cha-ching... in reverse!`,
  ]
  return {
    ok: true,
    message: pickRandom(wittyDone),
    kind: 'action',
    walletType: wallet.type,
  }
}

function handleMissingWalletsQuery(text = '') {
  const walletsStore = useWalletsStore()
  const normalized = normalizeText(text)
  const existingTypes = new Set(walletsStore.wallets.map((w) => String(w.type || '').toLowerCase()))

  // If asking for "available" or "total", list EVERYTHING with status
  if (normalized.includes('available') || normalized.includes('total')) {
    const list = SYSTEM_WALLET_TYPES.map(w => {
      const hasIt = existingTypes.has(w.type)
      return `• ${w.label} ${hasIt ? '(You already have)' : '(Not added)'}`
    }).join('\n')

    return {
      ok: true,
      message: `AVAILABLE WALLETS IN ELEFAM:\n\n${list}`,
      kind: 'query'
    }
  }

  const missing = SYSTEM_WALLET_TYPES.filter((w) => !existingTypes.has(w.type)).map((w) => w.label)

  if (!missing.length) {
    return {
      ok: true,
      message: 'You already have all wallet types available in the system!',
      kind: 'query',
    }
  }

  const wittyDone = [
    `Wallet types you do not have yet: ${missing.join(', ')}. Time to get them all!`,
    `Missing wallet types: ${missing.join(', ')}. Complete your collection!`,
    `You're missing these wallet types: ${missing.join(', ')}. Let's get them set up!`,
  ]
  return {
    ok: true,
    message: pickRandom(wittyDone),
    kind: 'query',
  }
}

async function handleDeposit(text) {
  const walletsStore = useWalletsStore()
  const salaryStore = useSalaryStore()
  const dashboardStore = useDashboardStore()
  const amount = extractAmount(text)

  if (!amount || amount <= 0) {
    return { ok: false, message: 'Please include a valid deposit amount. Example: "deposit 2000 to gcash".' }
  }

  const wallet = matchWallet(text, walletsStore.wallets)
  if (!wallet) {
    return { ok: false, message: 'I could not find the wallet for the deposit.' }
  }

  await salaryStore.deposit({
    total_amount: amount,
    already_spent: 0,
    notes: 'Deposit via EleFam',
    allocations: [{ wallet_id: wallet.id, amount }],
  })
  dashboardStore.fetchStats().catch(() => { })

  const wittyDone = [
    `Successfully deposited ${formatMoney(amount)}. Your wallet just got a power-up!`,
    `Successfully deposited ${formatMoney(amount)}. Time to make it count!`,
    `Successfully deposited ${formatMoney(amount)}. Let the budget games begin!`,
  ]
  return {
    ok: true,
    message: pickRandom(wittyDone),
    kind: 'action',
    walletType: wallet.type,
  }
}

async function handleCreateDebt(text, type) {
  const debtsStore = useDebtsStore()
  const walletsStore = useWalletsStore()
  const dashboardStore = useDashboardStore()

  const amount = extractAmount(text)
  if (!amount || amount <= 0) {
    return { ok: false, message: 'Please include a valid debt amount.' }
  }

  const name = extractPersonName(text)
  if (!name) {
    return { ok: false, message: 'Please include the person name. Example: "i owe Ana 500".' }
  }

  const wallet = matchWallet(text, walletsStore.wallets)

  await debtsStore.create({
    name: normalizeName(name),
    amount,
    type,
    description: 'Logged via EleFam',
    due_date: '',
    wallet_id: wallet?.id ?? null,
  })

  dashboardStore.fetchStats().catch(() => { })

  const label = type === 'i_owe' ? 'I owe' : 'Owed to me'
  const wittyDone = [
    `Successfully logged debt ${formatMoney(amount)} ${type === 'i_owe' ? 'owed to' : 'owed by'} ${normalizeName(name)}. Let's keep tabs on this one!`,
    `Successfully logged debt ${formatMoney(amount)} ${type === 'i_owe' ? 'owed to' : 'owed by'} ${normalizeName(name)}. Added to the books!`,
    `Successfully logged debt ${formatMoney(amount)} ${type === 'i_owe' ? 'owed to' : 'owed by'} ${normalizeName(name)}. Track it, don't forget it!`,
  ]
  return {
    ok: true,
    message: pickRandom(wittyDone),
    kind: 'action',
  }
}

async function handlePayDebt(text) {
  const debtsStore = useDebtsStore()
  const walletsStore = useWalletsStore()
  const dashboardStore = useDashboardStore()

  const debt = findDebtByName(text, debtsStore.debts)
  if (!debt) {
    return { ok: false, message: 'I could not find an open debt with that name.' }
  }

  const amount = extractAmount(text)
  const wallet = matchWallet(text, walletsStore.wallets)
  const walletId = wallet?.id ?? debt.wallet_id ?? null

  const debtAmount = Math.abs(parseFloat(debt.amount || 0))
  if (amount && amount > 0 && amount < debtAmount) {
    await debtsStore.partialPay(debt.id, amount, walletId)
    dashboardStore.fetchStats().catch(() => { })
    const wittyDone = [
      `Successfully paid ${formatMoney(amount)} for ${debt.name}. Slow and steady wins the race!`,
      `Successfully paid ${formatMoney(amount)} for ${debt.name}. Every peso counts!`,
    ]
    return {
      ok: true,
      message: pickRandom(wittyDone),
      kind: 'action',
    }
  }

  await debtsStore.markPaid(debt.id, walletId)
  dashboardStore.fetchStats().catch(() => { })
  const wittyDone = [
    `Successfully settled debt for ${debt.name} (One less thing on your mind!)`,
    `Successfully settled debt for ${debt.name} (The books are cleaner!)`,
    `Successfully settled debt for ${debt.name} (Officially settled!)`,
  ]
  return {
    ok: true,
    message: pickRandom(wittyDone),
    kind: 'action',
  }
}

async function handleCreateWallet(text) {
  const walletsStore = useWalletsStore()
  const dashboardStore = useDashboardStore()
  const amount = extractAmount(text) ?? 0
  const detectedType = extractWalletTypeFromText(text)
  const walletNameRaw = extractWalletNameForCreate(text)
  const canonicalName = canonicalWalletNameFromType(detectedType)

  if (!walletNameRaw && !canonicalName) {
    return { ok: false, message: 'Please include wallet name. Example: "new wallet Travel Fund 1000".' }
  }

  const walletName = canonicalName || normalizeName(walletNameRaw)
  const existing = walletsStore.wallets.find((w) => String(w.name || '').toLowerCase() === walletName.toLowerCase())
  if (existing) {
    return { ok: false, message: `Wallet ${walletName} already exists.` }
  }

  const walletType = detectedType || inferWalletType(walletName)

  await walletsStore.create({
    name: walletName,
    type: walletType,
    balance: amount,
    color: '',
    icon_url: '',
  })
  dashboardStore.fetchStats().catch(() => { })

  const wittyDone = [
    `Successfully created new wallet ${walletName} with ${formatMoney(amount)}. Another soldier joins your army!`,
    `Successfully created new wallet ${walletName} with ${formatMoney(amount)}. Let's see how long it survives!`,
    `Successfully created new wallet ${walletName} with ${formatMoney(amount)}. New wallet unlocked!`,
  ]
  return {
    ok: true,
    message: pickRandom(wittyDone),
    kind: 'action',
    walletType: walletType,
  }
}

function handleQueryBalance(text) {
  const walletsStore = useWalletsStore()
  const normalized = normalizeText(text)
  const wallet = matchWallet(text, walletsStore.wallets)

  if (wallet) {
    const witty = [
      `Your ${wallet.name} currently holds ${formatMoney(wallet.balance)}. Safe or spicy? You decide.`,
      `Your ${wallet.name} balance is ${formatMoney(wallet.balance)}. Treat it well.`,
      `You have ${formatMoney(wallet.balance)} in your ${wallet.name}. Budget wisely!`,
    ]
    return { ok: true, message: pickRandom(witty), kind: 'query', walletType: wallet.type }
  }

  const count = walletsStore.wallets.length
  const total = walletsStore.wallets.reduce((sum, w) => sum + parseFloat(w.balance || 0), 0)

  // If asking for a list
  if (normalized.includes('list') || normalized === 'wallets' || normalized === 'my wallets' || normalized.includes('ano mga wallet ko') || normalized.includes('unsa akong mga wallet')) {
    const list = walletsStore.wallets.map(w => `• ${w.name} (${formatMoney(w.balance)})`).join('\n')
    return {
      ok: true,
      message: `YOUR WALLETS:\n\n${list}\n\nCombined total: ${formatMoney(total)}`,
      kind: 'query'
    }
  }

  // If asking for the count
  if (normalized.includes('how many') || normalized.includes('ilang') || normalized.includes('pila ka')) {
    return {
      ok: true,
      message: `You currently have ${count} wallet${count === 1 ? '' : 's'} registered in EleFam with a combined total of ${formatMoney(total)}.`,
      kind: 'query'
    }
  }

  const witty = [
    `Total balance across all ${count} wallets: ${formatMoney(total)}. Not bad, not bad at all.`,
    `Combined total: ${formatMoney(total)}. You have ${count} active wallets helping you manage your life!`,
  ]
  return { ok: true, message: pickRandom(witty), kind: 'query' }
}

async function handleQueryExpenses(text = '') {
  const dashboard = useDashboardStore()
  const expensesStore = useExpensesStore()
  const walletsStore = useWalletsStore()

  const normalized = normalizeText(text)
  const wallet = matchWallet(text, walletsStore.wallets)

  let range = 'month' // default
  if (normalized.includes('today') || normalized.includes('ngayon') || normalized.includes('this day') || normalized.includes('ngayong araw')) {
    range = 'today'
  } else if (normalized.includes('yesterday') || normalized.includes('kahapon')) {
    range = 'yesterday'
  } else if (normalized.includes('this week') || normalized.includes('ngayong linggo')) {
    range = 'week'
  }

  // Ensure expenses are fetched
  if (!expensesStore.fetched) await expensesStore.fetchAll()

  let filtered = expensesStore.expenses
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  if (range === 'today') {
    filtered = filtered.filter(e => {
      const d = (e.date || e.created_at || '').slice(0, 10)
      return d === todayStr
    })
  } else if (range === 'yesterday') {
    const yesterday = new Date()
    yesterday.setDate(now.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    filtered = filtered.filter(e => {
      const d = (e.date || e.created_at || '').slice(0, 10)
      return d === yesterdayStr
    })
  } else if (range === 'week') {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(now.getDate() - 7)
    filtered = filtered.filter(e => new Date(e.date || e.created_at) >= sevenDaysAgo)
  } else {
    // month - filter from the start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    filtered = filtered.filter(e => new Date(e.date || e.created_at) >= startOfMonth)
  }

  if (wallet) {
    filtered = filtered.filter(e => e.wallet_id === wallet.id)
  }

  const total = filtered.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)

  const rangeLabel = range === 'today' ? 'today'
    : range === 'yesterday' ? 'yesterday'
      : range === 'week' ? 'this week'
        : 'this month'

  const walletLabel = wallet ? ` via ${wallet.name}` : ''

  const witty = [
    `You've spent ${formatMoney(total)} ${rangeLabel}.`,
    `Total gastos ${rangeLabel}: ${formatMoney(total)}.`,
    `Current tally ${rangeLabel} is ${formatMoney(total)}.`,
  ]

  return {
    ok: true,
    message: pickRandom(witty),
    kind: 'query',
    walletType: wallet?.type || null,
  }
}

function handleQueryDebts(text = '') {
  const debtsStore = useDebtsStore()
  const normalized = normalizeText(text)

  const iOwe = debtsStore.debts.filter((d) => d.type === 'i_owe' && !(d.is_paid || String(d.status || '').toLowerCase() === 'paid'))
  const owedToMe = debtsStore.debts.filter((d) => d.type === 'owed_to_me' && !(d.is_paid || String(d.status || '').toLowerCase() === 'paid'))

  const iOweTotal = iOwe.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0)
  const owedTotal = owedToMe.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0)

  let message = ''

  const isAskingOwedByOthers = normalized.includes('who owe') ||
    normalized.includes('owes me') ||
    normalized.includes('sino may utang') ||
    normalized.includes('kinsay naay utang') ||
    normalized.includes('kinsay utangan')

  const isAskingOwedByMe = normalized.includes('i owe') ||
    normalized.includes('what i owe') ||
    normalized.includes('kanino ako may utang') ||
    normalized.includes('kang kinsa ko naay utang') ||
    normalized.includes('ko naay utang')

  // If they didn't specify, show both. If they did, show only the requested side.
  const showOwedToMe = isAskingOwedByOthers || (!isAskingOwedByMe && !isAskingOwedByOthers)
  const showIOwe = isAskingOwedByMe || (!isAskingOwedByMe && !isAskingOwedByOthers)

  if (showOwedToMe) {
    if (owedToMe.length > 0) {
      message += `OWED TO YOU ${formatMoney(owedTotal)}\n`
      message += owedToMe.map(d => `• ${d.name}: ${formatMoney(d.amount)}`).join('\n')
    } else if (isAskingOwedByOthers) {
      message += `There are no outstanding debts owed to you at this time.`
    }
  }

  if (showIOwe && showOwedToMe && message && iOwe.length > 0) message += '\n\n'

  if (showIOwe) {
    if (iOwe.length > 0) {
      message += `YOU OWE ${formatMoney(iOweTotal)}\n`
      message += iOwe.map(d => `• ${d.name}: ${formatMoney(d.amount)}`).join('\n')
    } else if (isAskingOwedByMe) {
      message += `You have no outstanding payables. Excellent!`
    }
  }

  return {
    ok: true,
    message: message.trim() || 'No active debts found.',
    kind: 'query',
  }
}

function handleQueryBudget() {
  const dashboard = useDashboardStore()
  const left = parseFloat(dashboard.stats.remaining_salary || 0)
  const witty = [
    `Budget left: ${formatMoney(left)}. Spend like a strategist, not a streamer.`,
    `You have ${formatMoney(left)} left. Every peso is a soldier — deploy wisely.`,
  ]
  return {
    ok: true,
    message: pickRandom(witty),
    kind: 'query',
  }
}

export async function processEleFamMessage(message = '') {
  const text = String(message || '').trim()
  if (!text) {
    return { ok: false, message: 'Please type a finance question or command.' }
  }

  await ensureLoaded()

  const intent = detectIntent(text)
  const normalized = normalizeText(text)
  const intentType = getIntentType(intent.name)

  if (intent.name === 'unknown') {
    if (!isFinanceRelated(normalized)) {
      return { ok: false, message: eleFamProfile.guardReply, kind: 'guard' }
    }
    return { ok: false, message: 'I did not understand that finance command. Type "help" to see supported commands.' }
  }

  if (intent.name === 'ask_help') {
    return { ok: true, message: HELP_MESSAGE, kind: 'help', intentType }
  }

  if (intent.name === 'ask_tips') {
    const dashboard = useDashboardStore()
    return { ok: true, message: financeTipFromStats(dashboard.stats), kind: 'tip', intentType }
  }

  const result = await (async () => {
    if (intent.name === 'log_expense') return handleLogExpense(text)
    if (intent.name === 'deposit') return handleDeposit(text)
    if (intent.name === 'create_debt_i_owe') return handleCreateDebt(text, 'i_owe')
    if (intent.name === 'create_debt_owed_to_me') return handleCreateDebt(text, 'owed_to_me')
    if (intent.name === 'pay_debt') return handlePayDebt(text)
    if (intent.name === 'create_wallet') return handleCreateWallet(text)
    if (intent.name === 'query_balance') return handleQueryBalance(text)
    if (intent.name === 'query_expenses') return handleQueryExpenses(text)
    if (intent.name === 'query_missing_wallets') return handleMissingWalletsQuery(text)
    if (intent.name === 'query_debts') return handleQueryDebts(text)
    if (intent.name === 'query_budget') return handleQueryBudget()
    return { ok: false, message: 'I can only handle PamilyaHub finance commands.' }
  })()

  return { ...result, intentType }
}
