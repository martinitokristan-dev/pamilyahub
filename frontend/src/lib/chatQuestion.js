import { normalizeText } from '@/lib/chatIntents.js'

const HOW_TO_PATTERNS = [
  /\bhow\s+to\b/,
  /\bhow\s+do\s+i\b/,
  /\bhow\s+can\s+i\b/,
  /\bhelp\s+me\s+to\b/,
  /\bshow\s+me\s+how\b/,
  /\bguide\s+me\b/,
  /\bteach\s+me\b/,
  /\bpaano\b/,
  /\bunsaon\b/,
]

const ONBOARDING_GUIDANCE_PATTERNS = [
  /\b(im|i am|ako ay)\s+new\b/,
  /\bnew\s+here\b/,
  /\bfirst\s*time\b/,
  /\bfrom\s+scratch\b/,
  /\bdont\s+know\b/,
  /\bdo\s+not\s+know\b/,
  /\bwhat\s+should\s+i\s+do\s+first\b/,
  /\bwhat\s+should\s+i\s+set\s+up\s+first\b/,
  /\bset\s*up\s+first\b/,
  /\bwhere\s+do\s+i\s+start\b/,
  /\bhow\s+can\s+i\s+begin\b/,
  /\bhelp\s+me\b/,
  /\bwalk\s+me\s+through\b/,
  /\bguide\s+me\s+through\b/,
]

const QUERY_NOT_FLOW_PATTERNS = [
  /\bhow\s+much\b/,
  /\bwhere\s+can\s+i\s+see\b.*\bbalance\b/,
  /\bwhat\s+did\s+i\s+spend\b/,
  /\bshow\s+my\s+latest\s+expenses\b/,
  /\blatest\s+expenses\b/,
  /\bover\s*spend(ing)?\b/,
  /\bcompare\b.*\blast\s+month\b/,
  /\blast\s+month\b.*\bthis\s+month\b/,
  /\breduce\b.*\bexpenses\b/,
  /\bwhat\s+did\s+you\s+understand\b/,
  /\bshow\s+my\s+expenses\b/,
  /\blist\s+my\s+expenses\b/,
  /\bwhat\s+is\s+my\s+balance\b/,
  /\bhow\s+much\s+do\s+i\s+have\b/,
  /\bwho\s+owes\s+me\b/,
]

const GENERAL_FINANCE_START_PATTERNS = [
  /\bstart\s+tracking\b/,
  /\btrack(ing)?\s+(my\s+)?(money|funds|finances|cash)\b/,
  /\bmanage\s+(my\s+)?(money|funds|finances|cash)\b/,
  /\blearn\s+(how\s+to\s+)?(use|start)\b/,
  /\bhow\s+to\s+use\s+(this|the)?\s*app\b/,
  /\bhow\s+(does|do)\s+this\s+work\b/,
  /\bwhat\s+(is|does)\s+this\s+app\b/,
  /\bwhere\s+do\s+i\s+start\b/,
  /\bhow\s+to\s+begin\b/,
]

const TOPIC_KEYWORDS = {
  add_wallet: ['wallet', 'create wallet', 'add wallet', 'new wallet', 'account'],
  deposit: ['deposit', 'top up', 'cash in', 'add money', 'fund', 'income', 'salary'],
  transfer: ['transfer', 'move money', 'send money', 'between wallets'],
  log_expense: ['log expense', 'add expense', 'track expense', 'expense', 'spent', 'spend', 'gastos'],
  debts: ['debt', 'utang', 'pay debt', 'track debt', 'owe', 'borrow', 'lend'],
  budget: ['budget', 'set budget', 'check budget', 'remaining budget'],
}

function hasOnboardingGuidanceSignal(normalized = '') {
  return ONBOARDING_GUIDANCE_PATTERNS.some((rx) => rx.test(normalized))
}

function hasGeneralFinanceStartSignal(normalized = '') {
  return GENERAL_FINANCE_START_PATTERNS.some((rx) => rx.test(normalized))
}

function detectFlowTopic(normalized = '') {
  const prioritySignals = [
    { topic: 'transfer', rx: /\btransfer\b|\bmove\s+money\b|\bsend\s+money\b|\bbetween\s+wallets?\b|\bfrom\b.*\bto\b.*\b(wallet|gcash|maya|bank|bpi|bdo)\b/ },
    { topic: 'deposit', rx: /\bdeposit\b|\btop\s*up\b|\bcash\s*in\b|\badd\s+money\b|\brecord\s+income\b|\bincome\b|\bsalary\b/ },
    { topic: 'log_expense', rx: /\blog\s+expense\b|\brecord\s+expense\b|\bspen[dt]\b|\bexpense\b|\bgastos\b/ },
    { topic: 'debts', rx: /\bdebt\b|\butang\b|\bowe\b|\bborrow\b|\blend\b|\bpay\s+debt\b/ },
    { topic: 'budget', rx: /\bbudget\b|\bset\s+budget\b|\bremaining\s+budget\b/ },
    { topic: 'add_wallet', rx: /\b(add|create|new|setup)\s+wallet\b|\bwallet\s+setup\b|\baccount\b/ },
  ]

  for (const { topic, rx } of prioritySignals) {
    if (rx.test(normalized)) return topic
  }

  let bestTopic = null
  let bestScore = 0

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (normalized.includes(kw)) score += kw.includes(' ') ? 2 : 1
    }
    if (score > bestScore) {
      bestScore = score
      bestTopic = topic
    }
  }

  return bestScore > 0 ? bestTopic : null
}

function inferOnboardingTopic(normalized = '', topic = null) {
  if (topic) return topic
  if (normalized.includes('wallet') || normalized.includes('account')) return 'add_wallet'
  if (normalized.includes('budget')) return 'budget'
  if (normalized.includes('debt') || normalized.includes('utang')) return 'debts'
  if (normalized.includes('expense') || normalized.includes('spent') || normalized.includes('gastos')) return 'log_expense'
  if (normalized.includes('transfer') || normalized.includes('move money')) return 'transfer'
  if (normalized.includes('deposit') || normalized.includes('top up') || normalized.includes('cash in') || normalized.includes('income') || normalized.includes('salary')) return 'deposit'
  return 'add_wallet'
}

function hasExplicitOperationTopic(normalized = '') {
  return /\b(wallet|account|deposit|top up|cash in|transfer|move money|debt|utang|expense|spent|gastos|budget)\b/.test(normalized)
}

export function detectHowToFlowQuestion(text = '') {
  const normalized = normalizeText(String(text || ''))
  if (!normalized) return null

  const looksHowTo = HOW_TO_PATTERNS.some((rx) => rx.test(normalized))
  if (!looksHowTo) return null

  const isQueryNotGuide = QUERY_NOT_FLOW_PATTERNS.some((rx) => rx.test(normalized))
  if (isQueryNotGuide) return null

  const topic = detectFlowTopic(normalized)
  return {
    intent: 'flow_help',
    topic,
    normalized,
  }
}

export function detectGuidanceIntent(text = '') {
  const normalized = normalizeText(String(text || ''))
  if (!normalized) return null

  const topic = detectFlowTopic(normalized)
  const hasHowToSignal = HOW_TO_PATTERNS.some((rx) => rx.test(normalized))
  const hasOnboardingSignal = hasOnboardingGuidanceSignal(normalized)
  const hasGeneralStartSignal = hasGeneralFinanceStartSignal(normalized)
  const asksQuestion = /\?|\bwhat\b|\bhow\b|\bwhere\b|\bcan you\b|\bcould you\b/.test(normalized)

  const isQueryNotGuide = QUERY_NOT_FLOW_PATTERNS.some((rx) => rx.test(normalized))
  if (isQueryNotGuide) return null

  const looksGuidance = hasHowToSignal || hasOnboardingSignal || hasGeneralStartSignal
  if (!looksGuidance) return null

  if (!topic && !hasOnboardingSignal && !hasGeneralStartSignal && !asksQuestion) return null

  const shouldBiasToOnboarding = (hasOnboardingSignal || hasGeneralStartSignal) && !hasExplicitOperationTopic(normalized)

  return {
    intent: 'flow_help',
    topic: shouldBiasToOnboarding ? 'general_onboarding' : inferOnboardingTopic(normalized, topic),
    normalized,
    confidence: topic ? 0.97 : 0.9,
  }
}
