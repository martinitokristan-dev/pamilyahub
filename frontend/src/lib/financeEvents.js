/**
 * Broadcast finance mutations so Home (EleFam bubble) can react immediately.
 */
export function notifyFinanceActivity(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('pamilya:finance-changed', { detail }),
  )
}
