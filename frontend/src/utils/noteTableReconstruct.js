/**
 * Reconstruct table rows from Tesseract word bounding boxes.
 * Fixes column-by-column reading by grouping words on the same Y axis.
 */

const ROW_Y_TOLERANCE = 14

function wordCenterY(word) {
  return (word.bbox.y0 + word.bbox.y1) / 2
}

function wordCenterX(word) {
  return (word.bbox.x0 + word.bbox.x1) / 2
}

function clusterWordsIntoRows(words) {
  const sorted = [...words].filter((w) => w.text?.trim()).sort((a, b) => wordCenterY(a) - wordCenterY(b))
  const rows = []

  for (const word of sorted) {
    const y = wordCenterY(word)
    let row = rows.find((r) => Math.abs(r.yMid - y) <= ROW_Y_TOLERANCE)
    if (!row) {
      row = { yMid: y, words: [] }
      rows.push(row)
    }
    row.words.push(word)
    row.yMid = row.words.reduce((sum, w) => sum + wordCenterY(w), 0) / row.words.length
  }

  return rows.sort((a, b) => a.yMid - b.yMid)
}

function detectColumnBoundaries(headerWords) {
  const sorted = [...headerWords].sort((a, b) => a.bbox.x0 - b.bbox.x0)
  const headers = sorted.map((w) => w.text.trim())
  const mids = sorted.map((w) => wordCenterX(w))

  const bounds = mids.map((mid, i) => ({
    start: i === 0 ? 0 : (mids[i - 1] + mid) / 2,
    end: i === mids.length - 1 ? Infinity : (mid + mids[i + 1]) / 2,
  }))

  return { headers, bounds }
}

function assignWordsToCells(words, bounds, colCount) {
  const cells = Array.from({ length: colCount }, () => [])

  for (const word of words) {
    const x = wordCenterX(word)
    let colIdx = 0
    for (let i = 0; i < bounds.length; i++) {
      if (x >= bounds[i].start && x < bounds[i].end) {
        colIdx = i
        break
      }
      if (x >= bounds[i].start) colIdx = i
    }
    cells[colIdx].push(word)
  }

  return cells.map((cellWords) =>
    cellWords
      .sort((a, b) => a.bbox.x0 - b.bbox.x0)
      .map((w) => w.text.trim())
      .join(' ')
      .trim()
  )
}

export function reconstructTableFromTesseract(data) {
  const words = data?.words?.filter((w) => w.text?.trim() && (w.confidence ?? 0) > 30) || []
  if (words.length < 4) return null

  const rows = clusterWordsIntoRows(words)
  if (rows.length < 2) return null

  const headerRow = rows[0]
  const { headers, bounds } = detectColumnBoundaries(headerRow.words)
  if (headers.length < 2) return null

  const bodyRows = rows.slice(1).map((row) => assignWordsToCells(row.words, bounds, headers.length))

  // Skip if body rows look empty or single-column
  const multiColRows = bodyRows.filter((row) => row.filter((c) => c).length >= 2).length
  if (multiColRows < 1 && bodyRows.length > 2) return null

  return {
    content_type: 'table',
    tables: [{ headers, rows: bodyRows }],
  }
}

export function structuredToPlainText(structured) {
  const parts = []
  if (structured?.title) parts.push(structured.title)

  for (const block of structured?.blocks || []) {
    if (block.type === 'heading') parts.push(block.text)
    else if (block.type === 'paragraph') parts.push(block.text)
    else if (block.type === 'bulletList') parts.push(...(block.items || []).map((i) => `- ${i}`))
    else if (block.type === 'orderedList') parts.push(...(block.items || []).map((i, idx) => `${idx + 1}. ${i}`))
    else if (block.type === 'codeBlock') parts.push(block.text)
  }

  for (const table of structured?.tables || []) {
    const { headers = [], rows = [] } = table
    if (!headers.length) continue
    parts.push(`| ${headers.join(' | ')} |`)
    parts.push(`| ${headers.map(() => '---').join(' | ')} |`)
    for (const row of rows) {
      const cells = headers.map((_, i) => row[i] ?? '')
      parts.push(`| ${cells.join(' | ')} |`)
    }
  }

  if (structured?.text) parts.push(structured.text.trim())
  return parts.filter(Boolean).join('\n\n')
}

/** Reconstruct document layout (headings, lists, paragraphs) from Tesseract lines */
export function reconstructDocumentFromTesseract(data) {
  const words = data?.words?.filter((w) => w.text?.trim() && (w.confidence ?? 0) > 25) || []
  if (words.length < 2) return null

  const rows = clusterWordsIntoRows(words)
  const lines = rows.map((row) =>
    row.words
      .sort((a, b) => a.bbox.x0 - b.bbox.x0)
      .map((w) => w.text.trim())
      .join(' ')
      .trim()
  ).filter(Boolean)

  if (!lines.length) return null

  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (/^\d+\.\s+[A-Z]/.test(line) && line.length < 100) {
      blocks.push({ type: 'heading', level: 3, text: line })
      i++
      continue
    }

    if (/^[-*•]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s+/, ''))
        i++
      }
      blocks.push({ type: 'bulletList', items })
      continue
    }

    const paraLines = []
    while (
      i < lines.length &&
      !/^\d+\.\s+[A-Z]/.test(lines[i]) &&
      !/^[-*•]\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
      if (i < lines.length && /^\d+\.\s+[A-Z]/.test(lines[i])) break
    }

    if (paraLines.length) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') })
    }
  }

  return blocks.length ? { content_type: 'text', blocks } : null
}
