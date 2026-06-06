export function getDaysRemaining(plan) {
  if (!plan.due_date) return 0
  const due = new Date(plan.due_date)
  due.setHours(0,0,0,0)
  const today = new Date()
  today.setHours(0,0,0,0)
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24))
}

export function getDaysRemainingText(plan) {
  if (plan.is_paid) return 'PAID'
  const days = getDaysRemaining(plan)
  if (days < 0) {
    const abs = Math.abs(days)
    return `${abs} DAY${abs === 1 ? '' : 'S'} OVERDUE`
  }
  if (days === 0) return 'DUE TODAY'
  if (days === 1) return 'DUE TOMORROW'
  return `${days} DAYS LEFT`
}

export function getDaysRemainingClass(plan) {
  if (plan.is_paid) return 'text-emerald-600 dark:text-emerald-400 font-bold'
  const days = getDaysRemaining(plan)
  if (days < 0) return 'text-red-600 dark:text-red-400 font-bold animate-pulse'
  if (days <= 2) return 'text-red-500 dark:text-red-400 font-bold'
  if (days <= 7) return 'text-amber-500 dark:text-amber-400 font-bold'
  return 'text-muted-foreground font-semibold'
}

export function getPlanBackgroundClass(plan) {
  if (plan.is_paid) return 'opacity-100'
  
  const days = getDaysRemaining(plan)
  
  if (days <= 2) {
    return 'bg-gradient-to-r from-red-500/20 from-0% to-transparent to-70%'
  } else if (days <= 7) {
    return 'bg-gradient-to-r from-yellow-500/20 from-0% to-transparent to-70%'
  }
  
  return ''
}
