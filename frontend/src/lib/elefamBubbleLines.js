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
 * @param {string[]} pool
 * @param {Record<string, string|number>} vars
 * @param {string} seed Stable key (e.g. fingerprint + rule id)
 */
export function pickBubbleLine(pool, vars = {}, seed = '') {
  if (!pool?.length) return ''
  const index = seed ? stableIndex(pool.length, seed) : 0
  return fill(pool[index], vars)
}

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
  '{name}, halos ubos na ang budget vs kita this month. Higpit ng sinturon — hindi naman permanenteng summer sale ang life.',
  'Lagpas na tayo sa kita, {name}. Gastos > income — hindi tayo ATM ng shopee. Ayusin natin slowly.',
]

export const SCOLD_NEAR_BUDGET = [
  '{name}, 85% na ng budget mo for the month. Konting gala na lang, baka maubusan ng buffer bago sweldo.',
  'Lapit na maubos ang monthly budget, {name}. Kape sa labas muna — 3-in-1 muna tayo, charot pero totoo.',
]

export const SCOLD_DEPOSIT_BUT_SPEND = [
  '{name}, nag-deposit ka naman — pero parang chase race ang gastos today ({todaySpend}). Save muna, spend later, deal?',
  'Okay ang deposit, {name}, pero ang bilis bumalik ng pera via gastos ({todaySpend}). Baka naman revolving door ang wallet mo.',
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
