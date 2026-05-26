import { normalizeText } from '@/lib/chatIntents.js'

export const CATEGORY_MAP = {
  food: ['food', 'pagkain', 'kaon', 'meal', 'restaurant', 'groceries', 'grocery', 'palengke', 'market', 'lunch', 'dinner', 'breakfast', 'snack'],
  transport: ['transport', 'pamasahe', 'sakay', 'gas', 'fuel'],
  bills: ['bill', 'bills', 'utility', 'kuryente', 'tubig', 'internet', 'rent'],
  shopping: ['shopping', 'online shop', 'lazada', 'shopee', 'gadget', 'clothing'],
  health: ['health', 'hospital', 'gamot', 'medicine', 'clinic'],
  education: ['school', 'tuition', 'education', 'eskwela'],
  debt: ['debt', 'utang', 'bayad utang'],
}

export const CATEGORY_LABELS = {
  food: 'Food',
  transport: 'Transport',
  bills: 'Bills',
  shopping: 'Shopping',
  health: 'Health',
  education: 'Education',
  debt: 'Debt',
  expense: 'Expense',
}
// FIXED: exported for use in handleQueryExpenses category filtering

const KNOWN_WALLET_TYPES = [
  'cash', 'gcash', 'maya', 'bpi', 'bdo', 'unionbank', 'metrobank',
  'credit_card', 'debit_card', 'shopeepay', 'coins_ph', 'gotyme', 'maribank',
]

const WALLET_TYPE_ALIASES = {
  coins: 'coins_ph',
  coinsph: 'coins_ph',
  'coins.ph': 'coins_ph',
  'coins ph': 'coins_ph',
  gotime: 'gotyme',
  'go tyme': 'gotyme',
  'go-time': 'gotyme',
  shopee: 'shopeepay',
  'credit card': 'credit_card',
  'debit card': 'debit_card',
}

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
  gotyme: 'GoTyme',
  maribank: 'Maribank',
}

export const WALLET_DEFINITIONS = KNOWN_WALLET_TYPES.map((type) => ({
  type,
  label: KNOWN_WALLET_LABELS[type] || type,
}))

const NUMBER_WORDS_PH = {
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80,
  ninety: 90, hundred: 100, thousand: 1000, million: 1000000,

  // Tagalog
  isa: 1, isang: 1,
  dalawa: 2, dalawang: 2,
  tatlo: 3, tatlong: 3,
  apat: 4, 'apat na': 4,
  lima: 5, limang: 5,
  anim: 6, 'anim na': 6,
  pito: 7, pitong: 7,
  walo: 8, walong: 8,
  siyam: 9, 'siyam na': 9,
  sampu: 10, sampung: 10,
  'labing-isa': 11, labinisa: 11,
  'labing-dalawa': 12, labindalawa: 12,
  dalawampu: 20, dalawampung: 20,
  tatlumpu: 30, tatlumpung: 30,
  apatnapu: 40, apatnapung: 40,
  limampu: 50, limampung: 50,
  animnapu: 60, animnapung: 60,
  pitumpu: 70, pitumpung: 70,
  walumpu: 80, walumpung: 80,
  siyamnapu: 90, siyamnapung: 90,
  daan: 100, daang: 100, libo: 1000, libong: 1000,
  milyon: 1000000,

  // Bisaya
  usa: 1, usang: 1,
  duha: 2, duhang: 2,
  tulo: 3, tulong: 3,
  upat: 4, upatng: 4,
  unom: 6, unomng: 6,
  napulo: 10, napulong: 10,
  kawhaan: 20,
  katlohan: 30,
  kwarenta: 40,
  singkwenta: 50,
  syentus: 100,
  mil: 1000,
}

function parseWrittenAmount(text = '') {
  const words = text.toLowerCase().split(/\s+/)
  let total = 0
  let current = 0

  for (const word of words) {
    const val = NUMBER_WORDS_PH[word]
    if (val === undefined) continue

    if (val === 1000000) {
      current = current === 0 ? 1 : current
      total += current * val
      current = 0
    } else if (val === 1000) {
      current = current === 0 ? 1 : current
      total += current * val
      current = 0
    } else if (val === 100) {
      current = current === 0 ? 1 : current
      current *= val
    } else {
      current += val
    }
  }

  total += current
  return total > 0 ? total : null
}

export function extractAmount(text = '') {
  const raw = String(text || '').toLowerCase()
  const normalized = normalizeText(text)
  const match = raw.match(/(?:₱|php|peso|pesos)?\s*(\d[\d,]*\.?\d*)\s*(?:([km])(?![a-z]))?/i)
  if (match) {
    const base = parseFloat(String(match[1]).replace(/,/g, ''))
    if (!Number.isFinite(base)) return null

    const suffix = String(match[2] || '').toLowerCase()
    const multiplier = suffix === 'k' ? 1000 : suffix === 'm' ? 1000000 : 1
    return base * multiplier
  }

  // FIXED: fallback parsing for written numbers in English/Tagalog/Bisaya
  return parseWrittenAmount(normalized)
}

export function detectCategory(text = '') {
  const normalized = normalizeText(text)
  for (const [categoryKey, words] of Object.entries(CATEGORY_MAP)) {
    const found = words.find((w) => normalized.includes(w))
    if (found) {
      return categoryKey // FIXED: return standardized category key for consistent storage/filtering
    }
  }
  return 'expense' // FIXED: normalized default category key
}

export function getCategoryLabel(key = '') {
  return CATEGORY_LABELS[String(key).toLowerCase()] || 'Expense'
}

function compactWalletToken(text = '') {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function byNameMatch(wallets = [], normalizedText = '') {
  const compactText = compactWalletToken(normalizedText)
  const sorted = [...wallets].sort((a, b) => (b.name || '').length - (a.name || '').length)
  return sorted.find((w) => {
    const name = String(w.name || '').toLowerCase().trim()
    if (!name) return false
    if (normalizedText.includes(name)) return true
    const normalizedName = normalizeText(name)
    if (normalizedName && normalizedText.includes(normalizedName)) return true
    const compactName = compactWalletToken(name)
    return compactName ? compactText.includes(compactName) : false
  })
}

function byTypeMatch(wallets = [], normalizedText = '') {
  const compactText = compactWalletToken(normalizedText)

  const aliases = Object.entries(WALLET_TYPE_ALIASES)
    .sort((a, b) => b[0].length - a[0].length)

  let matchedType = null
  for (const [alias, canonical] of aliases) {
    const compactAlias = compactWalletToken(alias)
    if (compactAlias && compactText.includes(compactAlias)) {
      matchedType = canonical
      break
    }
  }

  if (!matchedType) {
    const sorted = [...KNOWN_WALLET_TYPES].sort((a, b) => b.length - a.length)
    matchedType = sorted.find((type) => {
      const typeWithSpace = type.replace('_', ' ')
      if (normalizedText.includes(typeWithSpace)) return true
      return compactText.includes(compactWalletToken(typeWithSpace))
    })
  }

  if (!matchedType) return null
  return wallets.find((w) => String(w.type || '').toLowerCase() === matchedType) || null
}

export function matchWallet(text = '', wallets = []) {
  const normalized = normalizeText(text)
  return byNameMatch(wallets, normalized) || byTypeMatch(wallets, normalized) || null
}

const TRANSFER_FROM_MARKERS = [
  'from', 'mula sa', 'mula', 'gikan sa', 'gikan', 'galing sa', 'galing'
]

const TRANSFER_TO_MARKERS = [
  'to', 'to my', 'papunta sa', 'papunta', 'sa', 'ngadto sa', 'ngadto',
  'patungo sa', 'patungo', 'padala sa'
]

export function extractTransferWallets(text = '', wallets = []) {
  // FIXED: extractTransferWallets added
  const normalized = normalizeText(text)

  let fromSegment = null
  let toSegment = null

  const fromMarkers = [...TRANSFER_FROM_MARKERS].sort((a, b) => b.length - a.length)
  const toMarkers = [...TRANSFER_TO_MARKERS].sort((a, b) => b.length - a.length)

  let fromIdx = -1
  let fromMarkerLen = 0
  for (const marker of fromMarkers) {
    const idx = normalized.indexOf(marker)
    if (idx !== -1) {
      fromIdx = idx
      fromMarkerLen = marker.length
      break
    }
  }

  let toIdx = -1
  let toMarkerLen = 0
  for (const marker of toMarkers) {
    const idx = normalized.indexOf(marker)
    if (idx !== -1 && idx > fromIdx) {
      toIdx = idx
      toMarkerLen = marker.length
      break
    }
  }

  if (fromIdx !== -1 && toIdx !== -1) {
    fromSegment = normalized.slice(fromIdx + fromMarkerLen, toIdx).trim()
    toSegment = normalized.slice(toIdx + toMarkerLen).trim().slice(0, 30)
  } else if (fromIdx !== -1 && toIdx === -1) {
    fromSegment = normalized.slice(fromIdx + fromMarkerLen).trim().slice(0, 30)
  } else if (fromIdx === -1 && toIdx !== -1) {
    fromSegment = normalized.slice(0, toIdx).trim()
    toSegment = normalized.slice(toIdx + toMarkerLen).trim().slice(0, 30)
  }

  const fromWallet = fromSegment
    ? matchWallet(fromSegment, wallets)
    : null

  const toWallet = toSegment
    ? matchWallet(toSegment, wallets)
    : null

  if (!fromWallet || !toWallet) {
    const matched = []
    let textToMatch = normalized
    const possibleStrings = []
    wallets.forEach(w => {
      if (w.name) possibleStrings.push({ str: String(w.name).toLowerCase(), wallet: w })
      if (w.type) possibleStrings.push({ str: String(w.type).toLowerCase().replace('_', ' '), wallet: w })
    })
    possibleStrings.sort((a, b) => b.str.length - a.str.length)

    for (const item of possibleStrings) {
      if (fromWallet && item.wallet.id === fromWallet.id) continue
      if (toWallet && item.wallet.id === toWallet.id) continue
      if (matched.find(m => m.id === item.wallet.id)) continue

      if (textToMatch.includes(item.str)) {
        matched.push(item.wallet)
        textToMatch = textToMatch.replace(item.str, ' ')
        if (matched.length >= 2) break
      }
    }
    return {
      from: fromWallet || matched[0] || null,
      to: toWallet || matched[1] || null,
    }
  }

  return { from: fromWallet, to: toWallet }
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
  const exclude = [
    'i', 'me', 'my', 'the', 'a', 'an', 'and', 'or', 'is', 'it',
    'money', 'cash', 'wallet', 'for', 'from', 'to', 'peso', 'piso', 'pera',
    'gcash', 'maya', 'bpi', 'bdo', 'unionbank', 'metrobank',
    'credit', 'credit_card', 'debit', 'debit_card', 'shopeepay',
    'coins', 'coins_ph', 'gotyme', 'maribank',
    'pay', 'paid', 'debt', 'partial', 'lent', 'borrowed',
    'bayad', 'utang', 'accounts', 'balance', 'transfer',
  ] // FIXED: prevent wallet/action leakage into person extraction
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
  // Sort by length descending so longer types match first (e.g. "gcash" before "cash")
  const sorted = [...KNOWN_WALLET_TYPES].sort((a, b) => b.length - a.length)
  for (const type of sorted) {
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
    const walletTokens = [
      String(wallet.name || '').toLowerCase(),
      normalizeText(String(wallet.name || '')),
      String(wallet.type || '').toLowerCase().replace(/_/g, ' '),
    ].filter(Boolean)

    walletTokens.forEach((token) => {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ')
    })
  }

  // 3. Remove common keywords
  const noise = [
    'spent', 'spend', 'spending', 'logged', 'buy', 'bought', 'expense', 'gastos', 'nagasto', 'bayad', 'payment', 
    'for', 'to', 'from', 'sa', 'kay', 'ni', 'via', 'using', 'using my', 'at', 'with', 'the',
    'a', 'an', 'and', 'or', 'is', 'my', 'me', 'i',
    'today', 'yesterday', 'now', 'ngayon', 'karon', 'kanina',
    'this', 'month', 'week', 'day'
  ]
  
  noise.forEach(n => {
    const reg = new RegExp(`\\b${n}\\b`, 'gi')
    cleaned = cleaned.replace(reg, ' ')
  })

  // 4. Cleanup
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  if (!cleaned) return null
  
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
  if (lower.includes('gotyme') || lower.includes('go tyme')) return 'gotyme'
  if (lower.includes('maribank') || lower.includes('mari bank')) return 'maribank'
  return 'cash'
}
