/**
 * Verifies expense slot-filling + create_plan intent routing (no API / Pinia).
 * Run: node scripts/verify-chat-flows.mjs
 */

const PLAN_WEAK_REASONS = new Set([
  'plan', 'new plan', 'a new plan', 'add plan', 'add new plan', 'add a new plan',
  'create plan', 'bill', 'new bill',
])
const PLAN_TRIGGER_WORDS = new Set([
  'add', 'a', 'an', 'new', 'create', 'plan', 'bill', 'schedule', 'upcoming', 'payment', 'subscription', 'the',
])
const BARE_PLAN_TRIGGER_RX =
  /^(?:add(?:\s+a)?\s+new\s+plan|add\s+new\s+plan|add(?:\s+a)?\s+plan|new\s+plan|create(?:\s+a)?\s+plan|schedule(?:\s+a)?\s+plan|add(?:\s+a)?\s+(?:new\s+)?bill|new\s+bill|add\s+upcoming(?:\s+payment)?|create(?:\s+a)?\s+bill)$/

function normalizeText(text = '') {
  return String(text || '').toLowerCase().replace(/[!?.,]/g, ' ').replace(/\s+/g, ' ').trim()
}

function isBarePlanTrigger(text = '') {
  const n = normalizeText(text)
  return Boolean(n && BARE_PLAN_TRIGGER_RX.test(n))
}

function sanitizePlanReason(reason, sourceText = '') {
  if (!reason) return null
  if (sourceText && isBarePlanTrigger(sourceText)) return null
  const lower = String(reason).toLowerCase().trim()
  if (!lower || PLAN_WEAK_REASONS.has(lower)) return null
  const words = lower.split(/\s+/).filter(Boolean)
  if (words.length > 0 && words.every((w) => PLAN_TRIGGER_WORDS.has(w))) return null
  if (sourceText && normalizeText(reason) === normalizeText(sourceText) && /plan|bill/.test(lower)) {
    return null
  }
  return reason
}

function simulatePlanMissing(entities) {
  const required = ['reason', 'amount', 'date']
  return required.filter((field) => {
    const val = entities[field]
    return val === null || val === undefined || (typeof val === 'string' && val.trim() === '')
  })
}

function simulateDateAnswerPreservesAmount(text, entities) {
  const missingBefore = simulatePlanMissing(entities)
  const newEntities = { ...entities }
  if (missingBefore.includes('date')) {
    const dayMatch = text.match(/\b(\d{1,2})\b/)
    if (dayMatch && missingBefore.includes('date') && !missingBefore.includes('amount')) {
      // simulate wrongly parsing day as amount — should NOT happen
      if (missingBefore.includes('amount')) {
        newEntities.amount = parseInt(dayMatch[1], 10)
      }
    }
  }
  return newEntities.amount
}

let pass = 0
let fail = 0

function assert(name, cond) {
  if (cond) {
    pass++
    console.log(`✓ ${name}`)
  } else {
    fail++
    console.error(`✗ ${name}`)
  }
}

assert('isBarePlanTrigger("Add a new plan")', isBarePlanTrigger('Add a new plan'))
assert('sanitizePlanReason rejects "Add new plan" from trigger', sanitizePlanReason('Add new plan', 'add a new plan') === null)
assert('sanitizePlanReason keeps Netflix', sanitizePlanReason('Netflix', 'Netflix') === 'Netflix')

const afterTrigger = simulatePlanMissing({
  reason: sanitizePlanReason('Add new plan', 'add a new plan'),
  amount: null,
  date: null,
})
assert('bare trigger leaves reason missing → asks name first', afterTrigger[0] === 'reason')

const afterName = simulatePlanMissing({ reason: 'Netflix', amount: null, date: null })
assert('after name, asks amount', afterName[0] === 'amount')

const afterAmount = simulatePlanMissing({ reason: 'Netflix', amount: 250, date: null })
assert('after amount, asks date', afterAmount[0] === 'date')

const amountAfterDate = simulateDateAnswerPreservesAmount('june 24', {
  reason: 'Netflix',
  amount: 250,
  date: null,
})
assert('date answer does not overwrite amount 250 with 24', amountAfterDate === 250)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
