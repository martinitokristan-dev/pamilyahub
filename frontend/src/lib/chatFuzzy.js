import { INTENTS, normalizeText } from '@/lib/chatIntents.js'

// Computes the Levenshtein distance between two strings
export function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

// Basic stemmer for English, Tagalog, and Bisaya
export function stemWord(word) {
  if (!word || word.length <= 3) return word

  let stemmed = word

  // English prefixes/suffixes
  if (stemmed.endsWith('ing')) stemmed = stemmed.slice(0, -3)
  else if (stemmed.endsWith('ed')) stemmed = stemmed.slice(0, -2)
  else if (stemmed.endsWith('es')) stemmed = stemmed.slice(0, -2)
  else if (stemmed.endsWith('s') && !stemmed.endsWith('ss')) stemmed = stemmed.slice(0, -1)

  // Tagalog/Bisaya common prefixes
  const prefixes = ['nag', 'mag', 'pag', 'pa', 'ni', 'gi', 'na', 'ma', 'in', 'i']
  for (const prefix of prefixes) {
    if (stemmed.startsWith(prefix) && stemmed.length > prefix.length + 3) {
      stemmed = stemmed.slice(prefix.length)
      break // only strip one prefix
    }
  }

  return stemmed
}

// Finds the best intent match using fuzzy matching and stemming
export function fuzzyMatchIntent(text) {
  const normalizedText = normalizeText(text)
  const words = normalizedText.split(/\s+/)

  // Normalize wallet typos (Fix 1)
  const knownWallets = ['gcash', 'maya', 'bpi', 'bdo', 'cash']
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    for (const wallet of knownWallets) {
      if (word === wallet) continue
      const dist = levenshteinDistance(word, wallet)
      const threshold = 1 // allow only 1 typo for wallet names to avoid false positives like 'mamaya' -> 'maya'
      if (dist <= threshold) {
        words[i] = wallet
        break
      }
    }
  }

  const stemmedWords = words.map(stemWord)

  let bestIntent = null
  let maxScore = 0

  for (const [intentName, intentDef] of Object.entries(INTENTS)) {
    let score = 0
    
    for (const keyword of intentDef.keywords) {
      const keywordWords = keyword.split(/\s+/)
      
      // If the keyword is exactly in the text, big boost
      if (normalizedText.includes(keyword)) {
        score += 2
        continue
      }

      // Check fuzzy and stemmed matches per word
      let keywordScore = 0
      for (const kw of keywordWords) {
        let wordMatched = false
        const stemmedKw = stemWord(kw)

        for (let i = 0; i < words.length; i++) {
          const w = words[i]
          const sw = stemmedWords[i]

          // Exact or stem match
          if (w === kw || sw === stemmedKw) {
            wordMatched = true
            keywordScore += 1
            break
          }
          
          // Fuzzy match (allow 1 typo for short words, 2 for long)
          const dist = levenshteinDistance(w, kw)
          const threshold = kw.length > 5 ? 2 : 1
          if (dist <= threshold) {
            wordMatched = true
            keywordScore += 0.8
            break
          }
        }
        
        // If a multi-word keyword misses one word entirely, penalize it heavily
        if (!wordMatched) {
          keywordScore -= 1
        }
      }

      // Only count if the whole phrase matched decently
      if (keywordScore > 0) {
        const keywordFinalScore = keywordScore / keywordWords.length
        if (keywordFinalScore >= 0.6) {
          // console.log(`[Fuzzy] Intent \${intentName} matched keyword "\${keyword}" with score \${keywordFinalScore}`);
        }
        score = Math.max(score, keywordFinalScore)
      }
    }

    if (score > maxScore) {
      maxScore = score
      bestIntent = intentName
    }
  }

  // Determine confidence
  let confidence = 0
  if (maxScore > 1.5) confidence = 0.9 // High
  else if (maxScore >= 0.8) confidence = 0.6 // Medium
  else if (maxScore > 0) confidence = 0.3 // Low

  return {
    intent: bestIntent,
    score: maxScore,
    confidence
  }
}
