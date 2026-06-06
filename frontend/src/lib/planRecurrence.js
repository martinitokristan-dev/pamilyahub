/** Calendar + recurrence helpers for upcoming plans */

function toDateOnly(value) {
  if (!value) return null
  // Convert to ISO string if it's a Date object, otherwise use as-is
  const strValue = value instanceof Date ? value.toISOString() : String(value)
  const d = new Date(strValue.includes('T') ? strValue : `${strValue}T00:00:00`)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a, b) {
  return a.getTime() === b.getTime()
}

export function planOccursOnCalendarDate(plan, dateObj) {
  if (!plan) return false

  const target = toDateOnly(dateObj)
  if (!target) return false



  const start = toDateOnly(plan.due_date)
  if (!start) return false

  if (target < start) return false

  const recurrence = plan.recurrence || null
  if (!recurrence) {
    return isSameDay(start, target)
  }

  if (recurrence === 'weekly') {
    const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24))
    return diffDays % 7 === 0
  }

  if (recurrence === 'monthly') {
    return target.getDate() === start.getDate() && target >= start
  }

  if (recurrence === 'yearly') {
    return (
      target.getMonth() === start.getMonth() &&
      target.getDate() === start.getDate() &&
      target >= start
    )
  }

  return isSameDay(start, target)
}

export function getPlansForCalendarDay(plans, dateObj) {
  return (plans || []).filter((p) => planOccursOnCalendarDate(p, dateObj))
}

export const RECURRENCE_OPTIONS = [
  { value: '', label: 'One-time only' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
]
