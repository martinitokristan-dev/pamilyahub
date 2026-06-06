import {
  inferWalletType,
  KNOWN_WALLET_TYPES,
  WALLET_TYPE_ALIASES,
  extractWalletTypeFromText,
} from '@/lib/chatEntities.js'

/** @type {ReadonlySet<string>} */
const KNOWN_TYPES = new Set(KNOWN_WALLET_TYPES)

/** Wallet groupings for the Wallets page UI */
export const WALLET_PAGE_GROUPS = [
  { id: 'ewallet', label: 'E-Wallets', types: ['gcash', 'maya', 'shopeepay', 'coins_ph', 'gotyme', 'maribank'] },
  { id: 'bank', label: 'Banks', types: ['bpi', 'bdo', 'unionbank', 'metrobank'] },
  { id: 'card', label: 'Cards', types: ['credit_card', 'debit_card'] },
  { id: 'cash', label: 'Cash', types: ['cash'] },
]

export function getWalletPageGroupId(type) {
  const t = normalizeWalletType(type) || 'cash'
  for (const group of WALLET_PAGE_GROUPS) {
    if (group.types.includes(t)) return group.id
  }
  return 'other'
}

export const WALLET_ICON_DEFINITIONS = [
  { id: 'cash',        label: 'Cash',        icon: '/icons/wallets/cash.png' },
  { id: 'gcash',       label: 'GCash',       icon: '/icons/wallets/gcash.png' },
  { id: 'maya',        label: 'Maya',        icon: '/icons/wallets/maya.png' },
  { id: 'bpi',         label: 'BPI',         icon: '/icons/wallets/bpi.png' },
  { id: 'bdo',         label: 'BDO',         icon: '/icons/wallets/bdo.png' },
  { id: 'unionbank',   label: 'UnionBank',   icon: '/icons/wallets/unionbank.png' },
  { id: 'metrobank',   label: 'Metrobank',   icon: '/icons/wallets/metrobank.jpg' },
  { id: 'credit_card', label: 'Credit Card', icon: '/icons/wallets/credit_card.png' },
  { id: 'debit_card',  label: 'Debit Card',  icon: '/icons/wallets/debit_card.png' },
  { id: 'shopeepay',   label: 'ShopeePay',   icon: '/icons/wallets/shopeepay.png' },
  { id: 'coins_ph',    label: 'Coins.ph',    icon: '/icons/wallets/coins_ph.png' },
  { id: 'gotyme',      label: 'GoTyme',      icon: '/icons/wallets/gotyme.png' },
  { id: 'maribank',    label: 'Maribank',    icon: '/icons/wallets/maribank.png' },
]

const ICON_BY_TYPE = Object.fromEntries(
  WALLET_ICON_DEFINITIONS.map((w) => [w.id, w.icon]),
)

const LENDING_TYPES = new Set(['lending', 'lent', 'lend'])

function isBrandedType(type) {
  return Boolean(type && KNOWN_TYPES.has(type) && type !== 'cash')
}

/**
 * Normalize a wallet type id (lowercase, aliases, infer from label/name).
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeWalletType(raw) {
  if (raw == null || raw === '') return null

  let t = String(raw).toLowerCase().trim().replace(/-/g, '_')
  t = t.replace(/\s+/g, '_')

  if (WALLET_TYPE_ALIASES[t]) t = WALLET_TYPE_ALIASES[t]
  if (KNOWN_TYPES.has(t)) return t

  const spaced = t.replace(/_/g, ' ')
  if (WALLET_TYPE_ALIASES[spaced]) return WALLET_TYPE_ALIASES[spaced]

  const inferred = inferWalletType(raw)
  return KNOWN_TYPES.has(inferred) ? inferred : null
}

/**
 * Resolve the canonical type id used for icons.
 * Prefers wallet name / user message over generic DB type (`cash`, `custom`).
 * @param {string|{ type?: string, name?: string }} walletOrType
 * @param {string} [messageHint] User message or type hint (e.g. "deposit 300 on bdo")
 * @returns {string}
 */
export function resolveWalletIconType(walletOrType, messageHint) {
  let type
  let walletName

  if (walletOrType && typeof walletOrType === 'object') {
    type = walletOrType.type
    walletName = walletOrType.name
  } else {
    type = walletOrType
  }

  const fromName = walletName
    ? (normalizeWalletType(walletName) || inferWalletType(walletName))
    : null

  const fromMessage = messageHint
    ? (extractWalletTypeFromText(messageHint) || normalizeWalletType(messageHint))
    : null

  const fromType = normalizeWalletType(type)

  if (isBrandedType(fromName)) return fromName
  if (isBrandedType(fromMessage)) return fromMessage
  if (fromType && fromType !== 'custom') return fromType
  if (fromName && KNOWN_TYPES.has(fromName)) return fromName
  if (fromMessage && KNOWN_TYPES.has(fromMessage)) return fromMessage

  if (type && String(type).toLowerCase() !== 'custom') {
    const inferred = inferWalletType(String(type))
    if (KNOWN_TYPES.has(inferred)) return inferred
  }

  return 'cash'
}

/**
 * @param {string|{ type?: string, name?: string, icon_url?: string }} walletOrType
 * @returns {string}
 */
export function getWalletIconUrl(walletOrType) {
  if (walletOrType && typeof walletOrType === 'object') {
    const custom = walletOrType.icon_url
    if (custom && String(custom).startsWith('/icons/wallets/')) {
      return custom
    }
  }

  const type = resolveWalletIconType(walletOrType)

  if (LENDING_TYPES.has(type)) return '/icons/wallets/lending.png'

  return ICON_BY_TYPE[type] || '/icons/wallets/cash.png'
}

export function isLendingWalletType(type) {
  return LENDING_TYPES.has(String(type || '').toLowerCase())
}
