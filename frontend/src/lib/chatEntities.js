import { normalizeText } from '@/lib/chatIntents.js'

const CATEGORY_MAP = {
  food: ['food', 'pagkain', 'kaon', 'meal', 'restaurant', 'groceries', 'grocery', 'palengke', 'market', 'lunch', 'dinner', 'breakfast', 'snack'],
  transport: ['transport', 'pamasahe', 'sakay', 'gas', 'fuel'],
  bills: ['bill', 'bills', 'utility', 'kuryente', 'tubig', 'internet', 'rent'],
  shopping: ['shopping', 'online shop', 'lazada', 'shopee', 'gadget', 'clothing'],
  health: ['health', 'hospital', 'gamot', 'medicine', 'clinic'],
  education: ['school', 'tuition', 'education', 'eskwela'],
  debt: ['debt', 'utang', 'bayad utang'],
}

const KNOWN_WALLET_TYPES = [
  'cash', 'gcash', 'maya', 'bpi', 'bdo', 'unionbank', 'metrobank',
  'credit_card', 'debit_card', 'shopeepay', 'coins_ph',
]

const KNOWN_WALLET_LABELS = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  bpi: 'BPI',
  bdo: 'BDO',
  unionbank: 'UnionBank',
  metrobank: 'Metrobank',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  shopeepay: 'ShopeePay',
  coins_ph: 'Coins.ph',
}

export function extractAmount(text = '') {
  const normalized = normalizeText(text)
  const match = normalized.match(/(?:₱|php|peso|pesos)?\s*(\d[\d,]*\.?\d*)\s*([km])?/i)
  if (!match) return null
  const base = parseFloat(String(match[1]).replace(/,/g, ''))
  if (!Number.isFinite(base)) return null

  const suffix = String(match[2] || '').toLowerCase()
  const multiplier = suffix === 'k' ? 1000 : suffix === 'm' ? 1000000 : 1
  return base * multiplier
}

export function detectCategory(text = '') {
  const normalized = normalizeText(text)
  for (const [_, words] of Object.entries(CATEGORY_MAP)) {
    const found = words.find((w) => normalized.includes(w))
    if (found) {
      // Capitalize keyword for the title
      return found.charAt(0).toUpperCase() + found.slice(1)
    }
  }
  return 'Expense'
}

function byNameMatch(wallets = [], normalizedText = '') {
  return wallets.find((w) => normalizedText.includes(String(w.name || '').toLowerCase()))
}

function byTypeMatch(wallets = [], normalizedText = '') {
  const matchedType = KNOWN_WALLET_TYPES.find((type) => normalizedText.includes(type.replace('_', ' ')))
  if (!matchedType) return null
  return wallets.find((w) => String(w.type || '').toLowerCase() === matchedType) || null
}

export function matchWallet(text = '', wallets = []) {
  const normalized = normalizeText(text)
  return byNameMatch(wallets, normalized) || byTypeMatch(wallets, normalized) || null
}

export function extractPersonName(text = '') {
  const normalized = normalizeText(text)
  const cleaned = normalized
    .replace(/(?:i owe|owes me|lent|borrowed|utang ko|utang nako|bayad|pay|paid|debt|partial|mark paid)/g, ' ')
    .replace(/(?:₱|php|peso|pesos)?\s*\d[\d,]*\.?\d*/g, ' ')
    .replace(/(?:from|to|kay|kang|ni|sa|for|me|my|i|ako|nako|ko|si|ang|money|cash|wallet|accounts)\s+/g, ' ')
    .replace(/\s+(?:from|to|kay|kang|ni|sa|for|me|my|i|ako|nako|ko|si|ang|money|cash|wallet|accounts)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return null
  const exclude = ['i', 'me', 'my', 'money', 'cash', 'wallet', 'for', 'the', 'a', 'an']
  const words = cleaned.split(' ').filter(w => !exclude.includes(w.toLowerCase()))
  const first = words[0]
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : null
}

export function extractWalletNameForCreate(text = '') {
  const normalized = normalizeText(text)
  const match = normalized.match(/(?:wallet|create wallet|new wallet|add wallet|gawa wallet|bag-o wallet)\s+([a-z0-9_\- ]+)/i)
  if (!match) return null
  return match[1]
    .replace(/\s*(?:with|na|balance|balanse|put|add|deposit|hulog|dugang)\s*(?:₱|php|peso|pesos)?\s*\d[\d,]*\.?\d*\s*(?:k|m)?(?:\s*(?:peso|pesos))?.*$/i, '')
    .replace(/\s*(?:₱|php|peso|pesos)?\s*\d[\d,]*\.?\d*\s*(?:k|m)?(?:\s*(?:peso|pesos))?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function extractWalletTypeFromText(text = '') {
  const normalized = normalizeText(text)
  for (const type of KNOWN_WALLET_TYPES) {
    if (normalized.includes(type.replace('_', ' '))) return type
  }
  return null
}

export function canonicalWalletNameFromType(type = '') {
  return KNOWN_WALLET_LABELS[String(type || '').toLowerCase()] || null
}

export function extractExpenseReason(text = '', wallets = []) {
  const normalized = normalizeText(text)
  
  // 1. Remove amount
  let cleaned = normalized.replace(/(?:₱|php|peso|pesos)?\s*\d[\d,]*\.?\d*\s*(?:k|m)?/i, ' ')
  
  // 2. Remove wallet name
  const wallet = matchWallet(text, wallets)
  if (wallet) {
    const wName = String(wallet.name).toLowerCase()
    cleaned = cleaned.replace(wName, ' ')
  }

  // 3. Remove common keywords
  const noise = [
    'spent', 'logged', 'buy', 'bought', 'expense', 'gastos', 'nagasto', 'bayad', 'payment', 
    'for', 'to', 'from', 'sa', 'kay', 'ni', 'via', 'using', 'using my', 'at', 'with', 'the',
    'a', 'an', 'and', 'or', 'is', 'my', 'me', 'i'
  ]
  
  noise.forEach(n => {
    const reg = new RegExp(`\\b${n}\\b`, 'gi')
    cleaned = cleaned.replace(reg, ' ')
  })

  // 4. Cleanup
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  if (!cleaned) return 'Expense'
  
  // Capitalize
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function inferWalletType(walletName = '') {
  const lower = String(walletName).toLowerCase()
  if (KNOWN_WALLET_TYPES.includes(lower)) return lower
  if (lower.includes('gcash')) return 'gcash'
  if (lower.includes('maya')) return 'maya'
  if (lower.includes('bpi')) return 'bpi'
  if (lower.includes('bdo')) return 'bdo'
  if (lower.includes('unionbank')) return 'unionbank'
  if (lower.includes('metrobank')) return 'metrobank'
  if (lower.includes('credit')) return 'credit_card'
  if (lower.includes('debit')) return 'debit_card'
  if (lower.includes('coins')) return 'coins_ph'
  if (lower.includes('shopee')) return 'shopeepay'
  return 'cash'
}
