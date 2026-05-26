import { ENGLISH_SYNONYMS } from '@/lib/knowledge/index.js'
import { INTENTS, normalizeText } from '@/lib/chatIntents.js'

const MIN_TOKEN_LEN = 2
const MAX_SYNONYM_CHECK = 8
const MIN_OUT_SCOPE_CONFIDENCE = 0.72

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
  'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'we', 'our', 'ours',
  'to', 'for', 'of', 'in', 'on', 'at', 'by', 'from', 'with', 'without',
  'and', 'or', 'but', 'if', 'then', 'so', 'as',
  'do', 'does', 'did', 'have', 'has', 'had', 'can', 'could', 'would', 'should',
  'please', 'just', 'now', 'today', 'this', 'that', 'it',
])

let _cachedProfiles = null
let _cachedFinanceSemanticSet = null

const TECHNICAL_HINTS = [
  'code', 'coding', 'program', 'programming', 'javascript', 'typescript', 'python',
  'framework', 'backend', 'frontend', 'database', 'server', 'api', 'sql', 'bug',
  'debug', 'deploy', 'deployment', 'devops', 'algorithm', 'model',
]

const BROAD_NON_FINANCE_HINTS = [
  'weather', 'sports', 'movie', 'music', 'game', 'politics', 'history', 'science',
  'school', 'homework', 'essay', 'recipe', 'travel', 'news', 'health',
  'romance', 'relationship', 'religion', 'philosophy',
]

const FINANCE_SEED_TERMS = [
  'wallet', 'balance', 'money', 'cash', 'fund', 'deposit', 'top up', 'transfer',
  'expense', 'spending', 'debt', 'owe', 'owed', 'loan', 'borrow', 'lend',
  'budget', 'income', 'salary', 'save', 'savings', 'transaction',
]

function tokenize(text = '') {
  return normalizeText(text)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= MIN_TOKEN_LEN && !STOP_WORDS.has(t))
}

function buildFinanceSemanticSet() {
  if (_cachedFinanceSemanticSet) return _cachedFinanceSemanticSet

  const semantic = new Set()
  const pushTerm = (raw = '') => {
    const normalized = normalizeText(raw)
    if (!normalized) return
    for (const token of normalized.split(/\s+/)) {
      if (token && token.length >= MIN_TOKEN_LEN && !STOP_WORDS.has(token)) {
        semantic.add(token)
      }
    }
  }

  for (const term of FINANCE_SEED_TERMS) pushTerm(term)

  for (const profile of buildIntentProfiles()) {
    for (const token of profile.tokenSet) pushTerm(token)
  }

  const seeds = [...semantic]
  for (const token of seeds) {
    const syns = ENGLISH_SYNONYMS[token]
    if (!Array.isArray(syns) || syns.length === 0) continue
    for (const syn of syns.slice(0, MAX_SYNONYM_CHECK)) {
      pushTerm(syn)
    }
  }

  _cachedFinanceSemanticSet = semantic
  return semantic
}

function estimateScopeSignals(normalizedInput, inputTokens = []) {
  const financeSemanticSet = buildFinanceSemanticSet()

  const financeHits = inputTokens.filter((t) => financeSemanticSet.has(t)).length
  const financeRatio = inputTokens.length ? financeHits / inputTokens.length : 0

  const technicalHits = TECHNICAL_HINTS.filter((h) => normalizedInput.includes(h)).length
  const broadHits = BROAD_NON_FINANCE_HINTS.filter((h) => normalizedInput.includes(h)).length
  const genericQuestion = /\b(what|why|how|when|where|who|can you|could you|tell me|explain|help me with)\b/.test(normalizedInput)

  return {
    financeHits,
    financeRatio,
    technicalHits,
    broadHits,
    genericQuestion,
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function unique(tokens = []) {
  return [...new Set(tokens)]
}

function buildIntentProfiles() {
  if (_cachedProfiles) return _cachedProfiles

  const profiles = []
  for (const [intent, config] of Object.entries(INTENTS)) {
    const phrases = (config?.keywords || [])
      .map((k) => normalizeText(k))
      .filter(Boolean)

    const tokenSet = new Set()
    const weightedTokens = new Map()

    for (const phrase of phrases) {
      const phraseTokens = unique(tokenize(phrase))
      for (const token of phraseTokens) {
        tokenSet.add(token)
        weightedTokens.set(token, (weightedTokens.get(token) || 0) + 1)
      }
    }

    profiles.push({
      intent,
      phrases,
      tokenSet,
      weightedTokens,
      phraseCount: phrases.length || 1,
    })
  }

  _cachedProfiles = profiles
  return profiles
}

function phraseOverlapScore(normalizedInput, profile) {
  let matches = 0
  for (const phrase of profile.phrases) {
    if (!phrase || phrase.length < 4) continue
    if (normalizedInput.includes(phrase)) matches += 1
  }

  if (!matches) return 0
  return Math.min(1, matches / Math.max(2, Math.sqrt(profile.phraseCount)))
}

function tokenOverlapScore(inputTokens, profile) {
  if (!inputTokens.length || profile.tokenSet.size === 0) return 0

  let covered = 0
  let weighted = 0
  for (const token of inputTokens) {
    if (profile.tokenSet.has(token)) {
      covered += 1
      weighted += profile.weightedTokens.get(token) || 1
    }
  }

  if (!covered) return 0
  const coverage = covered / inputTokens.length
  const weightNorm = Math.min(1, weighted / Math.max(2, inputTokens.length * 2))
  return Math.min(1, coverage * 0.7 + weightNorm * 0.3)
}

function synonymOverlapScore(inputTokens, profile) {
  if (!inputTokens.length || profile.tokenSet.size === 0) return 0

  let hits = 0
  for (const token of inputTokens) {
    const syns = ENGLISH_SYNONYMS[token]
    if (!Array.isArray(syns) || syns.length === 0) continue
    const topSyns = syns.slice(0, MAX_SYNONYM_CHECK)
    if (topSyns.some((s) => profile.tokenSet.has(normalizeText(s)))) {
      hits += 1
    }
  }

  if (!hits) return 0
  return Math.min(1, hits / inputTokens.length)
}

function toConfidence(rawScore) {
  if (rawScore <= 0) return 0
  return Math.max(0, Math.min(0.95, 0.35 + rawScore * 0.6))
}

export function classifyIntentSemantic(text = '') {
  const normalizedInput = normalizeText(text)
  if (!normalizedInput) return null

  const inputTokens = unique(tokenize(normalizedInput))
  if (!inputTokens.length) return null

  const profiles = buildIntentProfiles()
  let best = null

  for (const profile of profiles) {
    const phraseScore = phraseOverlapScore(normalizedInput, profile)
    const tokenScore = tokenOverlapScore(inputTokens, profile)
    const synonymScore = synonymOverlapScore(inputTokens, profile)

    const rawScore = phraseScore * 0.5 + tokenScore * 0.35 + synonymScore * 0.15
    if (!best || rawScore > best.rawScore) {
      best = {
        intent: profile.intent,
        rawScore,
        confidence: toConfidence(rawScore),
      }
    }
  }

  if (!best) return null

  if (best.rawScore < 0.22 || best.confidence < 0.5) {
    return null
  }

  return {
    intent: best.intent,
    confidence: best.confidence,
    score: best.rawScore,
  }
}

export function detectOutOfScopeSemantic(text = '', topCandidate = null) {
  const normalizedInput = normalizeText(text)
  if (!normalizedInput) return null

  const inputTokens = unique(tokenize(normalizedInput))
  if (!inputTokens.length) return null

  const directIntent = classifyIntentSemantic(normalizedInput)
  const bestIntentScore = Math.max(
    topCandidate?.confidence || 0,
    directIntent?.confidence || 0,
    directIntent?.score || 0,
  )

  const signals = estimateScopeSignals(normalizedInput, inputTokens)
  const financeEvidence = clamp01(signals.financeRatio + (bestIntentScore >= 0.55 ? 0.45 : bestIntentScore * 0.5))
  const nonFinanceEvidence = clamp01(
    (signals.technicalHits > 0 ? 0.45 : 0) +
    (signals.broadHits > 0 ? 0.35 : 0) +
    (signals.genericQuestion ? 0.2 : 0),
  )

  const outConfidence = clamp01(nonFinanceEvidence - financeEvidence + 0.55)
  if (outConfidence < MIN_OUT_SCOPE_CONFIDENCE) return null

  return {
    isOutOfScope: true,
    confidence: outConfidence,
    scopeType: signals.technicalHits > 0 ? 'technical' : 'general',
  }
}
