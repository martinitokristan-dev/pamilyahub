/**
 * Currency and number formatting utilities
 */

export const APP_TIMEZONE = 'Asia/Manila'

/**
 * Parse API date/timestamp strings as UTC when no timezone is present.
 * Laravel stores timestamps in UTC; bare "YYYY-MM-DD HH:mm:ss" must be treated as UTC.
 */
export function parseAppDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  const str = String(value).trim()
  if (!str) return null

  if (/[Zz]|[+-]\d{2}:\d{2}$/.test(str)) {
    const d = new Date(str)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const iso = str.includes('T') ? str : str.replace(' ', 'T')
  const d = new Date(`${iso}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Calendar date (YYYY-MM-DD) in Philippine timezone for a given timestamp.
 */
export function getPhDateKey(value = new Date()) {
  const d = value instanceof Date ? value : parseAppDate(value)
  if (!d) return ''
  return d.toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE })
}

/**
 * Whether a timestamp falls on today's calendar date in PH time.
 */
export function isTodayInPh(value) {
  const d = parseAppDate(value)
  if (!d) return false
  return getPhDateKey(d) === getPhDateKey(new Date())
}

/**
 * Format a number as Philippine Peso currency
 * @param {number|string} value - The value to format
 * @returns {string} - Formatted currency string (e.g., "₱ 45,000.00")
 */
export function formatCurrency(value) {
  const num = parseExpenseAmount(value)
  if (isNaN(num)) return '₱ 0.00'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)
}

/**
 * Format a number with comma separators
 * @param {number|string} value - The value to format
 * @returns {string} - Formatted number string (e.g., "45,000")
 */
export function formatNumber(value) {
  const num = parseExpenseAmount(value)
  if (isNaN(num)) return '0'
  return new Intl.NumberFormat('en-PH').format(num)
}

/**
 * Parse a formatted currency string back to a number
 * Strips peso sign, commas, spaces, and other formatting
 * @param {string} value - The formatted string to parse
 * @returns {number} - Parsed number (e.g., "₱ 45,000.00" → 45000)
 */
export function parseCurrency(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value
  // Remove peso sign, commas, spaces, and other non-numeric characters except decimal point
  const cleaned = String(value).replace(/[₱,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Parse expense amount from API (plain number, decimal string, or comma-formatted).
 */
export function parseExpenseAmount(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return Math.abs(value)
  const str = String(value).trim()
  if (!str) return 0
  if (/[,\u20b1]/.test(str)) return Math.abs(parseCurrency(str))
  const n = parseFloat(str)
  return Number.isNaN(n) ? 0 : Math.abs(n)
}

/**
 * Format a date and optional time string in Philippine timezone
 * @param {string} dateStr - The YYYY-MM-DD date string
 * @param {string} createdAt - Optional ISO timestamp for the time component
 * @returns {string} - Formatted date and time
 */
export function formatDateTime(dateStr, createdAt) {
  const ts = createdAt ? parseAppDate(createdAt) : parseAppDate(dateStr)
  if (!ts) return ''

  const datePart = ts.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: APP_TIMEZONE,
  })

  if (!createdAt) return datePart

  const timePart = ts.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: APP_TIMEZONE,
  })
  return `${datePart} · ${timePart}`
}
