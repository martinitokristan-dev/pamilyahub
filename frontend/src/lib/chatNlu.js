import { fuzzyMatchIntent } from './chatFuzzy.js'
import { matchSynonyms } from './chatSynonyms.js'
import { parseWithTemplates } from './chatTemplates.js'
import { detectHowToFlowQuestion, detectGuidanceIntent } from './chatQuestion.js'
import { generateSmartFallback } from './chatSmartFallback.js'
import { detectSmallTalk, matchSemanticPattern, matchContextualInference } from './chatKnowledge.js'
import { classifyIntentSemantic, detectOutOfScopeSemantic } from './chatClassifier.js'
import { extractAmount } from './chatEntities.js'

// FIXED: memoize advancedClassify result per message to avoid
// triple-running fuzzy + synonym matching in the layered pipeline
let _lastClassified = null
let _lastClassifiedText = ''

const ACTION_INTENTS = new Set([
  'deposit',
  'log_expense',
  'transfer',
  'create_debt',
  'create_debt_i_owe',
  'create_debt_owed_to_me',
  'pay_debt',
  'set_budget',
])

function looksLikeGuidanceQuestion(text = '', normalized = '') {
  if (!normalized) return false
  const explicitGuidance = /\bhow\s+to\b|\bhow\s+do\s+i\b|\bhelp\s+me\b|\bguide\s+me\b|\bwalk\s+me\s+through\b|\bteach\s+me\b/.test(normalized)
  const onboarding = /\b(im|i am)\s+new\b|\bnew\s+here\b|\bfirst\s*time\b|\bfrom\s+scratch\b|\bstart\s+tracking\b|\bwhat\s+should\s+i\s+do\s+first\b|\bwhere\s+do\s+i\s+start\b|\bbegin\b/.test(normalized)
  return explicitGuidance || onboarding
}

/**
 * Advanced NLU Classification
 * Routes user text through progressive understanding layers.
 * 
 * @param {string} text - The raw user input
 * @returns {object} - Unified shape or ambiguous result
 */
export function advancedClassify(text) {
  if (!text || typeof text !== 'string') {
    return { matched: false, confidence: 0, intent: 'unknown', sourceLayer: 'none', entities: {} }
  }

  const trimmedText = text.trim()
  if (trimmedText === '') {
    return { matched: false, confidence: 0, intent: 'unknown', sourceLayer: 'none', entities: {} }
  }

  // Return cached result if same text
  if (trimmedText === _lastClassifiedText && _lastClassified) {
    return _lastClassified
  }

  const candidates = []
  const normalizedText = trimmedText.toLowerCase()

  // Layer 1: Greeting/Emotion (from chatKnowledge.js)
  const smallTalk = detectSmallTalk(trimmedText)
  if (smallTalk && smallTalk !== 'unknown') {
    const res = { matched: true, confidence: 1.0, intent: smallTalk, sourceLayer: 'knowledge', entities: {} }
    candidates.push(res)
    if (res.confidence >= 0.9) return cacheAndReturn(trimmedText, res)
  }

  // Layer 1.5: How-to Flow Question Detection
  // Route guidance requests (e.g. "how to log expense") to flow_help before
  // template/action layers can misclassify them as direct commands.
  const howToFlow = detectHowToFlowQuestion(trimmedText)
  if (howToFlow) {
    const entities = howToFlow.topic ? { topic: howToFlow.topic } : {}
    const res = { matched: true, confidence: 0.96, intent: 'flow_help', sourceLayer: 'question', entities }
    candidates.push(res)
    return cacheAndReturn(trimmedText, res)
  }

  // Layer 1.6: Conversational guidance / onboarding detection
  // Handles free-form support requests like:
  // "I'm new here, how do I start tracking funds?"
  const guidanceIntent = detectGuidanceIntent(trimmedText)
  if (guidanceIntent) {
    const entities = guidanceIntent.topic ? { topic: guidanceIntent.topic } : {}
    const res = {
      matched: true,
      confidence: Math.max(0.9, Math.min(0.98, guidanceIntent.confidence || 0.93)),
      intent: 'flow_help',
      sourceLayer: 'guidance',
      entities,
    }
    candidates.push(res)
    return cacheAndReturn(trimmedText, res)
  }

  // Layer 2: Exact Template match (chatTemplates.js)
  const templateResult = parseWithTemplates(trimmedText)
  if (templateResult) {
    const res = { matched: true, confidence: 1.0, intent: templateResult.intent, sourceLayer: 'template', entities: templateResult.entities || {} }
    candidates.push(res)
    if (res.confidence >= 0.9) return cacheAndReturn(trimmedText, res)
  }

  // Layer 2.5: Semantic / Contextual Inference (chatKnowledge.js)
  const semanticMatch = matchSemanticPattern(trimmedText)
  if (semanticMatch) {
    const res = { matched: true, confidence: 0.95, intent: semanticMatch.intent, sourceLayer: 'semantic', entities: {} }
    candidates.push(res)
    if (res.confidence >= 0.9) return cacheAndReturn(trimmedText, res)
  }
  const contextMatch = matchContextualInference(trimmedText)
  if (contextMatch) {
    const res = { matched: true, confidence: 0.95, intent: contextMatch.intent, sourceLayer: 'contextual', entities: {} }
    candidates.push(res)
    if (res.confidence >= 0.9) return cacheAndReturn(trimmedText, res)
  }

  // Layer 2.7: Lightweight semantic classifier (local, rule-safe)
  // Uses intent vocabulary + synonym graph scoring to better catch
  // natural English phrasing before legacy synonym/fuzzy layers.
  const classifierResult = classifyIntentSemantic(trimmedText)
  if (classifierResult && classifierResult.intent) {
    const res = {
      matched: true,
      confidence: Math.max(0.5, Math.min(0.88, classifierResult.confidence || 0.6)),
      intent: classifierResult.intent,
      sourceLayer: 'classifier',
      entities: {},
    }
    candidates.push(res)
  }

  // Layer 3: Synonym match (chatSynonyms.js)
  const synonymResult = matchSynonyms(trimmedText)
  if (synonymResult && synonymResult.intent) {
    const res = { matched: true, confidence: Math.min(0.8, synonymResult.confidence), intent: synonymResult.intent, sourceLayer: 'synonym', entities: {} }
    candidates.push(res)
    if (res.confidence >= 0.9) return cacheAndReturn(trimmedText, res) // Won't happen
  }

  // Layer 4: Fuzzy match (chatFuzzy.js)
  const fuzzyResult = fuzzyMatchIntent(trimmedText)
  if (fuzzyResult && fuzzyResult.intent) {
    const res = { matched: true, confidence: Math.min(0.7, fuzzyResult.confidence), intent: fuzzyResult.intent, sourceLayer: 'fuzzy', entities: {} }
    candidates.push(res)
    if (res.confidence >= 0.9) return cacheAndReturn(trimmedText, res) // Won't happen
  }

  // Layer 5: Smart Fallback (chatSmartFallback.js)
  // Only reached if no previous layer short-circuited
  
  // Sort candidates by confidence
  candidates.sort((a, b) => b.confidence - a.confidence)

  // Ambiguity Handling
  // Only applies when at least two distinct intents both scored >= 0.3
  const validCandidates = candidates.filter(c => c.confidence >= 0.3)
  
  if (validCandidates.length >= 2) {
    const top = validCandidates[0]
    const second = validCandidates[1]
    
    // Find the next distinct intent
    const distinctCandidates = []
    const seenIntents = new Set()
    for (const c of validCandidates) {
      if (!seenIntents.has(c.intent)) {
        seenIntents.add(c.intent)
        distinctCandidates.push(c)
      }
    }

    if (distinctCandidates.length >= 2) {
      const topDistinct = distinctCandidates[0]
      const secondDistinct = distinctCandidates[1]
      
      if ((topDistinct.confidence - secondDistinct.confidence) <= 0.15) {
        const res = {
          matched: true,
          confidence: topDistinct.confidence,
          intent: 'ambiguous',
          sourceLayer: 'pipeline',
          entities: {},
          candidates: distinctCandidates.map(c => ({ intent: c.intent, confidence: c.confidence }))
        }
        return cacheAndReturn(trimmedText, res)
      }
    }
  }

  // If we have a winner
  if (candidates.length > 0) {
    const topCandidate = candidates[0]

    if (ACTION_INTENTS.has(topCandidate.intent)) {
      const hasAmount = Boolean(extractAmount(trimmedText))
      const asksGuidance = looksLikeGuidanceQuestion(trimmedText, normalizedText)
      if (asksGuidance && !hasAmount) {
        const res = {
          matched: true,
          confidence: 0.92,
          intent: 'flow_help',
          sourceLayer: 'guidance_rewrite',
          entities: {},
        }
        return cacheAndReturn(trimmedText, res)
      }
    }

    // Scope gate for weak/uncertain intent interpretation:
    // if meaning appears clearly outside finance system, do not guess intent.
    if (topCandidate.confidence < 0.7) {
      const scope = detectOutOfScopeSemantic(trimmedText, topCandidate)
      if (scope?.isOutOfScope) {
        const res = {
          matched: false,
          confidence: scope.confidence,
          intent: 'out_of_scope',
          sourceLayer: 'scope',
          entities: { scopeType: scope.scopeType || 'general' },
        }
        return cacheAndReturn(trimmedText, res)
      }
    }

    // Low-confidence guard: ask clarification instead of committing
    // to a potentially wrong intent.
    if (topCandidate.confidence < 0.55) {
      const fallbackResponse = generateSmartFallback(trimmedText, topCandidate)
      const res = {
        matched: false,
        confidence: topCandidate.confidence,
        intent: 'unknown',
        sourceLayer: 'fallback',
        entities: {},
        fallbackResponse,
      }
      return cacheAndReturn(trimmedText, res)
    }

    return cacheAndReturn(trimmedText, topCandidate)
  }

  const scope = detectOutOfScopeSemantic(trimmedText, null)
  if (scope?.isOutOfScope) {
    const res = {
      matched: false,
      confidence: scope.confidence,
      intent: 'out_of_scope',
      sourceLayer: 'scope',
      entities: { scopeType: scope.scopeType || 'general' },
    }
    return cacheAndReturn(trimmedText, res)
  }

  // Fallback if no layers matched at all
  const fallbackResponse = generateSmartFallback(trimmedText, null)
  const res = {
    matched: false,
    confidence: 0.0,
    intent: 'unknown',
    sourceLayer: 'fallback',
    entities: {},
    fallbackResponse
  }
  return cacheAndReturn(trimmedText, res)
}

function cacheAndReturn(text, result) {
  _lastClassifiedText = text
  _lastClassified = result
  return result
}
