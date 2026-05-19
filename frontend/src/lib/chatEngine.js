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
  WALLET_DEFINITIONS,
  getCategoryLabel,
  extractTransferWallets,
  CATEGORY_MAP, // FIXED: category keyword map for query filtering
  CATEGORY_LABELS, // FIXED: category labels for query replies
} from '@/lib/chatEntities.js'

import { useExpensesStore } from '@/stores/expenses.js'
import { useWalletsStore } from '@/stores/wallets.js'
import { useDebtsStore } from '@/stores/debts.js'
import { useSalaryStore } from '@/stores/salary.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import {
  detectSmallTalk,
  getFlowKnowledgeMatch,
  getSmallTalkReply,
  isTechnicalQuestion,
  matchSemanticPattern,
  getLastBotAction,
  setLastBotAction,
  clearLastBotAction,
  matchContextualInference,
} from '@/lib/chatKnowledge.js'

import { advancedClassify } from '@/lib/chatNlu.js'
import { generateSmartFallback } from '@/lib/chatSmartFallback.js'


// FIXED: replaced single global with TTL-aware session Map
// to prevent race conditions and stale context execution
const _pendingContexts = new Map()
const PENDING_CONTEXT_TTL = 2 * 60 * 1000
const _lastPickedIndex = new Map()
const _chatBudgetByMonth = new Map()
const _chatBudgetUndoByMonth = new Map()
const CHAT_BUDGET_STORAGE_KEY = 'elefam_chat_budget_by_month'

function getMonthKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function loadChatBudgets() {
  if (typeof window === 'undefined') return
  if (_chatBudgetByMonth.size > 0) return
  try {
    const raw = window.localStorage.getItem(CHAT_BUDGET_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    Object.entries(parsed).forEach(([k, v]) => {
      const n = parseFloat(v)
      if (!Number.isNaN(n) && Number.isFinite(n) && n > 0) {
        _chatBudgetByMonth.set(k, n)
      }
    })
  } catch {
    // ignore storage parsing errors
  }
}

function persistChatBudgets() {
  if (typeof window === 'undefined') return
  try {
    const payload = Object.fromEntries(_chatBudgetByMonth.entries())
    window.localStorage.setItem(CHAT_BUDGET_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage write errors
  }
}

function getMonthlyBudgetLimit(monthKey = getMonthKey()) {
  loadChatBudgets()
  const n = _chatBudgetByMonth.get(monthKey)
  if (n === null || n === undefined) return null
  const parsed = parseFloat(n)
  return Number.isNaN(parsed) ? null : parsed
}

function setMonthlyBudgetLimit(amount, monthKey = getMonthKey()) {
  loadChatBudgets()
  const normalized = parseFloat(Number(amount).toFixed(2))
  _chatBudgetByMonth.set(monthKey, normalized)
  persistChatBudgets()
  return normalized
}

function deleteMonthlyBudgetLimit(monthKey = getMonthKey()) {
  loadChatBudgets()
  _chatBudgetByMonth.delete(monthKey)
  persistChatBudgets()
}

function setPendingContext(sessionId, ctx) {
  _pendingContexts.set(sessionId, {
    ...ctx,
    _setAt: Date.now(),
  })
}

function getPendingContext(sessionId) {
  const ctx = _pendingContexts.get(sessionId)
  if (!ctx) return null
  if (Date.now() - ctx._setAt > PENDING_CONTEXT_TTL) {
    _pendingContexts.delete(sessionId)
    return null
  }
  return ctx
}

function deletePendingContext(sessionId) {
  _pendingContexts.delete(sessionId)
}

const REQUIRED_FIELDS = {
  deposit: ['amount', 'wallet'],
  log_expense: ['amount', 'wallet', 'category'],
  transfer: ['amount', 'fromWallet', 'toWallet'],
  create_debt: ['amount', 'person', 'type'],
  pay_debt: ['debtId', 'amount', 'walletId'],
}

// FIXED: dynamic reminder message for all pending intent types
function getPendingReminder(ctx) {
  if (!ctx) return ''
  const entities = ctx.entities || {}

  if (ctx.intent === 'create_wallet') {
    return ` I'm still waiting for the starting balance of your ${ctx.walletName} wallet. Reply with an amount whenever you're ready!`
  }
  if (ctx.intent === 'deposit') {
    if (!entities.wallet) {
      return ` I'm still waiting for which wallet you want to deposit to. Just tell me the wallet name!`
    }
    if (entities.amount === null || entities.amount === undefined) {
      return ` I'm still waiting for how much you want to deposit to ${entities.wallet.name}.`
    }
    return ` I'm still processing your deposit to ${entities.wallet.name}.`
  }
  if (ctx.intent === 'log_expense') {
    if (entities.amount === null || entities.amount === undefined) {
      return ` I'm still waiting for the expense amount.`
    }
    if (!entities.wallet) {
      return ` I'm still waiting for which wallet to deduct this expense from.`
    }
    if (!entities.category || entities.category === 'expense') {
      return ` I'm still waiting for what this expense was for.`
    }
  }
  if (ctx.intent === 'create_debt') {
    const side = entities.type === 'i_owe' ? 'who you owe' : 'who owes you'
    if (!entities.person) {
      return ` I'm still waiting for ${side}.`
    }
    if (entities.amount === null || entities.amount === undefined) {
      const verb = entities.type === 'i_owe'
        ? `how much you owe ${entities.person}`
        : `how much ${entities.person} owes you`
      return ` I'm still waiting for ${verb}.`
    }
  }
  if (ctx.intent === 'transfer') {
    if (!entities.fromWallet && !entities.toWallet)
      return ` I'm still waiting for which wallets to transfer between.`
    if (!entities.fromWallet)
      return ` I'm still waiting for which wallet to transfer FROM.`
    if (!entities.toWallet)
      return ` I'm still waiting for which wallet to transfer TO.`
    if (!entities.amount)
      return ` I'm still waiting for how much to transfer.`
  }
  return ''
}

// FIXED: now accepts sessionId so callers can clear the right session
export function clearPendingContext(sessionId = 'default') {
  deletePendingContext(sessionId)
}

function askForMissingField(field, pendingCtx) {
  const intent = pendingCtx.intent
  if (field === 'amount') {
    if (intent === 'deposit') return "How much are you depositing? Just type a number."
    if (intent === 'log_expense') return "How much did you spend?"
    if (intent === 'transfer') return "How much do you want to transfer?"
    if (intent === 'create_debt') return "How much did you spend?"
    if (intent === 'pay_debt') return "How much did you pay?"
    return "How much did you spend?"
  }
  if (field === 'wallet') {
    if (intent === 'deposit') return "Which wallet are you depositing to?"
    if (intent === 'log_expense') return "Which wallet did you use?"
    return "Which wallet?"
  }
  if (field === 'category') {
    return "What was it for? (e.g. food, transpo)"
  }
  if (field === 'fromWallet') {
    return "Which wallet is the money coming FROM?"
  }
  if (field === 'toWallet') {
    return "Which wallet are you sending it TO?"
  }
  if (field === 'person') {
    return "Who is this debt with?"
  }
  if (field === 'type') {
    return "Is this money you owe, or money owed to you?"
  }
  if (field === 'debtId') {
    return "Which debt are you paying? (Please provide the name or reference)"
  }
  if (field === 'walletId' && intent === 'pay_debt') {
    return "Which wallet should this be applied to?"
  }
  return `Please provide the ${field}.`
}

async function executeIntent(intent, entities, sessionId) {
  const walletsStore = useWalletsStore()
  const dashboardStore = useDashboardStore()
  const debtsStore = useDebtsStore()
  const salaryStore = useSalaryStore()
  const expensesStore = useExpensesStore()

  if (intent === 'deposit') {
    return _executeDeposit(entities.amount, entities.wallet, salaryStore, dashboardStore)
  }
  if (intent === 'log_expense') {
    const payload = {
      amount: entities.amount,
      wallet: entities.wallet,
      categoryKey: entities.category,
      reason: entities.reason || ''
    }
    return _executeLogExpense(payload, expensesStore, dashboardStore)
  }
  if (intent === 'transfer') {
    return _executeTransfer(entities.fromWallet, entities.toWallet, entities.amount, walletsStore, dashboardStore, sessionId)
  }
  if (intent === 'create_debt') {
    return _executeCreateDebt(entities.person, entities.amount, entities.type, null, debtsStore, dashboardStore)
  }
  if (intent === 'pay_debt') {
    return _executePayDebt(entities.debtId, entities.amount, entities.walletId, debtsStore, walletsStore, dashboardStore)
  }
  return { ok: false, message: `Unknown intent: ${intent}` }
}

export async function resolvePendingContext(text, pendingCtx, sessionId = 'default') {
  const walletsStore = useWalletsStore()
  const normalized = normalizeText(text)

  const cancelWords = ['cancel', 'nevermind', 'never mind', 'wag na', 'ayaw na', 'huwag na']
  if (cancelWords.some((w) => normalized.includes(w))) {
    clearPendingContext(sessionId)
    return {
      ok: false,
      message: `No worries! Action cancelled. Please let me know if you would like to try again.`,
      kind: 'query',
    }
  }

  // Extract new entities from text
  const newEntities = {}

  const required = REQUIRED_FIELDS[pendingCtx.intent] || []
  const missingBefore = required.filter(field => !pendingCtx.entities[field])

  const extractedAmount = extractAmount(text)
  if (extractedAmount && extractedAmount > 0) newEntities.amount = extractedAmount

  const matchedWallet = matchWallet(text, walletsStore.wallets)

  if (pendingCtx.intent === 'deposit' || pendingCtx.intent === 'log_expense') {
    if (matchedWallet) newEntities.wallet = matchedWallet
  }

  if (pendingCtx.intent === 'transfer') {
    // Fallback for single wallet answer during clarification
    if (missingBefore.length === 1 && (missingBefore[0] === 'fromWallet' || missingBefore[0] === 'toWallet')) {
      if (matchedWallet) {
        newEntities[missingBefore[0]] = matchedWallet
      }
    } else {
      const { from: extractedFrom, to: extractedTo } = extractTransferWallets(text, walletsStore.wallets)
      if (extractedFrom) newEntities.fromWallet = extractedFrom
      if (extractedTo) newEntities.toWallet = extractedTo
    }
  }

  if (pendingCtx.intent === 'create_debt') {
    const extractedPerson = extractPersonName(text)
    if (extractedPerson) newEntities.person = extractedPerson
  }

  if (pendingCtx.intent === 'pay_debt') {
    const debtsStore = useDebtsStore()
    const debt = findDebtByName(text, debtsStore.debts)
    if (debt) newEntities.debtId = debt.id

    // We should also allow the user to provide an amount when paying debt in the follow-up
    if (extractedAmount && extractedAmount > 0) newEntities.amount = extractedAmount
    if (matchedWallet) newEntities.walletId = matchedWallet.id
  }

  if (pendingCtx.intent === 'log_expense') {
    const extractedCategory = detectCategory(text)
    const extractedReason = extractExpenseReason(text, walletsStore.wallets)
    const weakReasons = ['expense', 'today', 'yesterday', 'now', 'ngayon', 'karon', 'kanina', 'on', 'from', 'sa', 'via', 'using', 'wallet', 'account']
    const reason = weakReasons.includes(String(extractedReason || '').toLowerCase()) ? null : extractedReason

    if (reason) {
      newEntities.reason = reason
    }

    if (extractedCategory && extractedCategory !== 'expense') {
      newEntities.category = extractedCategory
    } else if (reason) {
      newEntities.category = 'expense'
    } else if (normalized.includes('general') || normalized.includes('none') || normalized.includes('skip')) {
      newEntities.category = 'expense' // Explicitly set to break the loop
    }
  }

  // Merge into existing entities
  pendingCtx.entities = { ...pendingCtx.entities, ...newEntities }

  // Check required fields
  const missing = required.filter(field => {
    const val = pendingCtx.entities[field]
    if (!val) return true
    if (
      pendingCtx.intent === 'log_expense' &&
      field === 'category' &&
      val === 'expense' &&
      !pendingCtx.entities.reason
    ) return true
    return false
  })

  if (missing.length > 0) {
    const nextField = missing[0]
    setPendingContext(sessionId, pendingCtx) // Save updated context

    return {
      ok: false,
      message: askForMissingField(nextField, pendingCtx),
      kind: 'question',
    }
  }

  // All fields present! Execute!
  clearPendingContext(sessionId)
  return executeIntent(pendingCtx.intent, pendingCtx.entities, sessionId)
}

export const eleFamProfile = {
  name: 'EleFam',
  greeting: 'Hi! I am EleFam. I can help you with EleFam flows like wallets, deposits, transfers, expenses, debts, and budget. Type "/help" to see detailed commands on how to use me.',
  guardReply: 'I can only help with EleFam flows: add wallet, deposit, transfer, log expense, debt tracking, and budget checks. You can type "/help" for list of commands.',
}

const TECHNICAL_GUARD_REPLY = 'I can\'t answer technical or developer questions. I only guide EleFam usage flows like adding wallet, depositing, transferring, logging expenses, debts, and budget.'

const FLOW_ONLY_FALLBACK = 'I can help with EleFam flows only. Try asking: "how to add wallet", "how to deposit", "how to transfer", "how to log expense", "how to track debt", or "how to check budget".'

const HELP_MESSAGE = [
  'Here are some things you can say to me directly:',
  '',
  'Wallets & Balances',
  '• "See my wallets."',
  '• "How much is in my GCash?"',
  '• "New wallet Travel Fund 1000."',
  '',
  'Expenses & Deposits',
  '• "Spent 500 on food from GCash."',
  '• "Deposit 2000 to Maya."',
  '• "How much did I spend today?"',
  '',
  'Debts & Payments',
  '• "I owe Ana 800."',
  '• "Mark owes me 400."',
  '• "Pay Ana 300 from GCash."'
].join('\n')

const SYSTEM_WALLET_TYPES = WALLET_DEFINITIONS

function formatMoney(value) {
  return `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// FIXED: detects if text is asking about a specific category
// Returns { key, label, keywords } or null if no category detected
function detectQueryCategory(text = '') {
  const normalized = normalizeText(text)
  for (const [key, keywords] of Object.entries(CATEGORY_MAP)) {
    const matched = keywords.find((kw) => normalized.includes(kw))
    if (matched) {
      return {
        key,
        label: CATEGORY_LABELS[key] || key,
        keywords,
      }
    }
  }
  return null
}

// FIXED: two-tier category filter for expenses
// Tier 1: match e.category field (new expenses logged with category key)
// Tier 2: fallback to title keyword match (old expenses without category field)
function expenseMatchesCategory(expense, categoryKey, categoryKeywords) {
  // Tier 1: clean category field match
  if (expense.category &&
    String(expense.category).toLowerCase() === categoryKey) {
    return true
  }
  // Tier 2: title-based keyword fallback for legacy expenses
  const titleNormalized = String(expense.title || '').toLowerCase()
  return categoryKeywords.some((kw) => titleNormalized.includes(kw))
}

function pickRandom(lines = [], key = '') {
  if (!lines.length) return ''
  if (lines.length === 1) return lines[0]

  const trackKey = key || lines[0].slice(0, 20)
  const lastIndex = _lastPickedIndex.get(trackKey) ?? -1

  let newIndex
  let attempts = 0
  do {
    newIndex = Math.floor(Math.random() * lines.length)
    attempts += 1
  } while (newIndex === lastIndex && attempts < 10)

  _lastPickedIndex.set(trackKey, newIndex)
  return lines[newIndex] // FIXED: reduce immediate response repetition
}

function normalizeName(value = '') {
  const v = String(value).trim()
  if (!v) return ''
  return v.charAt(0).toUpperCase() + v.slice(1)
}

function handleFlowHelp(text = '') {
  const matched = getFlowKnowledgeMatch(text)
  if (matched) {
    return {
      ok: true,
      message: matched.answer,
      kind: 'help',
    }
  }

  return {
    ok: true,
    message: [
      'I can guide these EleFam flows:',
      '• how to add wallet',
      '• how to deposit',
      '• how to transfer',
      '• how to log expense',
      '• how to track/pay debt',
      '• how to check/set budget',
    ].join('\n'),
    kind: 'help',
  }
}

async function ensureLoaded() {
  const wallets = useWalletsStore()
  const expenses = useExpensesStore()
  const debts = useDebtsStore()
  const dashboard = useDashboardStore()

  // Use a Promise.all but with a short timeout or just don't block if we have cached data
  // For offline first, if we have local data, we can proceed.
  const loaders = []
  if (!wallets.fetched) loaders.push(wallets.fetchAll().catch(() => { }))
  if (!expenses.fetched) loaders.push(expenses.fetchAll().catch(() => { }))
  if (!debts.fetched) loaders.push(debts.fetchAll().catch(() => { }))
  if (!dashboard.fetched) loaders.push(dashboard.fetchStats().catch(() => { }))

  if (loaders.length > 0) {
    // If we have NO data at all, we might need to wait a bit.
    // But if we've already hydrated from IndexedDB (indicated by length > 0 or stats exist), 
    // we should NOT block the UI for network timeouts.
    const hasLocalData = wallets.wallets.length > 0 || expenses.expenses.length > 0
    if (!hasLocalData) {
      await Promise.race([Promise.all(loaders), new Promise((r) => setTimeout(r, 1500))])
    } else {
      // Run in background, don't await
      Promise.all(loaders)
    }
  }
}

function findDebtByName(inputText, debts = []) {
  const normalized = normalizeText(inputText)
  const openDebts = debts.filter((d) => !(d.is_paid || String(d.status || '').toLowerCase() === 'paid'))
  return openDebts.find((d) => {
    const name = normalizeText(d.name)
    if (!name) return false
    return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`).test(normalized)
  }) || null
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
    ], 'tips_critical_budget')
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
    ], 'tips_high_spending')
  }

  // 4. Debt awareness
  if (debt > 0) {
    return pickRandom([
      'Tip: Debt is still in your DMs. Pay the high-priority ones first before they start calling.',
      'Tip: You have active payables. Small bites now prevent a big budget stomachache later.'
    ], 'tips_debt')
  }

  // 5. Default encouraging tips
  return pickRandom([
    'Tip: You are doing well. Keep logging daily — consistency beats perfection.',
    'Tip: Finances looking calm. Let\'s keep it that way by tracking every sneaky small expense.'
  ], 'tips_default')
}

async function handleLogExpense(text, sessionId = 'default') {
  const expensesStore = useExpensesStore()
  const walletsStore = useWalletsStore()
  const dashboardStore = useDashboardStore()
  const amount = extractAmount(text)
  const wallet = matchWallet(text, walletsStore.wallets)
  const categoryKey = detectCategory(text)
  const extractedReason = extractExpenseReason(text, walletsStore.wallets)
  const weakReasons = ['expense', 'today', 'yesterday', 'now', 'ngayon', 'karon', 'kanina', 'on', 'from', 'sa', 'via', 'using', 'wallet', 'account']
  const reason = weakReasons.includes(String(extractedReason || '').toLowerCase()) ? null : extractedReason
  const hasCategory = categoryKey && categoryKey !== 'expense'

  if ((!amount || amount <= 0) && !wallet) {
    setPendingContext(sessionId, {
      intent: 'log_expense',
      entities: {
        amount: null,
        wallet: null,
        category: hasCategory ? categoryKey : 'expense',
        reason,
      }
    })
    return {
      ok: false,
      message: `Got it. How much did you spend?`,
      kind: 'question',
    }
  }

  if (!amount || amount <= 0) {
    setPendingContext(sessionId, {
      intent: 'log_expense',
      entities: {
        amount: null,
        wallet,
        category: hasCategory ? categoryKey : 'expense',
        reason,
      }
    })
    return {
      ok: false,
      message: `Understood — using ${wallet.name}. How much did you spend?`,
      kind: 'question',
    }
  }

  if (!wallet) {
    setPendingContext(sessionId, {
      intent: 'log_expense',
      entities: {
        amount,
        wallet: null,
        category: hasCategory ? categoryKey : 'expense',
        reason,
      }
    })
    return {
      ok: false,
      message: `Noted ${formatMoney(amount)}. Which wallet was used?\n(${walletsStore.wallets.map(w => w.name).join(', ')})`,
      kind: 'question',
    }
  }

  if (!reason && !hasCategory) {
    setPendingContext(sessionId, {
      intent: 'log_expense',
      entities: {
        amount,
        wallet,
        category: 'expense',
        reason: null,
      }
    })
    return {
      ok: false,
      message: `Understood — ${formatMoney(amount)} from ${wallet.name}. What was it for? (e.g., food, transport, bills)`,
      kind: 'question',
    }
  }

  return _executeLogExpense(
    {
      amount,
      wallet,
      categoryKey: hasCategory ? categoryKey : 'expense',
      reason,
    },
    expensesStore,
    dashboardStore
  )
}

// FIXED: private log_expense executor used by handler and resolver
async function _executeLogExpense(payload, expensesStore, dashboardStore) {
  if (Number(payload.wallet.balance) < payload.amount) {
    return {
      ok: false,
      message: `Not enough balance in ${payload.wallet.name || payload.wallet.type} to spend ${formatMoney(payload.amount)}. You only have ${formatMoney(payload.wallet.balance)} left.`,
      kind: 'query',
    }
  }

  const categoryLabel = getCategoryLabel(payload.categoryKey)
  const title = payload.reason || categoryLabel || 'Expense via EleFam'

  await expensesStore.create({
    title,
    amount: payload.amount,
    category: payload.categoryKey || 'expense',
    description: 'Logged via EleFam',
    date: new Date().toISOString().slice(0, 10),
    wallet_id: payload.wallet.id,
  })
  dashboardStore.fetchStats().catch(() => { })

  const wittyDone = [
    `Successfully logged ${title} ${formatMoney(payload.amount)}. `,
    `Successfully logged ${title} ${formatMoney(payload.amount)}. `,
    `Successfully logged ${title} ${formatMoney(payload.amount)}. `,
    `Successfully logged ${title} ${formatMoney(payload.amount)}. `,
  ]
  setLastBotAction('log_expense')
  const titleLower = title.toLowerCase()
  const isLending = titleLower.includes('lent') || titleLower.includes('lend')
  return {
    ok: true,
    message: pickRandom(wittyDone, 'log_expense'),
    kind: 'action',
    walletType: isLending ? 'lending' : payload.wallet.type,
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
    message: pickRandom(wittyDone, 'query_missing_wallets'),
    kind: 'query',
  }
}

// FIXED: multi-turn deposit — asks for missing amount or wallet
async function handleDeposit(text, sessionId = 'default') {
  const walletsStore = useWalletsStore()
  const salaryStore = useSalaryStore()
  const dashboardStore = useDashboardStore()

  const amount = extractAmount(text)
  const wallet = matchWallet(text, walletsStore.wallets)

  // ── Case: both missing ────────────────────────────────────────────────
  if ((!amount || amount <= 0) && !wallet) {
    setPendingContext(sessionId, {
      intent: 'deposit',
      entities: {
        amount: null,
        wallet: null,
      }
    })
    return {
      ok: true,
      message: `Certainly. How much are you depositing?`,
      kind: 'question',
    }
  }

  // ── Case: amount missing, wallet found ────────────────────────────────
  if (!amount || amount <= 0) {
    setPendingContext(sessionId, {
      intent: 'deposit',
      entities: {
        amount: null,
        wallet,
      }
    })
    return {
      ok: true,
      message: `Understood — depositing to ${wallet.name}! How much did you spend?`,
      kind: 'question',
    }
  }

  // ── Case: wallet missing, amount found ────────────────────────────────
  if (!wallet) {
    setPendingContext(sessionId, {
      intent: 'deposit',
      entities: {
        amount,
        wallet: null,
      }
    })
    return {
      ok: true,
      message: `Understood — ${formatMoney(amount)} noted. Which wallet are you depositing to?\n(${walletsStore.wallets.map(w => w.name).join(', ')})`,
      kind: 'question',
    }
  }

  // ── Case: both present → execute ──────────────────────────────────────
  return _executeDeposit(amount, wallet, salaryStore, dashboardStore)
}

// FIXED: private deposit executor used by both handleDeposit and resolveDeposit
async function _executeDeposit(amount, wallet, salaryStore, dashboardStore) {
  await salaryStore.deposit({
    total_amount: amount,
    already_spent: 0,
    notes: 'Deposit via EleFam',
    allocations: [{ wallet_id: wallet.id, amount }],
  })
  dashboardStore.fetchStats().catch(() => { })

  const wittyDone = [
    `Successfully deposited ${formatMoney(amount)} to ${wallet.name}.`
  ]
  setLastBotAction('deposit')
  return {
    ok: true,
    message: pickRandom(wittyDone, 'deposit'),
    kind: 'action',
    walletType: wallet.type,
  }
}


// FIXED: multi-turn debt creation — asks for missing name or amount
async function handleCreateDebt(text, type, sessionId = 'default') {
  const debtsStore = useDebtsStore()
  const walletsStore = useWalletsStore()
  const dashboardStore = useDashboardStore()

  const amount = extractAmount(text)
  const name = extractPersonName(text)
  const wallet = matchWallet(text, walletsStore.wallets)

  const iOwe = type === 'i_owe'

  // ── Case: both name and amount missing ────────────────────────────────
  if (!name && (!amount || amount <= 0)) {
    setPendingContext(sessionId, {
      intent: 'create_debt',
      entities: {
        amount: null,
        person: null,
        type,
        walletId: wallet?.id ?? null,
      }
    })
    return {
      ok: true,
      message: iOwe
        ? `Certainly. Who do you owe?`
        : `Understood. Who owes you?`,
      kind: 'question',
    }
  }

  // ── Case: amount missing, name found ─────────────────────────────────
  if (!amount || amount <= 0) {
    setPendingContext(sessionId, {
      intent: 'create_debt',
      entities: {
        amount: null,
        person: name,
        type,
        walletId: wallet?.id ?? null,
      }
    })
    return {
      ok: true,
      message: iOwe
        ? `Understood. How much do you owe ${normalizeName(name)}?`
        : `Understood. How much does ${normalizeName(name)} owe you?`,
      kind: 'question',
    }
  }

  // ── Case: name missing, amount found ─────────────────────────────────
  if (!name) {
    setPendingContext(sessionId, {
      intent: 'create_debt',
      entities: {
        amount,
        person: null,
        type,
        walletId: wallet?.id ?? null,
      }
    })
    return {
      ok: true,
      message: iOwe
        ? `You owe ${formatMoney(amount)} — who are you borrowing from?`
        : `${formatMoney(amount)} noted — who owes you this?`,
      kind: 'question',
    }
  }

  // ── Case: both present → execute ──────────────────────────────────────
  return _executeCreateDebt(
    normalizeName(name), amount, type,
    wallet?.id ?? null, debtsStore, dashboardStore
  )
}

// FIXED: private debt executor used by both handleCreateDebt and resolveCreateDebt
async function _executeCreateDebt(name, amount, type, walletId, debtsStore, dashboardStore) {
  await debtsStore.create({
    name,
    amount,
    type,
    description: 'Logged via EleFam',
    due_date: '',
    wallet_id: walletId,
  })

  dashboardStore.fetchStats().catch(() => { })

  const wittyDone = [
    `Successfully logged debt of ${formatMoney(amount)} ${type === 'i_owe' ? 'owed to' : 'owed by'} ${name}.`
  ]
  setLastBotAction('create_debt')
  return {
    ok: true,
    message: pickRandom(wittyDone, `create_debt_${type}`),
    kind: 'action',
    walletType: type === 'owed_to_me' ? 'lending' : null,
  }
}


async function handlePayDebt(text, sessionId = 'default') {
  const debtsStore = useDebtsStore()
  const walletsStore = useWalletsStore()
  const dashboardStore = useDashboardStore()

  const debt = findDebtByName(text, debtsStore.debts)
  const amount = extractAmount(text)
  const wallet = matchWallet(text, walletsStore.wallets)
  const walletId = wallet?.id ?? null

  if (!debt || !amount || !walletId) {
    setPendingContext(sessionId, {
      intent: 'pay_debt',
      entities: {
        debtId: debt?.id ?? null,
        amount: amount || null,
        walletId: walletId
      }
    })

    if (!debt) return { ok: false, message: 'Which debt are you paying? (Please provide the name or reference)', kind: 'question' }
    if (!amount) return { ok: false, message: 'How much did you pay?', kind: 'question' }
    if (!walletId) return { ok: false, message: `Which wallet should this be ${debt?.type === 'i_owe' ? 'deducted from' : 'deposited to'}?`, kind: 'question' }
  }

  return _executePayDebt(debt.id, amount, walletId, debtsStore, walletsStore, dashboardStore)
}

async function _executePayDebt(debtId, amount, walletId, debtsStore, walletsStore, dashboardStore) {
  const debt = debtsStore.debts.find(d => String(d.id) === String(debtId))
  if (!debt) {
    return { ok: false, message: 'Debt not found.', kind: 'query' }
  }

  const debtAmount = Math.abs(parseFloat(debt.amount || 0))

  const payAmount = (amount && amount > 0 && amount < debtAmount) ? amount : debtAmount;
  const payWallet = walletId ? walletsStore.wallets.find(w => String(w.id) === String(walletId)) : null;
  if (debt.type === 'i_owe' && payWallet && Number(payWallet.balance) < payAmount) {
    return {
      ok: false,
      message: `Not enough balance in ${payWallet.name || payWallet.type} to pay ${formatMoney(payAmount)}. You only have ${formatMoney(payWallet.balance)} left.`,
      kind: 'query',
    }
  }

  if (amount && amount > 0 && amount < debtAmount) {
    await debtsStore.partialPay(debt.id, amount, walletId)
    dashboardStore.fetchStats().catch(() => { })
    const wittyDone = [
      `Successfully paid ${formatMoney(amount)} for ${debt.name}.`
    ]
    return {
      ok: true,
      message: pickRandom(wittyDone, 'pay_debt_partial'),
      kind: 'action',
    }
  }

  await debtsStore.markPaid(debt.id, walletId)
  dashboardStore.fetchStats().catch(() => { })
  const wittyDone = [
    `Successfully settled debt for ${debt.name}.`
  ]
  return {
    ok: true,
    message: pickRandom(wittyDone, 'pay_debt_full'),
    kind: 'action',
  }
}

async function resolveCreateWallet(text, ctx, sessionId = 'default') {
  const walletsStore = useWalletsStore()
  const dashboardStore = useDashboardStore()
  const normalized = normalizeText(text)

  if (
    normalized.includes('cancel') || normalized.includes('nevermind') ||
    normalized.includes('never mind') || normalized.includes('wag na') ||
    normalized.includes('ayaw na') || normalized.includes('huwag na')
  ) {
    return { ok: false, message: `No worries! Wallet creation for ${ctx.walletName} has been cancelled. Let me know if you change your mind.`, kind: 'query' }
  }

  let amount = extractAmount(text)
  if (amount === null) {
    const zeroWords = ['none', 'empty', 'wala', 'zero', 'nothing', 'blank', 'walang laman']
    if (normalized === '0' || zeroWords.some((w) => normalized.includes(w))) {
      amount = 0
    } else {
      // FIXED: re-set with fresh TTL since user is still in the flow
      setPendingContext(sessionId, ctx)
      return {
        ok: false,
        message: `Hmm, I didn't quite catch the amount. How much is the starting balance for your ${ctx.walletName}? Just type a number like "500" or "0" if it's empty right now.`,
        kind: 'question',
      }
    }
  }

  const { walletName, walletType } = ctx
  const existing = walletsStore.wallets.find((w) => String(w.name || '').toLowerCase() === walletName.toLowerCase())
  if (existing) {
    return { ok: false, message: `Looks like you already have a ${walletName} wallet. No duplicates allowed!`, kind: 'query' }
  }

  await walletsStore.create({ name: walletName, type: walletType, balance: amount, color: '', icon_url: '' })
  dashboardStore.fetchStats().catch(() => { })

  const wittyDone = [
    `${walletName} wallet has been successfully created with an initial balance of ${formatMoney(amount)}.`
  ]
  setLastBotAction('create_wallet')
  return { ok: true, message: pickRandom(wittyDone, 'create_wallet_followup'), kind: 'action', walletType }
}

async function handleCreateWallet(text, sessionId = 'default') {
  const walletsStore = useWalletsStore()
  const detectedType = extractWalletTypeFromText(text)
  const walletNameRaw = extractWalletNameForCreate(text)
  const canonicalName = canonicalWalletNameFromType(detectedType)

  if (!walletNameRaw && !canonicalName) {
    return { ok: false, message: 'Please include a wallet name. Example: "new wallet Travel Fund" or "new wallet GCash".' }
  }

  const walletName = canonicalName || normalizeName(walletNameRaw)
  const existing = walletsStore.wallets.find((w) => String(w.name || '').toLowerCase() === walletName.toLowerCase())
  if (existing) {
    return { ok: false, message: `You already have a ${walletName} wallet. No duplicates allowed.` }
  }

  const walletType = detectedType || inferWalletType(walletName)
  const rawAmount = extractAmount(text)

  if (rawAmount === null) {
    // FIXED: session-scoped pending context with TTL
    setPendingContext(sessionId, { intent: 'create_wallet', walletName, walletType })
    return {
      ok: true,
      message: `Understood. What's the starting balance for your ${walletName} wallet? Reply with an amount, or say "0" if it's empty right now.`,
      kind: 'question',
    }
  }

  const dashboardStore = useDashboardStore()
  await walletsStore.create({ name: walletName, type: walletType, balance: rawAmount, color: '', icon_url: '' })
  dashboardStore.fetchStats().catch(() => { })

  const wittyDone = [
    `${walletName} wallet has been successfully created with an initial balance of ${formatMoney(rawAmount)}.`
  ]
  return { ok: true, message: pickRandom(wittyDone, 'create_wallet_direct'), kind: 'action', walletType }
}

function handleQueryBalance(text) {
  const walletsStore = useWalletsStore()
  const normalized = normalizeText(text)
  const wallet = matchWallet(text, walletsStore.wallets)

  if (wallet) {
    const witty = [
      `Your ${wallet.name} balance is ${formatMoney(wallet.balance)}.`
    ]
    return { ok: true, message: pickRandom(witty, 'query_balance_wallet'), kind: 'query', walletType: wallet.type }
  }

  // Specific wallet mentioned but user doesn't have it yet
  const mentionedType = extractWalletTypeFromText(text)
  if (mentionedType) {
    const label = canonicalWalletNameFromType(mentionedType) || mentionedType
    return {
      ok: false,
      message: `You don't have a ${label} wallet yet. Say "new wallet ${label}" to add one.`,
      kind: 'query',
    }
  }

  const count = walletsStore.wallets.length
  const total = walletsStore.wallets.reduce((sum, w) => sum + parseFloat(w.balance || 0), 0)

  // Check count first before list to avoid "how many wallets" being swallowed by the list branch
  if (normalized.includes('how many') || normalized.includes('ilang') || normalized.includes('pila ka')) {
    return {
      ok: true,
      message: `You currently have ${count} wallet${count === 1 ? '' : 's'} registered in EleFam with a combined total of ${formatMoney(total)}.`,
      kind: 'query'
    }
  }

  // Check if asking for a list — match both singular "wallet" and plural "wallets"
  const isListQuery = normalized.includes('list') ||
    normalized.includes('show wallet') || normalized.includes('show wallets') ||
    /\b(my )?wallets?\b/.test(normalized) ||
    normalized.includes('ano mga wallet ko') || normalized.includes('unsa akong mga wallet')

  if (isListQuery) {
    const list = walletsStore.wallets.map(w => `• ${w.name} (${formatMoney(w.balance)})`).join('\n')
    return {
      ok: true,
      message: `YOUR WALLETS:\n\n${list}\n\nCombined total: ${formatMoney(total)}`,
      kind: 'query'
    }
  }

  const witty = [
    `Your combined total balance across all ${count} wallets is ${formatMoney(total)}.`
  ]
  return { ok: true, message: pickRandom(witty, 'query_balance_total'), kind: 'query' }
}

async function handleQueryExpenses(text = '') {
  const expensesStore = useExpensesStore()
  const walletsStore = useWalletsStore()
  const normalized = normalizeText(text)

  // ── 1. Detect wallet filter (existing logic) ──────────────────────────
  const wallet = matchWallet(text, walletsStore.wallets)

  // ── 2. Detect date range (existing logic) ─────────────────────────────
  let range = 'month'
  if (
    normalized.includes('today') ||
    normalized.includes('ngayon') ||
    normalized.includes('this day') ||
    normalized.includes('ngayong araw')
  ) {
    range = 'today'
  } else if (
    normalized.includes('yesterday') ||
    normalized.includes('kahapon')
  ) {
    range = 'yesterday'
  } else if (
    normalized.includes('this week') ||
    normalized.includes('ngayong linggo')
  ) {
    range = 'week'
  }

  // ── 3. Detect category filter (NEW) ───────────────────────────────────
  const queryCategory = detectQueryCategory(text)

  // ── 4. Ensure expenses loaded ─────────────────────────────────────────
  if (!expensesStore.fetched) await expensesStore.fetchAll()

  // ── 5. Apply date range filter (existing logic) ───────────────────────
  let filtered = expensesStore.expenses
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  if (range === 'today') {
    filtered = filtered.filter((e) => {
      const d = (e.date || e.created_at || '').slice(0, 10)
      return d === todayStr
    })
  } else if (range === 'yesterday') {
    const yesterday = new Date()
    yesterday.setDate(now.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    filtered = filtered.filter((e) => {
      const d = (e.date || e.created_at || '').slice(0, 10)
      return d === yesterdayStr
    })
  } else if (range === 'week') {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(now.getDate() - 7)
    filtered = filtered.filter(
      (e) => new Date(e.date || e.created_at) >= sevenDaysAgo
    )
  } else {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    filtered = filtered.filter(
      (e) => new Date(e.date || e.created_at) >= startOfMonth
    )
  }

  // ── 6. Apply wallet filter (existing logic) ───────────────────────────
  if (wallet) {
    filtered = filtered.filter((e) => e.wallet_id === wallet.id)
  }

  // ── 7. Apply category filter (NEW) ────────────────────────────────────
  if (queryCategory) {
    filtered = filtered.filter((e) =>
      expenseMatchesCategory(e, queryCategory.key, queryCategory.keywords)
    )
  }

  // ── 8. Compute total ──────────────────────────────────────────────────
  const total = filtered.reduce(
    (sum, e) => sum + parseFloat(e.amount || 0),
    0
  )

  // ── 9. Build human-readable labels ────────────────────────────────────
  const rangeLabel =
    range === 'today'
      ? 'today'
      : range === 'yesterday'
        ? 'yesterday'
        : range === 'week'
          ? 'this week'
          : 'this month'

  const walletLabel = wallet ? ` via ${wallet.name}` : ''
  const categoryLabel = queryCategory ? ` on ${queryCategory.label}` : ''

  // ── 10. Build response ────────────────────────────────────────────────
  // Case A: Category-specific query with zero results
  if (queryCategory && filtered.length === 0) {
    return {
      ok: true,
      message: `No ${queryCategory.label} expenses found ${rangeLabel}${walletLabel}. Either you haven't logged any yet, or you've been really good about it!`,
      kind: 'query',
      walletType: wallet?.type || null,
    }
  }

  // Case B: Category-specific query with results — show total + top items
  if (queryCategory) {
    // Show top 3 individual expenses in this category for context
    const topItems = [...filtered]
      .sort((a, b) => parseFloat(b.amount || 0) - parseFloat(a.amount || 0))
      .slice(0, 3)

    const itemLines = topItems
      .map((e) => `  • ${e.title || queryCategory.label}: ${formatMoney(e.amount)}`)
      .join('\n')

    const countLabel = filtered.length === 1
      ? '1 transaction'
      : `${filtered.length} transactions`

    const witty = [
      `Your ${queryCategory.label} expenses ${rangeLabel}${walletLabel} total ${formatMoney(total)} across ${countLabel}.\n\nBreakdown:\n${itemLines}`
    ]
    return {
      ok: true,
      message: pickRandom(witty, `query_expenses_${queryCategory.key}`),
      kind: 'query',
      walletType: wallet?.type || null,
    }
  }

  // Case C: No category — general total query (existing behavior preserved)
  const witty = [
    `Your total expenses ${rangeLabel}${walletLabel} amount to ${formatMoney(total)}.`
  ]
  return {
    ok: true,
    message: pickRandom(witty, 'query_expenses'),
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
      message += `You have no outstanding payables. Excellent.`
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
  const spent = parseFloat(dashboard.stats.monthly_expenses ?? dashboard.stats.expenses_total ?? 0)
  const monthKey = getMonthKey()
  const customBudget = getMonthlyBudgetLimit(monthKey)

  if (customBudget !== null) {
    const left = parseFloat((customBudget - spent).toFixed(2))
    if (left >= 0) {
      return {
        ok: true,
        message: `Your chat budget this month is ${formatMoney(customBudget)}. You've spent ${formatMoney(spent)}, so you still have ${formatMoney(left)} left.`,
        kind: 'query',
      }
    }
    const over = Math.abs(left)
    return {
      ok: true,
      message: `Your chat budget this month is ${formatMoney(customBudget)}. You've spent ${formatMoney(spent)}, which is ${formatMoney(over)} over budget.`,
      kind: 'query',
    }
  }

  const left = parseFloat(dashboard.stats.remaining_salary || 0)
  const witty = [
    `Your remaining budget is ${formatMoney(left)}.`
  ]
  return {
    ok: true,
    message: pickRandom(witty, 'query_budget'),
    kind: 'query',
  }
}

function handleCreateSavingsGoal() {
  return {
    ok: true,
    message: `Savings goal tracking is coming soon!\n\nFor now, you can create a dedicated wallet (e.g. "Emergency Fund" or "Ipon") and deposit into it manually to track your savings.`,
    kind: 'info',
  }
}

// FIXED: set_budget — stubbed until salaryStore supports a direct setter
async function handleSetBudget(text = '') {
  const normalized = normalizeText(text)
  const monthKey = getMonthKey()
  const monthLabel = new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  const undoWords = ['undo', 'revert', 'rollback', 'bawi', 'ibalik']

  if (undoWords.some((w) => normalized.includes(w))) {
    const undoState = _chatBudgetUndoByMonth.get(monthKey)
    if (!undoState) {
      return {
        ok: false,
        message: `I couldn't find a recent budget change to undo for ${monthLabel}.`,
        kind: 'query',
      }
    }

    if (undoState.hadPrevious) {
      setMonthlyBudgetLimit(undoState.previousAmount, monthKey)
      _chatBudgetUndoByMonth.delete(monthKey)
      return {
        ok: true,
        message: `Completed. I restored your ${monthLabel} budget to ${formatMoney(undoState.previousAmount)}.`,
        kind: 'action',
      }
    }

    deleteMonthlyBudgetLimit(monthKey)
    _chatBudgetUndoByMonth.delete(monthKey)
    return {
      ok: true,
      message: `Completed. I removed your ${monthLabel} budget limit and switched back to income-based tracking.`,
      kind: 'action',
    }
  }

  const amount = extractAmount(text)
  if (!amount || amount <= 0) {
    return {
      ok: false,
      message: `Please include a valid budget amount. Example: "set my budget to 12000". You can also say "undo budget" to revert your last budget change.`,
      kind: 'question',
    }
  }

  const dashboard = useDashboardStore()
  const previousBudget = getMonthlyBudgetLimit(monthKey)
  _chatBudgetUndoByMonth.set(monthKey, {
    hadPrevious: previousBudget !== null,
    previousAmount: previousBudget,
  })
  const budgetLimit = setMonthlyBudgetLimit(amount)
  const spent = parseFloat(dashboard.stats.monthly_expenses ?? dashboard.stats.expenses_total ?? 0)
  const left = parseFloat((budgetLimit - spent).toFixed(2))

  if (left >= 0) {
    return {
      ok: true,
      message: `Budget set for ${monthLabel}: ${formatMoney(budgetLimit)}. You've spent ${formatMoney(spent)} so far, leaving ${formatMoney(left)} available.`,
      kind: 'action',
    }
  }

  const over = Math.abs(left)
  return {
    ok: true,
    message: `Budget set for ${monthLabel}: ${formatMoney(budgetLimit)}. You've already spent ${formatMoney(spent)}, which is ${formatMoney(over)} over this budget.`,
    kind: 'action',
  }
}

// FIXED: multi-turn transfer — asks for missing fromWallet, toWallet, or amount
async function handleTransfer(text, sessionId = 'default') {
  const walletsStore = useWalletsStore()
  const dashboardStore = useDashboardStore()

  const amount = extractAmount(text)
  const { from: fromWallet, to: toWallet } = extractTransferWallets(text, walletsStore.wallets)

  // Both wallets present + amount — execute immediately
  if (fromWallet && toWallet && amount && amount > 0) {
    return _executeTransfer(fromWallet, toWallet, amount, walletsStore, dashboardStore, sessionId)
  }

  // Store what we have and ask for what's missing
  setPendingContext(sessionId, {
    intent: 'transfer',
    entities: {
      fromWallet: fromWallet ?? null,
      toWallet: toWallet ?? null,
      amount: amount ?? null,
    }
  })

  if (!fromWallet && !toWallet) {
    return {
      ok: false,
      message: `Certainly. Which wallet are you transferring FROM, and which wallet TO?`,
      kind: 'question',
    }
  }

  if (!fromWallet) {
    const toName = toWallet.name || toWallet.type
    return {
      ok: false,
      message: `Understood — transferring to ${toName}. Which wallet is the money coming FROM?`,
      kind: 'question',
    }
  }

  if (!toWallet) {
    const fromName = fromWallet.name || fromWallet.type
    return {
      ok: false,
      message: `Understood — transferring from ${fromName}. Which wallet are you sending it TO?`,
      kind: 'question',
    }
  }

  if (!amount || amount <= 0) {
    const fromName = fromWallet.name || fromWallet.type
    const toName = toWallet.name || toWallet.type
    return {
      ok: false,
      message: `Understood — transferring from ${fromName} to ${toName}. How much did you spend?`,
      kind: 'question',
    }
  }

  return _executeTransfer(fromWallet, toWallet, amount, walletsStore, dashboardStore, sessionId)
}

// FIXED: private transfer executor
async function _executeTransfer(fromWallet, toWallet, amount, walletsStore, dashboardStore, sessionId = 'default') {
  if (Number(fromWallet.balance) < amount) {
    clearPendingContext(sessionId)
    return {
      ok: false,
      message: `Not enough balance in ${fromWallet.name || fromWallet.type} to transfer ${formatMoney(amount)}.`,
      kind: 'query',
    }
  }

  try {
    await walletsStore.adjustBalance(fromWallet.id, -amount)
    await walletsStore.adjustBalance(toWallet.id, amount)
    clearPendingContext(sessionId)

    const fromName = fromWallet.name || fromWallet.type
    const toName = toWallet.name || toWallet.type

    setLastBotAction('transfer')
    return {
      ok: true,
      message: `Transferred ${formatMoney(amount)} from ${fromName} to ${toName}.`,
      kind: 'action',
    }
  } catch (err) {
    clearPendingContext(sessionId)
    return {
      ok: false,
      message: `Something went wrong with the transfer. Please try again.`,
      kind: 'query',
    }
  }
}


// Mapping bridge to harmonize NLU intents with internal handlers
function _mapNluIntent(intentName, entities = {}) {
  if (intentName === 'create_debt') {
    return (entities.type === 'owed_to_me' || entities.type === 'owes_me') ? 'create_debt_owed_to_me' : 'create_debt_i_owe'
  }
  return intentName
}

// Centralized intent dispatching
async function _dispatchIntent(intentName, text, sessionId, entities = {}) {
  const mappedIntent = _mapNluIntent(intentName, entities)
  const intentType = getIntentType(mappedIntent)

  let result = null
  if (mappedIntent === 'log_expense') result = await handleLogExpense(text, sessionId)
  else if (mappedIntent === 'deposit') result = await handleDeposit(text, sessionId)
  else if (mappedIntent === 'create_debt_i_owe') result = await handleCreateDebt(text, 'i_owe', sessionId)
  else if (mappedIntent === 'create_debt_owed_to_me') result = await handleCreateDebt(text, 'owed_to_me', sessionId)
  else if (mappedIntent === 'pay_debt') result = await handlePayDebt(text, sessionId)
  else if (mappedIntent === 'query_balance') result = await handleQueryBalance(text)
  else if (mappedIntent === 'query_expenses') result = await handleQueryExpenses(text)
  else if (mappedIntent === 'query_missing_wallets') result = handleMissingWalletsQuery(text)
  else if (mappedIntent === 'query_debts') result = await handleQueryDebts(text)
  else if (mappedIntent === 'query_budget') result = await handleQueryBudget()
  else if (mappedIntent === 'ask_help') result = { ok: true, message: HELP_MESSAGE, kind: 'help' }
  else if (mappedIntent === 'ask_tips') {
    const dashboard = useDashboardStore()
    result = { ok: true, message: financeTipFromStats(dashboard.stats), kind: 'tip' }
  }
  else if (mappedIntent === 'flow_help') result = handleFlowHelp(text)
  else if (mappedIntent === 'set_budget') result = await handleSetBudget(text)
  else if (mappedIntent === 'transfer') result = await handleTransfer(text, sessionId)
  else if (mappedIntent === 'create_savings_goal') result = handleCreateSavingsGoal()
  else if (mappedIntent === 'create_wallet') result = await handleCreateWallet(text, sessionId)

  if (result) {
    return { ...result, intentType }
  }
  return null
}

// FIXED: sessionId allows multi-tab/session-safe pending context handling
export async function processEleFamMessage(message = '', sessionId = 'default') {
  let text = String(message || '').trim()
  if (!text) {
    return { ok: false, message: 'Please type a finance question or command.' }
  }

  await ensureLoaded()

  // Inject fallback context seamlessly into the user's next message
  const fallbackCtx = getPendingContext(sessionId)
  if (fallbackCtx && fallbackCtx.intent === 'smart_fallback') {
    if (fallbackCtx.walletType && !extractWalletTypeFromText(text)) {
      text = `${fallbackCtx.walletType} ${text}`
    }
    if (fallbackCtx.amount && !extractAmount(text)) {
      text = `${fallbackCtx.amount} ${text}`
    }
    deletePendingContext(sessionId)
  }

  // FIXED: use TTL-aware Map, protect against accidental intent hijacking
  const existingCtx = getPendingContext(sessionId)
  if (existingCtx) {
    const pendingSmallTalk = detectSmallTalk(text)
    if (pendingSmallTalk === 'cancel') {
      clearPendingContext(sessionId)
      return {
        ok: true,
        message: getSmallTalkReply('cancel'),
        kind: 'text',
        intentType: 'query',
      }
    }
    if (pendingSmallTalk === 'negative') {
      clearPendingContext(sessionId)
      return {
        ok: true,
        message: getSmallTalkReply('negative', getLastBotAction()),
        kind: 'text',
        intentType: 'query',
      }
    }
    if (pendingSmallTalk) {
      return {
        ok: true,
        message: `${getSmallTalkReply(pendingSmallTalk, getLastBotAction())}${getPendingReminder(existingCtx)}`,
        kind: 'text',
        intentType: 'query',
      }
    }

    const incomingIntent = detectIntent(text)
    const isNewIntent = incomingIntent.name !== 'unknown'
    const isCancelWord = ['cancel', 'nevermind', 'never mind', 'abort', 'terminate', 'stop this', 'wag na', 'ayaw na', 'huwag na']
      .some((w) => normalizeText(text).includes(w))

    if (isCancelWord) {
      clearPendingContext(sessionId)
      return {
        ok: true,
        message: getSmallTalkReply('cancel'),
        kind: 'text',
        intentType: 'query',
      }
    }

    if (isNewIntent && incomingIntent.name !== existingCtx.intent) {
      const intentType = getIntentType(incomingIntent.name)
      const result = await (async () => {
        if (incomingIntent.name === 'log_expense') return handleLogExpense(text, sessionId)
        if (incomingIntent.name === 'deposit') return handleDeposit(text, sessionId)
        if (incomingIntent.name === 'create_debt_i_owe') return handleCreateDebt(text, 'i_owe', sessionId)
        if (incomingIntent.name === 'create_debt_owed_to_me') return handleCreateDebt(text, 'owed_to_me', sessionId)
        if (incomingIntent.name === 'pay_debt') return handlePayDebt(text)
        if (incomingIntent.name === 'query_balance') return handleQueryBalance(text)
        if (incomingIntent.name === 'query_expenses') return handleQueryExpenses(text)
        if (incomingIntent.name === 'query_missing_wallets') return handleMissingWalletsQuery(text)
        if (incomingIntent.name === 'query_debts') return handleQueryDebts(text)
        if (incomingIntent.name === 'query_budget') return handleQueryBudget()
        if (incomingIntent.name === 'ask_help') return { ok: true, message: HELP_MESSAGE, kind: 'help' }
        if (incomingIntent.name === 'ask_tips') {
          const dashboard = useDashboardStore()
          return { ok: true, message: financeTipFromStats(dashboard.stats), kind: 'tip' }
        }
        if (incomingIntent.name === 'flow_help') return handleFlowHelp(text)
        if (incomingIntent.name === 'set_budget') return handleSetBudget(text)
        if (incomingIntent.name === 'transfer') return handleTransfer(text, sessionId)
        if (incomingIntent.name === 'create_savings_goal') return handleCreateSavingsGoal()
        return null
      })()

      if (result) {
        if (intentType === 'query') {
          const reminder = getPendingReminder(existingCtx)
          return {
            ...result,
            message: result.message,
            reminder: reminder ? reminder.trim() : undefined,
            intentType,
          }
        } else {
          deletePendingContext(sessionId)
          return {
            ...result,
            intentType,
          }
        }
      }
    }

    deletePendingContext(sessionId)
    if (existingCtx.intent === 'create_wallet') {
      const result = await resolveCreateWallet(text, existingCtx, sessionId)
      return { ...result, intentType: 'action' }
    }
    // Refactored: handle all supported intents via resolvePendingContext
    if (REQUIRED_FIELDS[existingCtx.intent]) {
      const result = await resolvePendingContext(text, existingCtx, sessionId)
      return { ...result, intentType: 'action' }
    }
  }

  // ================================================================
  // THE 9-LAYER NLU PIPELINE
  // Replaces all rigid if/else checks with sequential resolution
  // ================================================================
  const normalized = normalizeText(text)

  // Call refactored advancedClassify
  const nluResult = advancedClassify(text)

  // Debug logging
  // if (import.meta.env.DEV) {
  //   console.log('[EleFam NLU]', {
  //     sourceLayer: nluResult.sourceLayer,
  //     confidence: nluResult.confidence,
  //     intent: nluResult.intent,
  //     entities: nluResult.entities
  //   })
  // }

  // Handle Ambiguous
  if (nluResult.intent === 'ambiguous') {
    const candidates = nluResult.candidates
    return {
      ok: true,
      message: `Did you mean ${candidates[0].intent.replace(/_/g, ' ')} or ${candidates[1].intent.replace(/_/g, ' ')}?`,
      kind: 'text',
      intentType: 'query'
    }
  }

  // Handle Knowledge (Smalltalk)
  if (nluResult.sourceLayer === 'knowledge') {
    return {
      ok: true,
      message: getSmallTalkReply(nluResult.intent, getLastBotAction()),
      kind: 'text',
      intentType: 'query'
    }
  }

  // Handle matched intents (Template, Synonym, Fuzzy)
  if (nluResult.matched && nluResult.intent !== 'unknown') {
    return _dispatchIntent(nluResult.intent, text, sessionId, nluResult.entities)
  }

  // Handle Fallback
  if (nluResult.sourceLayer === 'fallback') {
    const fallbackResponse = nluResult.fallbackResponse
    if (fallbackResponse?.context) {
      setPendingContext(sessionId, {
        intent: 'smart_fallback',
        ...fallbackResponse.context
      })
    }
    return {
      ok: false,
      message: fallbackResponse.message,
      kind: isFinanceRelated(normalized) ? 'query' : 'text'
    }
  }

  // Absolute baseline fallback (should rarely be reached)
  return {
    ok: false,
    message: getSmallTalkReply('unknown'),
    kind: 'query',
  }
}
