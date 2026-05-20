export const INTENTS = {
  query_expenses: {
    minScore: 1,
    keywords: [
      'how much spent', 'how much i spend', 'how much did i spend', 'magkano gastos', 'magkano nagastos',
      'expenses this month', 'expenses today', 'spending', 'total gastos', 'gastos ko ngayon',
      'pila gigasto', 'pila nagasto', 'pila gastos', 'expense total', 'how much did i spend money',
      'ilang piso nagastos', 'ilang piso ang gastos', 'pila nagastos',
      'kailangan ko malaman gastos', 'ano gastos ko',
      'magkano na nagastos', 'magkano ginastos', 'gastos buwan',
      'nangyari sa pera', 'saan napunta pera', 'nasaan na budget',
      'pila kagasto', 'pila ang gastos', 'unsa gastos', 'magkano gastos nako',
      'pila ang nagastos nako', 'pila nako gigasto',
      'what did i spend', 'show my expenses', 'list my expenses',
      'expense report', 'spending report', 'spending summary',
      'how much have i spent', 'what have i spent',
      'how much on', 'spent on', 'spend on', 'expenses on',
      'how much for', 'total for', 'spending on',
      'how much did i spend on', 'how much have i spent on',
      'gastos sa', 'nagastos sa', 'ginastos sa', 'nagasta sa',
      'magkano gastos sa', 'magkano nagastos sa',
      'pila nagastos sa', 'pila gigasto sa',
      'magkano ang gastos sa', 'magkano ang nagastos sa',
      'pila kagasto sa', 'pila ang gastos sa',
      'gigasto sa', 'nagasto sa', 'unsa gastos sa',
      'pila ang nagasto sa', 'pila nako gigasto sa',
      'i want to track what i spent', 'can i check my expenses', 'where did my money go', 'ano mga binayaran ko', 
      'saan napunta pera ko', 'expenses history', 'expense history', 'transaction history', 'show spending',
      'unsa akong gigasto', 'listahanan sa gastos', 'pakita gastos', 'tingnan gastos', 'patingin gastos',
      'gastos pls', 'gastos ko pls', 'gastos lahat', 'tan-awa gastos', 'ipakita gastos',
      'how much did i spend last month', 'pila akong gasto today lang', 'how much did i spend kanina', 'check my expenses this week'
    ],
  },
  query_debts: {
    minScore: 1,
    keywords: [
      'who owes me', 'who owe me', 'who owe', 'what i owe', 'who i owe', 'debt list', 'debts', 'utang list',
      'sino may utang', 'kinsa nay utang', 'kanino ako may utang', 'kanino may utang',
      'kang kinsa ko naay utang', 'kinsay naay utang nako', 'kinsay utangan nako',
      'list of utang', 'all my debts', 'show debts', 'show my debts', 'tell me about my debts', 
      'utang ko', 'utang nila', 'patingin ng utang', 'tignan utang', 'pakita utang', 
      'tan-awa akong utang', 'ipakita utang', 'gusto ko makita utang', 'debt pls'
    ],
  },
  set_budget: {
    minScore: 1,
    keywords: [
      'set my budget', 'set budget', 'change my budget', 'change budget', 'update my budget', 'update budget',
      'set the budget', 'modify my budget', 'adjust my budget', 'adjust budget', 'gawing budget',
      'i-set ang budget', 'iset ang budget', 'set budget to', 'set my budget to', 'change budget to',
      'limit my spending to', 'set spending limit', 'spending limit to', 'limit to',
      'undo budget', 'revert budget', 'rollback budget', 'bawi budget', 'cancel budget'
    ],
  },
  query_budget: {
    minScore: 1,
    keywords: [
      'budget left', 'remaining budget', 'remaining salary', 'budget', 'natitira budget', 'pila nabilin',
      'budget nabilin',
      'natitira pa', 'natitirang budget', 'magkano natitira',
      'pera pa', 'pwede pa ba', 'kaya pa ba',
      'pila nabilin budget', 'pila nay nabilin', 'pila pa nabilin',
      'gihabilin nga budget', 'budget nga nabilin', 'pila pa kwarta',
      'naa pay budget', 'naa pa bay budget',
      'budget remaining', 'how much budget left', 'budget status',
      'do i have budget', 'can i still spend',
      'can i still buy', 'enough budget', 'is my budget enough', 'budget check', 'check budget',
      'tingnan budget', 'patingin budget', 'pakita budget', 'how much is left in my budget',
      'tan-awa budget', 'ipakita budget', 'pila budget'
    ],
  },
  query_missing_wallets: {
    minScore: 1,
    keywords: [
      'other wallet', 'other wallets', 'wallet i dont have', 'wallets i dont have', 'what wallet i dont have', 'what wallets i dont have',
      'missing wallet', 'missing wallets', 'wallet not have', 'wallets not have', 'what wallet missing', 'which wallet missing',
      'wallet i do not have', 'wallets i do not have', 'what wallet do i not have', 'which wallet do i not have',
      'wallet i lack', 'wallets i lack', 'what wallet i lack', 'which wallet i lack',
      'anong wallet wala', 'ano pang wallet wala', 'wallet na wala sakin', 'wallets na wala sakin', 'unsa pa wallet wala nako',
      'wallet nga wala nako', 'unsa pa nga wallet', 'available', 'how many available',
      'anong available na wallet', 'unsa available nga wallet', 'total wallets',
      'show available wallets', 'list available wallets', 'what wallets can i add', 'which wallets can i add',
      'wallets available to add', 'available wallet types', 'what wallet types available',
      'what can i add', 'ano pa pwede idagdag', 'unsa pa pwede iadd', 'what other wallets',
      'missing account', 'missing accounts', 'available accounts'
    ],
  },
  query_balance: {
    minScore: 1,
    keywords: [
      'balance', 'wallet balance', 'how much in', 'magkano sa', 'magkano laman', 'pila sa', 'balanse',
      'show wallet', 'show wallets', 'my wallet', 'my wallets',
      'how many wallets', 'ilang wallet', 'pila ka wallet', 'list of my wallets', 'ano mga wallet ko', 'unsa akong mga wallet',
      'magkano nasa', 'magkano meron', 'ilan nasa wallet', 'ano laman ng',
      'pera ko sa', 'hawak ko sa', 'natitira sa',
      'pila ang naa sa', 'pila naa sa akong', 'unsa naa sa',
      'pila ang sulod sa', 'pila akong kwarta',
      'check balance', 'wallet total', 'show balance', 'total funds',
      'how much do i have', 'how much money do i have',
      'what wallet i have', 'what wallets i have', 'which wallet i have', 'which wallets i have',
      'wallet i have', 'wallets i have', 'what wallet do i have', 'what wallets do i have',
      'which wallet do i have', 'show my wallet', 'show my wallets', 'list my wallets',
      'what are my wallets', 'ano wallets ko', 'ano wallet ko', 'anu wallet meron ako',
      'anong wallet meron ako', 'anong wallets meron ako', 'unsa akong wallet',
      'see my wallet', 'see my wallets', 'see wallet', 'i need to see my wallet',
      'i think i need to see my wallet', 'let me see my wallet', 'show wallet',
      'can i see my wallet', 'view my wallet', 'open my wallet', 'check my wallet',
      'whats in my wallet', 'wallet status', 'my money', 'where is my money',
      'how much money i have', 'total money', 'all my wallets', 'wallet summary',
      'patingin wallet', 'tignan wallet', 'pakita wallet', 'makita wallet',
      'tan-awa wallet', 'ipakita wallet', 'gusto ko makita wallet', 'wallet pls',
      'lemme see wallet', 'wallets ko pls', 'show me my stuff', 'what do i have',
      'check balance for bdo', 'magkano laman ng gcash ko', 'magkano laman ng bpi ko'
    ],
  },
  deposit: {
    minScore: 1,
    keywords: [
      'deposit', 'top up', 'topup', 'add money', 'cash in', 'cashin', 'dagdag', 'hulog', 'pasok',
      'dugang', 'sulod kwarta',
      'help me add', 'help me top up', 'help me deposit',
      'add pesos', 'add peso', 'add funds to', 'add to my account', 'put money in my account',
      'put in my account', 'put money in', 'fund my account',
      'lagyan ng pera', 'lagyan pera', 'ilagay ng pera', 'ilagay pera',
      'pasok pera', 'maglagay ng pera', 'maghulog', 'magdagdag ng',
      'dagdag pera', 'puno ng pera',
      'dagdagan mo', 'dagdagan ko', 'ipasok ang pera',
      'butangan ug kwarta', 'sulod ug kwarta', 'dugang kwarta',
      'ibutang ug kwarta', 'puno sa kwarta',
      'tabangi ko ug dugang', 'tabangi ko ug hulog',
      'put money in', 'add funds', 'load wallet', 'load my',
      'fund my wallet', 'add balance', 'increase balance',
      'i want to add money', 'let me deposit', 'lagay pera', 'hulog pera', 
      'pasok cash', 'deposit pls', 'top up pls', 'pa deposit', 'pa top up',
      'can i top up', 'i need to deposit', 'depo', 'depst'
    ],
  },
  create_debt_i_owe: {
    minScore: 1,
    keywords: [
      'i owe', 'i borrowed', 'utang ko', 'nangutang ako', 'borrowed from', 'utang nako', 'nanghulam ko',
      'may bayad ako', 'may utang ako', 'naghiram ako', 'hiniram ko',
      'nakautang ako', 'pwede bang makahiram',
      'nangutang ko', 'naa koy utang', 'gihulam nako', 'nakautang ko',
      'koy utang', 'nangayo ug pautang',
      'hiram pera', 'borrow money', 'my payable', 'babayaran ko', 'utang ko kay'
    ],
  },
  create_debt_owed_to_me: {
    minScore: 1,
    keywords: [
      'owes me', 'lent', 'pinautang', 'may utang sakin', 'utang niya sakin', 'giutangan ko', 'naa siyay utang nako', 'utang niya sa ako',
      'may utang sa akin', 'pinahiram ko', 'pinautangan ko',
      'nagpautang ako', 'may utang siya sa akin',
      'naa siyay utang kanako', 'giutangan nako siya', 'gipautangan ko',
      'nagpautang ko', 'naay utang sa ako',
      'pautang ko', 'my receivable', 'may bayad sakin', 'singilin ko', 'utang ni'
    ],
  },
  pay_debt: {
    minScore: 1,
    keywords: [
      'pay debt', 'paid debt', 'mark paid', 'settle debt', 'partial pay', 'bayad utang', 'binayad', 'magbayad',
      'partially paid', 'bayad na utang', 'settle utang',
      'babayaran ang utang', 'bayaran na utang', 'nakapagbayad',
      'ibinayad na', 'nabayaran na',
      'mibayad na utang', 'nabayran na', 'husay utang', 'nabayad na ang utang',
      'gibayran na', 'bayri ang utang',
      'cleared debt', 'debt paid', 'finished paying', 'done paying',
      'already paid', 'fully paid',
      'bayad na', 'settled na', 'paid na', 'pay off', 'paid off'
    ],
  },
  log_expense: {
    minScore: 1,
    keywords: [
      'expense', 'spent', 'spend', 'buy', 'bought', 'paid for', 'gastos', 'ginastos', 'nagastos',
      'gigasto', 'nagasto', 'palit', 'bayad sa',
      'bumili', 'nagbayad', 'bayad para sa', 'gasto', 'mga nagastos', 'nabili', 'pinambili',
      'add 150 pesos for transpo', 'bumili ako ng drinks for 100', 'add 2000 pesos for food', 'bumili ako ng electricity for 2000', 'i spent 200 on transpo',
      'food', 'transpo'
    ],
  },
  create_wallet: {
    minScore: 1,
    keywords: [
      'new wallet', 'create wallet', 'add wallet', 'gawa wallet', 'bagong wallet', 'add account',
      'bag-o wallet', 'himo wallet', 'can we add', 'i want to add', 'puwede mag add', 'gusto mag add',
      'gusto ko mag add', 'add gcash', 'add maya', 'add bpi', 'add bdo', 'add maribank', 'add gotyme',
      'add shopeepay', 'add coins', 'add unionbank', 'add metrobank', 'add credit card', 'add debit card',
      'create new', 'add a wallet', 'make wallet', 'gumawa ng wallet', 'open wallet',
      'gawa ka gcash wallet', 'create a new wallet for maya', 'add my maya account',
      'open account', 'new account', 'wallet add'
    ],
  },
  create_savings_goal: {
    minScore: 1,
    keywords: [
      'save', 'savings goal', 'saving for', 'saving up', 'want to save',
      'set aside', 'saving money', 'emergency fund',
      'mag-ipon', 'magipon', 'ipon', 'pang-ipon', 'para sa ipon',
      'gusto mag-ipon', 'mag-iipon', 'itabi ang pera',
      'magtipig', 'tipig', 'gusto mutipig', 'pang tipig'
    ],
  },
  transfer: {
    minScore: 1,
    keywords: [
      'transfer', 'move money', 'send money', 'move funds',
      'send from', 'move from', 'transfer from',
      'ilipat', 'lipat pera', 'ilipat ang pera', 'padalhan',
      'padala sa', 'ilipat sa', 'lipat ng pera',
      'ibalhin', 'balhin kwarta', 'ipadala sa', 'ipasa sa',
      'balhin ug kwarta', 'ibalhin sa',
      'pasa pera', 'send funds', 'mag transfer', 'pa transfer', 'xfer'
    ],
  },
  ask_help: {
    minScore: 1,
    keywords: [
      '/help', 'what can you do', 'commands', 'unsa imong mahimo', 'tabang',
      'tulong', 'how to use', 'paano gamitin', 'unsaon paggamit'
    ],
  },
  ask_tips: {
    minScore: 1,
    keywords: [
      'tips', 'advice', 'insight', 'suggest', 'tip', 'recommend', 'hingi payo', 'tambag',
      'advice me', 'give me tips', 'how to save'
    ],
  },
  flow_help: {
    minScore: 1,
    keywords: [
      'how to add wallet', 'how do i add wallet', 'how to create wallet', 'how do i create wallet',
      'how can i add wallet', 'how i add wallet', 'wallet add please',
      'how to deposit', 'how do i deposit', 'how to transfer', 'how do i transfer',
      'how can i deposit', 'how i deposit money', 'how can i transfer', 'how i transfer money',
      'how to log expense', 'how do i log expense', 'how to add expense', 'how to track expense',
      'how can i log expense', 'how i add my expense',
      'how to add debt', 'how to pay debt', 'how do i pay debt',
      'how can i track debt', 'how i can pay utang',
      'how to check budget', 'how to set budget',
      'how can i check budget', 'how i set budget',
      'paano mag add wallet', 'paano gumawa wallet', 'paano mag deposit', 'paano mag transfer',
      'paano mag log ng gastos', 'paano mag add ng utang', 'paano magbayad ng utang',
      'paano i check budget', 'paano mag set budget',
      'unsaon pag add wallet', 'unsaon paghimo wallet', 'unsaon pag deposit', 'unsaon pag transfer',
      'unsaon pag log expense', 'unsaon pag track utang', 'unsaon pag set budget',
      'how does this work', 'how this works in pamilya', 'how to use elefam', 'how to use pamilya',
      'help me use elefam', 'teach me elefam', 'guide me in pamilya'
    ],
  },
}

const FINANCE_HINTS = [
  'expense', 'wallet', 'debt', 'deposit', 'budget', 'salary', 'income', 'spend', 'gastos', 'utang', 'balanse', 'balance',
  'owe', 'lent', 'lend', 'borrow', 'pay', 'paid', 'bayad', 'kwarta', 'pera', 'gotyme', 'maribank',
  'transfer', 'withdraw', 'savings', 'save', 'ipon', 'fund', 'cash out',
  'remit', 'send money', 'receive', 'transaction', 'receipt',
  'gastusin', 'magbayad', 'maghulog', 'magdeposit', 'magwithdraw',
  'maglipat', 'natitira', 'natirang', 'pautang', 'pinahiram',
  'tipig', 'ibalhin', 'gasto', 'bayri', 'pangita kwarta',
  'naa pay', 'pila nay', 'gipautangan',
  'see', 'check', 'view', 'show', 'look', 'open', 'status', 'summary',
  'remaining', 'left', 'available', 'total', 'account', 'money',
  'how much', 'magkano', 'pila', 'tignan', 'pakita', 'ipakita'
]
// FIXED: expanded finance guard hints to reduce false unknown/guard blocks

const COMMON_REPLACEMENTS = [
  [/\bpls\b/g, 'please'],
  [/\bplss\b/g, 'please'],
  [/\bim\b/g, 'i am'],
  [/\bi\'m\b/g, 'i am'],
  [/\bdont\b/g, 'do not'],
  [/\bdoesnt\b/g, 'does not'],
  [/\bcant\b/g, 'can not'],
  [/\bwont\b/g, 'will not'],
  [/\bcud\b/g, 'could'],
  [/\bshud\b/g, 'should'],
  [/\bwud\b/g, 'would'],
  [/\bu\b/g, 'you'],
  [/\bur\b/g, 'your'],
  [/\bwat\b/g, 'what'],
  [/\bwut\b/g, 'what'],
  [/\bhw\b/g, 'how'],
  [/\bfrm\b/g, 'from'],
  [/\bwit\b/g, 'with'],
  [/\bwid\b/g, 'with'],
  [/\bdepo\b/g, 'deposit'],
  [/\btrasnfer\b/g, 'transfer'],
  [/\btranfer\b/g, 'transfer'],
  [/\btrnasfer\b/g, 'transfer'],
  [/\bexpnse\b/g, 'expense'],
  [/\bexpence\b/g, 'expense'],
  [/\bbalnce\b/g, 'balance'],
  [/\bbudjet\b/g, 'budget'],
  [/\bdebtz\b/g, 'debt'],
  [/\bwalet\b/g, 'wallet'],
  [/\bbalanse\b/g, 'balance'],
  [/\bxfer\b/g, 'transfer'],
  [/\bgcsh\b/g, 'gcash'],
  [/\bmya\b/g, 'maya'],
  [/\bexpns\b/g, 'expense'],
  [/\bdpst\b/g, 'deposit'],
  [/\btrnsfr\b/g, 'transfer'],
  [/\bwal\b/g, 'wallet'],
  [/\bhwmch\b/g, 'how much'],
  [/\bspnt\b/g, 'spent'],
]

function normalizeCommonTypos(text = '') {
  let value = String(text || '')
  for (const [pattern, replacement] of COMMON_REPLACEMENTS) {
    value = value.replace(pattern, replacement)
  }
  return value
}

function normalize(text = '') {
  return normalizeCommonTypos(String(text))
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
  const queryIntents = ['query_expenses', 'query_debts', 'query_budget', 'query_missing_wallets', 'query_balance', 'ask_help', 'ask_tips', 'flow_help']
  return queryIntents.includes(intentName) ? 'query' : 'action'
}
