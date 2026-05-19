import { fuzzyMatchIntent } from './chatFuzzy.js'
import { matchSynonyms } from './chatSynonyms.js'
import { parseWithTemplates } from './chatTemplates.js'
import { generateSmartFallback } from './chatSmartFallback.js'
import { detectSmallTalk, matchSemanticPattern, matchContextualInference } from './chatKnowledge.js'

// FIXED: memoize advancedClassify result per message to avoid
// triple-running fuzzy + synonym matching in the layered pipeline
let _lastClassified = null
let _lastClassifiedText = ''

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

  // Layer 1: Greeting/Emotion (from chatKnowledge.js)
  const smallTalk = detectSmallTalk(trimmedText)
  if (smallTalk && smallTalk !== 'unknown') {
    const res = { matched: true, confidence: 1.0, intent: smallTalk, sourceLayer: 'knowledge', entities: {} }
    candidates.push(res)
    if (res.confidence >= 0.9) return cacheAndReturn(trimmedText, res)
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
    return cacheAndReturn(trimmedText, candidates[0])
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
