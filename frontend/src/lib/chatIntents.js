const INTENTS = {
  query_expenses: {
    minScore: 1,
    keywords: [
      'how much spent', 'how much i spend', 'how much did i spend', 'magkano gastos', 'magkano nagastos',
      'expenses this month', 'expenses today', 'spending', 'total gastos', 'gastos ko ngayon',
      'pila gigasto', 'pila nagasto', 'pila gastos', 'expense total', 'how much did i spend money'
    ],
  },
  query_debts: {
    minScore: 1,
    keywords: [
      'who owes me', 'who owe me', 'who owe', 'what i owe', 'who i owe', 'debt list', 'debts', 'utang list', 
      'sino may utang', 'kinsa nay utang', 'kanino ako may utang', 'kanino may utang', 
      'kang kinsa ko naay utang', 'kinsay naay utang nako', 'kinsay utangan nako'
    ],
  },
  query_budget: {
    minScore: 1,
    keywords: [
      'budget left', 'remaining budget', 'remaining salary', 'budget', 'natitira budget', 'pila nabilin',
      'budget nabilin'
    ],
  },
  query_missing_wallets: {
    minScore: 1,
    keywords: [
      'other wallet', 'other wallets', 'wallet i dont have', 'wallets i dont have', 'missing wallet', 'missing wallets', 'wallet not have', 'wallets not have',
      'anong wallet wala', 'ano pang wallet wala', 'wallet na wala sakin', 'wallets na wala sakin', 'unsa pa wallet wala nako',
      'wallet nga wala nako', 'unsa pa nga wallet', 'available', 'how many available', 
      'anong available na wallet', 'unsa available nga wallet', 'total wallets'
    ],
  },
  query_balance: {
    minScore: 1,
    keywords: [
      'balance', 'wallet balance', 'how much in', 'magkano sa', 'magkano laman', 'pila sa', 'balanse',
      'how many wallets', 'ilang wallet', 'pila ka wallet', 'list of my wallets', 'ano mga wallet ko', 'unsa akong mga wallet'
    ],
  },
  deposit: {
    minScore: 1,
    keywords: [
      'deposit', 'top up', 'topup', 'add money', 'cash in', 'cashin', 'dagdag', 'hulog', 'pasok',
      'dugang', 'sulod kwarta'
    ],
  },
  create_debt_i_owe: {
    minScore: 1,
    keywords: [
      'i owe', 'i borrowed', 'utang ko', 'nangutang ako', 'borrowed from', 'utang nako', 'nanghulam ko'
    ],
  },
  create_debt_owed_to_me: {
    minScore: 1,
    keywords: [
      'owes me', 'lent', 'pinautang', 'may utang sakin', 'utang niya sakin', 'utang nako', 'giutangan ko'
    ],
  },
  pay_debt: {
    minScore: 1,
    keywords: [
      'pay debt', 'paid debt', 'mark paid', 'settle debt', 'partial pay', 'bayad utang', 'binayad',
      'bayad', 'bayaran', 'bayad utang', 'partially paid', 'paid', 'pay'
    ],
  },
  log_expense: {
    minScore: 1,
    keywords: [
      'expense', 'spent', 'spend', 'buy', 'bought', 'paid for', 'gastos', 'ginastos', 'nagastos',
      'gigasto', 'nagasto', 'palit', 'bayad sa'
    ],
  },
  create_wallet: {
    minScore: 1,
    keywords: [
      'new wallet', 'create wallet', 'add wallet', 'gawa wallet', 'bagong wallet', 'add account',
      'bag-o wallet', 'himo wallet'
    ],
  },
  ask_help: {
    minScore: 1,
    keywords: [
      'help', 'what can you do', 'commands', 'pano', 'paano', 'how to', 'unsa imong mahimo', 'tabang'
    ],
  },
  ask_tips: {
    minScore: 1,
    keywords: [
      'tips', 'advice', 'insight', 'suggest', 'tip', 'recommend', 'payo', 'tambag'
    ],
  },
}

const FINANCE_HINTS = [
  'expense', 'wallet', 'debt', 'deposit', 'budget', 'salary', 'income', 'spend', 'gastos', 'utang', 'balanse', 'owe', 'lent', 'lend', 'borrow'
]

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/['’]/g, '') // Remove apostrophes
    .replace(/[!?.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreIntent(normalizedText, keywords) {
  let score = 0
  for (const keyword of keywords) {
    if (normalizedText.includes(keyword)) score += 1
  }
  return score
}

export function detectIntent(text = '') {
  const normalized = normalize(text)
  if (!normalized) return { name: 'unknown', score: 0 }

  let best = { name: 'unknown', score: 0 }

  for (const [name, config] of Object.entries(INTENTS)) {
    const score = scoreIntent(normalized, config.keywords)
    if (score >= config.minScore && score > best.score) {
      best = { name, score }
    }
  }

  return best
}

export function isFinanceRelated(text = '') {
  const normalized = normalize(text)
  return FINANCE_HINTS.some((hint) => normalized.includes(hint))
}

export function normalizeText(text = '') {
  return normalize(text)
}

export function getIntentType(intentName) {
  const queryIntents = ['query_expenses', 'query_debts', 'query_budget', 'query_missing_wallets', 'query_balance', 'ask_help', 'ask_tips']
  return queryIntents.includes(intentName) ? 'query' : 'action'
}
