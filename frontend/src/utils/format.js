/**
 * Currency and number formatting utilities
 */

/**
 * Format a number as Philippine Peso currency
 * @param {number|string} value - The value to format
 * @returns {string} - Formatted currency string (e.g., "₱ 45,000.00")
 */
export function formatCurrency(value) {
  const num = parseFloat(value)
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
  const num = parseFloat(value)
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
  if (!value || typeof value !== 'string') return 0
  // Remove peso sign, commas, spaces, and other non-numeric characters except decimal point
  const cleaned = value.replace(/[₱,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}
