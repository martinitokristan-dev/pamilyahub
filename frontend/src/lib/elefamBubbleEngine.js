/**
 * EleFam dashboard bubble copy — witty Taglish, strict on gastos, chill on deposits.
 */

function stableIndex(length, seed = '') {
  if (!length) return 0
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h) % length
}

function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

/**
 * Pick a line deterministically from a pool so the bubble does not flicker on re-render.
 */
export function pickBubbleLine(pool, vars = {}, seed = '') {
  if (!pool?.length) return ''
  const index = seed ? stableIndex(pool.length, seed) : 0
  return fill(pool[index], vars)
}

/** Spend hard, deposit lang paminsan-minsan — main roast pool. */
export const SCOLD_DEPOSIT_ILLUSION = [
  'Wow {name}, sobra gumastos — akala mo ba nagde-deposit ka ng pera every day? Hindi po unlimited ang wallet mo.',
  'Wow {name}, sobra gumastos — akala mo nagde-deposit ng pera? Deposit minsan lang, gastos parang daily habit.',
  '{name}, {todaySpend} today pero deposit lang minsan? Parang all-you-can-spend buffet ang mindset mo, ha.',
  'Uy {name}, ang tapang mag-spend ({todaySpend}) tapos deposit paminsan-minsan lang. Deposit is not unlimited spend pass.',
  'Hala {name}, grabe ang gastos today ({todaySpend}). Akala mo ba auto-reload ang account mo tuwing checkout?',
  '{name}, ang laki ng {todaySpend} today — deposit ka nga lang paminsan, hindi naman license to splurge forever.',
  'Char {name}, parang nag-de-deposit ka lang para may pambayad sa next gastos. {todaySpend} today — pause muna.',
]

export const SCOLD_WHALE_TODAY = [
  '{name}, {todaySpend} today?! Whale mode na — hindi lottery ang sweldo. Breathing muna bago next tap.',
  'Hala {name}, ang laki ng {todaySpend} today. Mukhang nag-sale ang self-control — pause muna tayo.',
  '{name}, grabe ang {todaySpend} sa isang araw. Hindi sprint to payday — marathon pa ang buwan.',
]

export const SCOLD_LARGE_TODAY = [
  '{name}, {todaySpend} na agad today — malaki yan ha. Konting brake pedal sa wallet natin.',
  'Uy {name}, ang tapang ng {todaySpend} today. Hindi competition ang gastos — chill spend lang.',
]

export const SCOLD_DAILY_HEAVY = [
  '{name}, grabe ang gastos mo today — {todaySpend} na agad. Hindi sprint ang payday, ha. Dahan-dahan lang.',
  'Uy {name}, {todaySpend} today pa lang? Mukhang nag-open ka ng "unli gastos" mode. I-close mo muna yan.',
  '{name}, ang bilis ng kamay mo mag-spend today ({todaySpend}). Baka naman shopee cart ang cardio mo?',
  'Hala {name}, {todaySpend} agad today. Hindi competition ang gastusan — relax lang tayo.',
]

export const SCOLD_DAILY_VS_PACE = [
  '{name}, lumampas ka na sa daily pace mo ({dailyPace}). {todaySpend} today — huwag mo i-spoil ang future you.',
  '{name}, ang laki ng gastos today ({todaySpend}) vs usual mo ({dailyPace}). Konting disiplina, laban lang.',
]

export const SCOLD_SPREE = [
  '{name}, {count} expenses today na — parang flash sale ang buhay mo. Huminga ka muna bago mag-tap ulit.',
  'Grabe {name}, {count} beses ka nag-spend today. Baka gawin mong hobby ang checkout, hindi budget.',
]

export const SCOLD_VS_YESTERDAY = [
  '{name}, mas malaki today ({todaySpend}) kaysa kahapon ({yesterdaySpend}). Mukhang nag-level up ang gastos, hindi sweldo.',
  'Huy {name}, today mo ({todaySpend}) vs yesterday ({yesterdaySpend}) — parang may contest kayo ng gastos. Ikaw panalo.',
]

export const SCOLD_WEEK = [
  '{name}, this week ({weekSpend}) mas mataas pa sa last week ({prevWeekSpend}). Bawas muna sa "treat yourself" era.',
  '{name}, ang tapang ng gastos this week. {weekSpend} vs {prevWeekSpend} last week — konting tigil muna.',
]

export const SCOLD_MONTH_RATIO = [
  '{name}, mataas ang spending vs available balance mo. Higpit ng sinturon — hindi naman permanenteng summer sale ang life.',
  'Medyo mataas na gastos relative sa balance, {name}. Spending > balance — hindi tayo ATM ng shopee. Ayusin natin slowly.',
]

export const SCOLD_NEAR_BUDGET = [
  '{name}, spending mo is getting high relative sa balance. Konting gala na lang, baka maubusan ng buffer.',
  'Medyo mataas na spending relative to balance, {name}. Kape sa labas muna — 3-in-1 muna tayo, charot pero totoo.',
]

export const SCOLD_DEPOSIT_BUT_SPEND = [
  '{name}, nag-deposit ka naman — pero parang chase race ang gastos today ({todaySpend}). Save muna, spend later, deal?',
  'Okay ang deposit, {name}, pero ang bilis bumalik ng pera via gastos ({todaySpend}). Baka naman revolving door ang wallet mo.',
  'Wow {name}, deposit tapos {todaySpend} agad today? Akala mo ba deposit machine ka — hindi po.',
]

export const PRAISE_DEPOSIT = [
  'Ayos {name}, nag-deposit ka today ({depositAmount}). I-ingat mo lang ha — huwag agad i-welcome back ng shopee.',
  'Good move sa deposit, {name} ({depositAmount}). Stable ang wallet — wag mo agad i-spoil ng impulse buys.',
  'Nice, {name}! Fresh funds in ({depositAmount}). Tip: deposit is not permission to panic-buy. Chill spend lang.',
]

export const PRAISE_LOW_SPEND = [
  'Nice one, {name}. Wala pang gastos today — keep this calm pace hanggang mamaya.',
  '{name}, zero gastos today so far. Ang peaceful — maintain mo lang hanggang gabi.',
]

export const PRAISE_UNDER_YESTERDAY = [
  '{name}, mas mababa gastos mo today ({todaySpend}) vs kahapon ({yesterdaySpend}). Ganyan ang gusto ko — disciplined pero hindi stressed.',
]

export const INFO_TODAY_SUMMARY = [
  '{name}, {todaySpend} today across {count} expense{countSuffix}. {walletLine}Mindful lang — hindi race ang gastos.',
  'Today so far: {todaySpend} ({count} item{countSuffix}), {name}. {walletLine}Track lang tuloy — alam natin saan napunta.',
]

export const INFO_DEBTS = [
  '{name}, may payables pa tayo ({iOwe}). Paunti-unti lang — hindi deadline ang stress, deadline ang due date.',
]

export const FALLBACK = [
  'Good job sa pag-track, {name}. Data muna, panic later — charot, wag panic ever.',
  'Steady lang ang finances natin, {name}. Track lang tuloy — ako na ang mang-ingay kung may sobra.',
]

export const MESSAGE_SEVERITY = {
  critical: 4,
  warning: 3,
  info: 2,
  positive: 1,
  fallback: 0,
}

export function selectBestBubbleCandidate(candidates = []) {
  if (!candidates.length) return null
  const sorted = [...candidates].sort((a, b) => {
    const bySeverity =
      (MESSAGE_SEVERITY[b.severity] ?? 0) - (MESSAGE_SEVERITY[a.severity] ?? 0)
    if (bySeverity !== 0) return bySeverity
    return (b.score ?? 0) - (a.score ?? 0)
  })
  return sorted[0]
}

export function addBubbleCandidate(candidates, severity, score, rule, pool, vars = {}) {
  candidates.push({ severity, score, rule, pool, vars })
}

/**
 * Build ranked bubble candidates from finance signals.
 * @param {object} ctx
 */
export function buildElefamBubbleCandidates(ctx) {
  const {
    name,
    monthlyIncome,
    monthlyExpenses,
    budgetLeft,
    iOwe,
    todaySpend,
    todayExpenseCount,
    yesterdaySpend,
    weekDailyAverage,
    thisWeekSpend,
    previousWeekSpend,
    hasTwoWeekCoverage,
    topWallet,
    depositedToday,
    todayDepositTotal,
    depositedThisMonth,
    hasExpenseData,
    formatMoney,
  } = ctx

  // Use cumulative balance (remaining) instead of monthly income for ratio calculation
  const ratio = remaining > 0 ? monthlyExpenses / remaining : null
  const dailyIncomeBaseline = monthlyIncome > 0 ? monthlyIncome / 30 : 0
  const candidates = []
  const vars = (extra = {}) => ({ name, ...extra })
  const spendFmt = { todaySpend: formatMoney(todaySpend) }

  const todayHeavy =
    dailyIncomeBaseline > 0 && todaySpend >= dailyIncomeBaseline * 1.5
  const todayOverPace =
    dailyIncomeBaseline > 0 && todaySpend >= dailyIncomeBaseline * 1.05
  const todayVsWeekRatio =
    weekDailyAverage > 0 ? todaySpend / weekDailyAverage : null
  const todayVsYesterdayRatio =
    yesterdaySpend > 0 ? todaySpend / yesterdaySpend : null
  const thisWeekVsPreviousWeekRatio =
    previousWeekSpend > 0 ? thisWeekSpend / previousWeekSpend : null

  // —— Deposit sometimes, spend like always ——
  if (
    hasExpenseData &&
    depositedThisMonth &&
    !depositedToday &&
    todaySpend >= 1000
  ) {
    addBubbleCandidate(
      candidates,
      'critical',
      todaySpend * 2.2,
      'deposit_illusion_scold',
      SCOLD_DEPOSIT_ILLUSION,
      vars(spendFmt),
    )
  }

  if (
    depositedToday &&
    todayDepositTotal > 0 &&
    todaySpend >= Math.max(1500, todayDepositTotal * 0.45)
  ) {
    addBubbleCandidate(
      candidates,
      'critical',
      todaySpend / todayDepositTotal + 3,
      'deposit_burned_same_day',
      SCOLD_DEPOSIT_ILLUSION,
      vars({ ...spendFmt, depositAmount: formatMoney(todayDepositTotal) }),
    )
  }

  if (hasExpenseData && todaySpend >= 5000) {
    addBubbleCandidate(
      candidates,
      'critical',
      todaySpend * 2,
      'whale_today',
      SCOLD_WHALE_TODAY,
      vars(spendFmt),
    )
  } else if (hasExpenseData && todaySpend >= 2000) {
    addBubbleCandidate(
      candidates,
      'critical',
      todaySpend * 1.5,
      'large_today',
      SCOLD_LARGE_TODAY,
      vars(spendFmt),
    )
  } else if (hasExpenseData && todaySpend >= 800) {
    addBubbleCandidate(
      candidates,
      'warning',
      todaySpend,
      'medium_today',
      SCOLD_LARGE_TODAY,
      vars(spendFmt),
    )
  }

  if (hasExpenseData && todaySpend > 0 && ratio !== null && ratio >= 1.05) {
    addBubbleCandidate(
      candidates,
      'critical',
      ratio * 2,
      'monthly_ratio_scold',
      SCOLD_MONTH_RATIO,
      vars(spendFmt),
    )
  }

  if (
    hasExpenseData &&
    todaySpend > 0 &&
    ratio !== null &&
    ratio >= 0.88 &&
    ratio < 1.05
  ) {
    addBubbleCandidate(
      candidates,
      'warning',
      ratio * 1.5,
      'monthly_near_budget_scold',
      SCOLD_NEAR_BUDGET,
      vars(),
    )
  }

  if (hasExpenseData && todayHeavy) {
    addBubbleCandidate(
      candidates,
      'critical',
      todaySpend,
      'daily_heavy_scold',
      SCOLD_DAILY_HEAVY,
      vars(spendFmt),
    )
  }

  if (hasExpenseData && todayOverPace && !todayHeavy) {
    addBubbleCandidate(
      candidates,
      'critical',
      todaySpend * 0.9,
      'daily_pace_scold',
      SCOLD_DAILY_VS_PACE,
      vars({ ...spendFmt, dailyPace: formatMoney(dailyIncomeBaseline) }),
    )
  }

  if (
    depositedToday &&
    todayDepositTotal > 0 &&
    todaySpend > 0 &&
    todaySpend >= Math.max(500, todayDepositTotal * 0.25)
  ) {
    addBubbleCandidate(
      candidates,
      'warning',
      todaySpend / todayDepositTotal + 1,
      'deposit_then_spend_scold',
      SCOLD_DEPOSIT_BUT_SPEND,
      vars({ ...spendFmt, depositAmount: formatMoney(todayDepositTotal) }),
    )
  }

  if (hasExpenseData && todayExpenseCount >= 4 && todaySpend >= 300) {
    addBubbleCandidate(
      candidates,
      'warning',
      todayExpenseCount,
      'spree_scold',
      SCOLD_SPREE,
      vars({ count: todayExpenseCount }),
    )
  }

  if (todayVsWeekRatio !== null && todayVsWeekRatio >= 1.35 && todaySpend > 0) {
    addBubbleCandidate(
      candidates,
      'warning',
      todayVsWeekRatio,
      'daily_vs_week_scold',
      SCOLD_DAILY_HEAVY,
      vars(spendFmt),
    )
  }

  if (
    todayVsYesterdayRatio !== null &&
    todayVsYesterdayRatio >= 1.2 &&
    todaySpend >= 200
  ) {
    addBubbleCandidate(
      candidates,
      'warning',
      todayVsYesterdayRatio,
      'today_vs_yesterday_scold',
      SCOLD_VS_YESTERDAY,
      vars({
        todaySpend: formatMoney(todaySpend),
        yesterdaySpend: formatMoney(yesterdaySpend),
      }),
    )
  }

  if (
    hasTwoWeekCoverage &&
    thisWeekVsPreviousWeekRatio !== null &&
    thisWeekVsPreviousWeekRatio >= 1.15 &&
    todaySpend > 0
  ) {
    addBubbleCandidate(
      candidates,
      'warning',
      thisWeekVsPreviousWeekRatio,
      'week_scold',
      SCOLD_WEEK,
      vars({
        weekSpend: formatMoney(thisWeekSpend),
        prevWeekSpend: formatMoney(previousWeekSpend),
      }),
    )
  }

  if (!Number.isNaN(budgetLeft) && budgetLeft < 0 && todaySpend > 0) {
    addBubbleCandidate(
      candidates,
      'critical',
      Math.abs(budgetLeft),
      'budget_left_negative_scold',
      SCOLD_MONTH_RATIO,
      vars(spendFmt),
    )
  }

  if (
    depositedToday &&
    todayDepositTotal > 0 &&
    todaySpend < Math.max(500, dailyIncomeBaseline * 0.5)
  ) {
    addBubbleCandidate(
      candidates,
      'positive',
      todayDepositTotal,
      'deposit_praise',
      PRAISE_DEPOSIT,
      vars({ depositAmount: formatMoney(todayDepositTotal) }),
    )
  }

  if (
    hasExpenseData &&
    todaySpend === 0 &&
    todayExpenseCount === 0 &&
    !depositedToday
  ) {
    addBubbleCandidate(
      candidates,
      'positive',
      0.5,
      'no_spend_today',
      PRAISE_LOW_SPEND,
      vars(),
    )
  }

  if (
    todayVsYesterdayRatio !== null &&
    todayVsYesterdayRatio <= 0.75 &&
    todaySpend > 0 &&
    todaySpend < 800
  ) {
    addBubbleCandidate(
      candidates,
      'positive',
      1 - todayVsYesterdayRatio,
      'under_yesterday_praise',
      PRAISE_UNDER_YESTERDAY,
      vars({
        todaySpend: formatMoney(todaySpend),
        yesterdaySpend: formatMoney(yesterdaySpend),
      }),
    )
  }

  if (todaySpend > 0 && todaySpend < 800 && !todayHeavy && !todayOverPace) {
    const countSuffix = todayExpenseCount === 1 ? '' : 's'
    addBubbleCandidate(
      candidates,
      'info',
      todaySpend * 0.2,
      'today_summary',
      INFO_TODAY_SUMMARY,
      vars({
        todaySpend: formatMoney(todaySpend),
        count: todayExpenseCount,
        countSuffix,
        walletLine: topWallet ? `Mostly from ${topWallet}. ` : '',
      }),
    )
  }

  if (iOwe > 0 && todaySpend < 800) {
    addBubbleCandidate(
      candidates,
      'info',
      iOwe * 0.01,
      'debts_info',
      INFO_DEBTS,
      vars({ iOwe: formatMoney(iOwe) }),
    )
  }

  addBubbleCandidate(candidates, 'fallback', 0, 'fallback', FALLBACK, vars())

  return candidates
}

export function resolveElefamBubbleMessage(candidates, stableKey) {
  const winner = selectBestBubbleCandidate(candidates)
  if (!winner?.pool) return { text: '', rule: null }
  return {
    rule: winner.rule,
    text: pickBubbleLine(winner.pool, winner.vars, stableKey),
  }
}
