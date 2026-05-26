import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SOURCES_DIR = path.join(__dirname, 'sources')
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'knowledge', 'generated')

const OXFORD_3000_FILE = path.join(SOURCES_DIR, 'oxford3000.txt')
const OXFORD_5000_FILE = path.join(SOURCES_DIR, 'oxford5000.json')
const IRREGULAR_FILE = path.join(SOURCES_DIR, 'irregular.verbs.build.json')
const PHRASAL_FILE = path.join(SOURCES_DIR, 'phrasal.verbs.build.json')
const WORDSET_FILE = path.join(SOURCES_DIR, 'aacompletewordset.json')

const LETTERS_ONLY = /^[a-z]+(?:['-][a-z]+)?$/
const PHRASE_CHARS = /^[a-z0-9][a-z0-9'\- ]*[a-z0-9]$/

function toLowerTrim(value) {
  return String(value || '').trim().toLowerCase()
}

function sanitizeTerm(value) {
  let term = toLowerTrim(value)
  if (!term) return ''

  term = term
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/^\(+|\)+$/g, '')

  if (!PHRASE_CHARS.test(term)) return ''
  if (term.length < 1 || term.length > 60) return ''

  return term
}

function extractOxford3kTerm(rawLine) {
  const line = sanitizeTerm(rawLine)
  if (!line) return ''

  let cleaned = line
    .replace(/\s+\d+$/g, '')
    .replace(/\s+\d+\s*$/g, '')
    .replace(/^\d+\s*/g, '')

  if (!cleaned) return ''
  return cleaned
}

function inferPosTag(typeValue = '') {
  const t = toLowerTrim(typeValue)
  if (!t) return null
  if (t.includes('verb')) return 'verb'
  if (t.includes('noun')) return 'noun'
  if (t.includes('adjective')) return 'adjective'
  if (t.includes('adverb')) return 'adverb'
  if (t.includes('pronoun')) return 'pronoun'
  if (t.includes('preposition')) return 'preposition'
  if (t.includes('conjunction')) return 'conjunction'
  if (t.includes('article') || t.includes('determiner')) return 'determiner'
  if (t.includes('interjection')) return 'interjection'
  return 'other'
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function readOxford3k() {
  const raw = await fs.readFile(OXFORD_3000_FILE, 'utf8')
  const lines = raw.split(/\r?\n/)
  const terms = new Set()
  for (const line of lines) {
    const term = extractOxford3kTerm(line)
    if (term) terms.add(term)
  }
  return terms
}

async function readOxford5k() {
  const data = await readJson(OXFORD_5000_FILE)
  const entries = new Map()

  for (const row of data) {
    const term = sanitizeTerm(row?.value?.word)
    if (!term) continue

    entries.set(term, {
      level: toLowerTrim(row?.value?.level || ''),
      pos: inferPosTag(row?.value?.type),
      source: 'oxford5000'
    })
  }

  return entries
}

function upsertLexiconEntry(lexicon, term, patch) {
  const existing = lexicon.get(term) || {
    level: null,
    pos: null,
    source: [],
    isPhrase: term.includes(' '),
    tokenCount: term.split(' ').length
  }

  if (patch.level && (!existing.level || patch.level.length < existing.level.length)) {
    existing.level = patch.level
  }
  if (patch.pos && !existing.pos) {
    existing.pos = patch.pos
  }
  if (patch.source && !existing.source.includes(patch.source)) {
    existing.source.push(patch.source)
  }

  lexicon.set(term, existing)
}

async function buildLexicon() {
  const lexicon = new Map()
  const ox3kTerms = await readOxford3k()
  const ox5kEntries = await readOxford5k()

  for (const term of ox3kTerms) {
    upsertLexiconEntry(lexicon, term, { source: 'oxford3000' })
  }

  for (const [term, meta] of ox5kEntries.entries()) {
    upsertLexiconEntry(lexicon, term, {
      source: meta.source,
      level: meta.level || null,
      pos: meta.pos || null
    })
  }

  return lexicon
}

async function buildLemmas(lexicon) {
  const irregular = await readJson(IRREGULAR_FILE)
  const lemmas = {}

  for (const [baseRaw, variants] of Object.entries(irregular || {})) {
    const base = sanitizeTerm(baseRaw)
    if (!base) continue

    lemmas[base] = base

    for (const item of variants || []) {
      const past = item?.['2'] || []
      const part = item?.['3'] || []
      for (const form of [...past, ...part]) {
        const v = sanitizeTerm(form)
        if (!v) continue
        lemmas[v] = base
      }
    }
  }

  for (const term of lexicon.keys()) {
    if (term.includes(' ')) continue
    if (!LETTERS_ONLY.test(term)) continue

    lemmas[term] = term

    if (term.length > 3) {
      if (!lemmas[`${term}s`]) lemmas[`${term}s`] = term
      if (!lemmas[`${term}ed`]) lemmas[`${term}ed`] = term
      if (!lemmas[`${term}ing`]) lemmas[`${term}ing`] = term
    }

    if (term.endsWith('y') && term.length > 3) {
      const base = term.slice(0, -1)
      if (!lemmas[`${base}ies`]) lemmas[`${base}ies`] = term
      if (!lemmas[`${base}ied`]) lemmas[`${base}ied`] = term
    }
  }

  return lemmas
}

async function buildPhrasals() {
  const data = await readJson(PHRASAL_FILE)
  const out = {}

  for (const [phraseRaw, meta] of Object.entries(data || {})) {
    const phrase = sanitizeTerm(phraseRaw)
    if (!phrase || !phrase.includes(' ')) continue

    out[phrase] = {
      derivatives: Array.isArray(meta?.derivatives)
        ? meta.derivatives.map(sanitizeTerm).filter(Boolean).slice(0, 12)
        : [],
      description: Array.isArray(meta?.descriptions)
        ? String(meta.descriptions[0] || '').trim()
        : ''
    }
  }

  return out
}

async function buildSynonyms(lexicon) {
  const wordset = await readJson(WORDSET_FILE)
  const lexiconWords = new Set([...lexicon.keys()].filter((k) => !k.includes(' ')))
  const synonyms = {}

  for (const [wordRaw, info] of Object.entries(wordset || {})) {
    const word = sanitizeTerm(wordRaw)
    if (!word || !lexiconWords.has(word)) continue

    const bucket = new Set()
    const meanings = Array.isArray(info?.meanings) ? info.meanings : []

    for (const meaning of meanings) {
      const list = Array.isArray(meaning?.synonyms) ? meaning.synonyms : []
      for (const synRaw of list) {
        const syn = sanitizeTerm(synRaw)
        if (!syn || syn === word) continue
        if (!lexiconWords.has(syn)) continue
        bucket.add(syn)
      }
    }

    if (bucket.size > 0) {
      synonyms[word] = [...bucket].slice(0, 16)
    }
  }

  return synonyms
}

function sortObject(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)))
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main() {
  const lexiconMap = await buildLexicon()
  const lemmas = await buildLemmas(lexiconMap)
  const phrasals = await buildPhrasals()
  const synonyms = await buildSynonyms(lexiconMap)

  const lexicon = {}
  for (const [term, meta] of lexiconMap.entries()) {
    lexicon[term] = meta
  }

  const sortedLexicon = sortObject(lexicon)
  const sortedLemmas = sortObject(lemmas)
  const sortedPhrasals = sortObject(phrasals)
  const sortedSynonyms = sortObject(synonyms)

  const stats = {
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      oxford3000: path.basename(OXFORD_3000_FILE),
      oxford5000: path.basename(OXFORD_5000_FILE),
      irregular: path.basename(IRREGULAR_FILE),
      phrasals: path.basename(PHRASAL_FILE),
      wordset: path.basename(WORDSET_FILE)
    },
    counts: {
      lexicon: Object.keys(sortedLexicon).length,
      singleWordLexicon: Object.keys(sortedLexicon).filter((k) => !k.includes(' ')).length,
      phraseLexicon: Object.keys(sortedLexicon).filter((k) => k.includes(' ')).length,
      lemmas: Object.keys(sortedLemmas).length,
      phrasals: Object.keys(sortedPhrasals).length,
      synonymWords: Object.keys(sortedSynonyms).length
    }
  }

  await writeJson(path.join(OUTPUT_DIR, 'lexicon.json'), sortedLexicon)
  await writeJson(path.join(OUTPUT_DIR, 'lemmas.json'), sortedLemmas)
  await writeJson(path.join(OUTPUT_DIR, 'phrasals.json'), sortedPhrasals)
  await writeJson(path.join(OUTPUT_DIR, 'synonyms.json'), sortedSynonyms)
  await writeJson(path.join(OUTPUT_DIR, 'stats.json'), stats)

  process.stdout.write(`English brain generated at ${OUTPUT_DIR}\n`)
  process.stdout.write(`${JSON.stringify(stats.counts, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`Failed to build English brain: ${error?.stack || error}\n`)
  process.exit(1)
})
