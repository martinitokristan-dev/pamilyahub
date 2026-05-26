import { normalizeText } from '@/lib/chatIntents.js'
import { ENGLISH_SYNONYMS } from '@/lib/knowledge/index.js'

const ENGLISH_WORD_TO_INTENT = {
  spend: 'log_expense',
  expense: 'log_expense',
  pay: 'log_expense',
  purchase: 'log_expense',
  buy: 'log_expense',
  wallet: 'create_wallet',
  account: 'create_wallet',
  balance: 'query_balance',
  deposit: 'deposit',
  transfer: 'transfer',
  debt: 'query_debts',
  owe: 'create_debt_i_owe',
  borrow: 'create_debt_i_owe',
  lend: 'create_debt_owed_to_me',
  budget: 'query_budget',
  save: 'create_savings_goal',
  savings: 'create_savings_goal',
  tip: 'ask_tips',
  advise: 'ask_tips',
}

// Large phrase mappings covering English, Tagalog, and Bisaya
const SYNONYM_GROUPS = {
  deposit: [
    'put money', 'add cash', 'load up', 'fill wallet',
    'lagay pera', 'dagdag funds', 'top up account', 'ihulog',
    'pasok pera', 'nag add ako', 'nag lagay', 'maglagay',
    'butang kwarta', 'dungag kwarta', 'nag butang',
    'add to wallet', 'fund wallet', 'put in wallet',
    'puno ng pera', 'butangan ug kwarta', 'mag top up',
    'top up wallet', 'load up wallet', 'add funds to'
  ],
  log_expense: [
    'i paid for', 'bought something', 'gastusin ko', 'nabili ko',
    'may binayaran', 'bumili ako', 'ginastos ko', 'nagbayad ako',
    'naggastos ako', 'nabayran nako', 'gipalit nako', 'nagasto',
    'bayad sa', 'spent on', 'paid to',
    'i paid', 'i bought', 'may bayad ako',
    'ginastos ko', 'nagasto ako', 'nagastos',
    'para sa', 'bayad para sa', 'kumuha ako',
    'add 150 pesos for transpo', 'bumili ako ng drinks for 100', 'add 2000 pesos for food', 'bumili ako ng electricity for 2000', 'i spent 200 on transpo'
  ],
  query_balance: [
    'how much do i have', 'check my funds', 'pera ko',
    'ano laman wallet ko', 'tignan ko balance', 'magkano pera',
    'pila akoa kwarta', 'unsa nay sulod', 'pila nay sulod',
    'how much money', 'show balance', 'whats my balance',
    'can i see my money',
    'pera ko', 'kwarta ko', 'how much money do i have',
    'total ko', 'combined balance', 'all balance',
    'lahat ng wallet', 'all wallets', 'check my wallet',
    'check balance for bdo', 'magkano laman ng gcash ko', 'magkano laman ng bpi ko'
  ],
  query_expenses: [
    'how much spent', 'ano gastos', 'magkano gastos',
    'pila nagasto', 'pila gigasto', 'what did i spend',
    'saan napunta pera ko', 'asa napunta', 'spending today',
    'check my expenses this week', 'pila akong gasto today lang', 'how much did i spend kanina'
  ],
  query_budget: [
    'budget left', 'how much can i spend', 'magkano pa pwede',
    'pila pa pwede', 'can i still buy', 'safe to spend',
    'pwede pa ba gumastos', 'naa pa bay budget'
  ],
  set_budget: [
    'set my budget', 'set budget', 'change my budget', 'change budget', 'update my budget', 'update budget',
    'set the budget', 'modify my budget', 'adjust my budget', 'adjust budget', 'gawing budget',
    'i-set ang budget', 'iset ang budget', 'set budget to', 'set my budget to', 'change budget to',
    'limit my spending to', 'set spending limit', 'spending limit to', 'limit to',
    'undo budget', 'revert budget', 'rollback budget', 'bawi budget', 'cancel budget'
  ],
  create_debt_owed_to_me: [
    'borrowed from me', 'umutang sakin', 'nangutang sakin',
    'niborrow nako', 'nakautang nako', 'he owes me', 'she owes me',
    'i loaned', 'owes me', 'utang sakin', 'utang nako'
  ],
  create_debt_i_owe: [
    'i owe him', 'i owe her', 'umutang ako', 'nangutang ako',
    'niborrow ko', 'i owe', 'utang ko'
  ],
  transfer: [
    'move money', 'transfer cash', 'lipat pera',
    'pasa pera', 'send funds', 'balhin kwarta',
    'ipasa nako', 'ilipat sa'
  ],
  query_debts: [
    'list debts', 'show debts', 'show utang', 'list utang',
    'debt list', 'utang list', 'sino may utang', 'kinsay may utang',
    'who owes me', 'who do i owe', 'what i owe', 'what i owe right now',
    'kanino ako may utang', 'pila utang nako',
    'my debts', 'aking utang', 'akong utang',
    'outstanding debts', 'open debts', 'active debts'
  ],
  pay_debt: [
    'pay off debt', 'settle debt', 'clear debt',
    'bayad utang', 'settle utang', 'husay utang',
    'mark as paid', 'mark paid', 'fully paid',
    'bayad na utang', 'binayad na', 'nabayaran na',
    'finished paying', 'done paying', 'paid off',
    'gibayran na', 'mibayad na', 'nabayad na'
  ],
  query_missing_wallets: [
    'what wallet i dont have', 'missing wallet', 'wallet i lack',
    'available wallet', 'show available wallets', 'what wallet can i add',
    'wallet not added', 'wallets i need', 'wallet suggestions',
    'anong wallet wala ako', 'unsa wallet wala nako',
    'complete my wallets', 'wallet collection'
  ],
  create_wallet: [
    'open wallet', 'setup wallet', 'wallet setup', 'make wallet',
    'start wallet', 'create account', 'new account',
    'add account', 'open account', 'setup account',
    'gawa ng wallet', 'bagong wallet', 'himo og wallet',
    'gusto ko ng wallet', 'kailangan ko ng wallet',
    'i need a wallet', 'i want a wallet', 'add my wallet',
    'gawa ka gcash wallet', 'create a new wallet for maya', 'add my maya account'
  ],
  ask_tips: [
    'give me tips', 'finance tips', 'money tips', 'spending advice',
    'payo tungkol sa pera', 'tambag sa pera', 'financial advice',
    'budget advice', 'saving tips', 'money saving tips',
    'how to save', 'money advice', 'finance advice',
    'give me insights', 'financial insight', 'spending insight'
  ],
  create_savings_goal: [
    'i want to save', 'i want to save money', 'i want to ipon',
    'create savings', 'set savings goal', 'savings plan',
    'mag ipon', 'magtipig', 'ipon goal', 'savings target',
    'emergency fund', 'set aside money', 'saving for something',
    'saving up for', 'build savings', 'start saving'
  ]
}

// Patterns that hint at intent based on conversational context
const CONTEXTUAL_PATTERNS = [
  { intent: 'query_balance', pattern: /can you check .* (wallet|balance|money|cash)/i },
  { intent: 'query_expenses', pattern: /(show me|tignan ko|pakita) .* (expenses|gastos)/i },
  { intent: 'create_wallet', pattern: /(i need to|help me|paano) .* (add|create|make) .* wallet/i }
]

export function matchSynonyms(text) {
  const normalizedText = normalizeText(text)
  const tokens = normalizedText.split(/\s+/).filter(Boolean)

  let bestIntent = null
  let maxScore = 0

  // 1. Check phrase groups
  for (const [intentName, phrases] of Object.entries(SYNONYM_GROUPS)) {
    for (const phrase of phrases) {
      if (normalizedText.includes(phrase)) {
        // Any synonym phrase match is a strong signal — score based on
        // word count rather than character count to avoid penalizing
        // short but valid phrases like "nagasto" or "pera ko"
        const wordCount = phrase.split(/\s+/).length
        const score = Math.min(0.85, 0.75 + wordCount * 0.05)
        if (score > maxScore) {
          maxScore = score
          bestIntent = intentName
        }
      }
    }
  }

  // 2. Check contextual patterns
  for (const ctx of CONTEXTUAL_PATTERNS) {
    if (ctx.pattern.test(text)) { // test against original text for punctuation
      const score = 0.85
      if (score > maxScore) {
        maxScore = score
        bestIntent = ctx.intent
      }
    }
  }

  // 3. Generated English synonym graph fallback
  // Use lexicon-linked synonyms to infer likely intent even when
  // user wording is not in static phrase groups.
  for (const token of tokens) {
    const directIntent = ENGLISH_WORD_TO_INTENT[token]
    if (directIntent && 0.7 > maxScore) {
      maxScore = 0.7
      bestIntent = directIntent
    }

    const syns = ENGLISH_SYNONYMS[token]
    if (!Array.isArray(syns) || syns.length === 0) continue

    for (const syn of syns) {
      const synIntent = ENGLISH_WORD_TO_INTENT[syn]
      if (!synIntent) continue
      const score = synIntent === directIntent ? 0.75 : 0.65
      if (score > maxScore) {
        maxScore = score
        bestIntent = synIntent
      }
    }
  }

  let confidence = 0
  if (maxScore > 0.7) confidence = 0.8 // High
  else if (maxScore > 0.4) confidence = 0.5 // Medium
  else if (maxScore > 0) confidence = 0.2 // Low

  return {
    intent: bestIntent,
    score: maxScore,
    confidence
  }
}
