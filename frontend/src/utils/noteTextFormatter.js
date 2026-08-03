/**
 * Converts OCR output into TipTap document nodes.
 * Preserves headings, bold, lists, tables, paragraphs, and code blocks.
 */

function cellToParagraph(text) {
  const value = String(text ?? '').trim() || ' '
  return {
    type: 'paragraph',
    content: inlineTextToNodes(value),
  }
}

function buildTableNode(headers, rows) {
  const headerCells = (headers || []).map((header) => ({
    type: 'tableHeader',
    content: [cellToParagraph(header)],
  }))

  const bodyRows = (rows || []).map((row) => ({
    type: 'tableRow',
    content: Array.from({ length: headers.length }, (_, i) => ({
      type: 'tableCell',
      content: [cellToParagraph(row[i] ?? '')],
    })),
  }))

  return {
    type: 'table',
    content: [
      { type: 'tableRow', content: headerCells },
      ...bodyRows,
    ],
  }
}

function inlineTextToNodes(text) {
  if (!text) return [{ type: 'text', text: ' ' }]

  const nodes = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    const token = match[0]
    if (token.startsWith('`')) {
      nodes.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'code' }] })
    } else if (token.startsWith('**')) {
      nodes.push({ type: 'text', text: token.slice(2, -2), marks: [{ type: 'bold' }] })
    } else if (token.startsWith('*')) {
      nodes.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'italic' }] })
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return nodes.length ? nodes : [{ type: 'text', text: text || ' ' }]
}

function structuredBlockToTipTapNode(block) {
  if (!block?.type) return null

  switch (block.type) {
    case 'heading': {
      const level = Math.min(Math.max(block.level || 3, 1), 3)
      const text = block.text || ''
      return {
        type: 'heading',
        attrs: { level },
        content: inlineTextToNodes(text),
      }
    }
    case 'paragraph':
      return {
        type: 'paragraph',
        content: inlineTextToNodes(block.text || ''),
      }
    case 'codeBlock':
      return {
        type: 'codeBlock',
        content: [{ type: 'text', text: block.text || '' }],
      }
    case 'blockquote':
      return {
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: inlineTextToNodes(block.text || ''),
        }],
      }
    case 'bulletList':
      return {
        type: 'bulletList',
        content: (block.items || []).map((item) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: inlineTextToNodes(item) }],
        })),
      }
    case 'orderedList':
      return {
        type: 'orderedList',
        content: (block.items || []).map((item) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: inlineTextToNodes(item) }],
        })),
      }
    default:
      if (block.text) {
        return { type: 'paragraph', content: inlineTextToNodes(block.text) }
      }
      return null
  }
}

function parseMarkdownBlocks(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      i++
      const codeLines = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      blocks.push({ type: 'codeBlock', text: codeLines.join('\n') })
      continue
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines = [line]
      i++
      tableLines.push(lines[i])
      i++
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'table', text: formatTableAsAlignedText(tableLines) })
      continue
    }

    const mdHeading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (mdHeading) {
      blocks.push({ type: 'heading', level: mdHeading[1].length, text: mdHeading[2].trim() })
      i++
      continue
    }

    const numberedHeading = trimmed.match(/^(\d+)\.\s+([A-Z].*)$/)
    if (numberedHeading && numberedHeading[2].length < 80) {
      blocks.push({ type: 'heading', level: 3, text: trimmed })
      i++
      continue
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ''))
        i++
      }
      blocks.push({ type: 'bulletList', items })
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      const items = []
      while (i < lines.length) {
        const m = lines[i].trim().match(/^\d+\.\s+(.+)$/)
        if (!m) break
        items.push(m[1])
        i++
      }
      blocks.push({ type: 'orderedList', items })
      continue
    }

    if (!trimmed) {
      i++
      continue
    }

    const paraLines = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !isTableRow(lines[i]) &&
      !lines[i].trim().match(/^#{1,3}\s+/) &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !lines[i].trim().match(/^\d+\.\s+/)
    ) {
      paraLines.push(lines[i].trim())
      i++
    }
    if (paraLines.length) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') })
    }
  }

  return blocks
}

function isTableRow(line) {
  const trimmed = line.trim()
  return trimmed.includes('|') && trimmed.replace(/[|\s-:]/g, '').length > 0
}

function isTableSeparator(line) {
  return /^\|?[\s\-:|]+\|?$/.test(line.trim()) && line.includes('-')
}

function formatTableAsAlignedText(tableLines) {
  const rows = tableLines
    .filter((_, idx) => idx !== 1)
    .map((row) =>
      row
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell, cellIdx, arr) => !(cellIdx === 0 && cell === '') && !(cellIdx === arr.length - 1 && cell === ''))
    )

  if (!rows.length) return tableLines.join('\n')

  const colCount = Math.max(...rows.map((r) => r.length))
  const widths = Array.from({ length: colCount }, (_, col) =>
    Math.max(...rows.map((row) => (row[col] || '').length), 3)
  )

  return rows
    .map((row) =>
      row
        .map((cell, col) => (cell || '').padEnd(widths[col]))
        .join('  ')
        .trimEnd()
    )
    .join('\n')
}

function blockToTipTapNode(block) {
  if (block.type === 'table') {
    return {
      type: 'codeBlock',
      content: [{ type: 'text', text: block.text }],
    }
  }
  return structuredBlockToTipTapNode(block)
}

export function structuredOcrToTipTapContent(structured) {
  if (!structured || typeof structured !== 'object') return null

  const nodes = []

  if (structured.title?.trim()) {
    nodes.push({
      type: 'heading',
      attrs: { level: 2 },
      content: inlineTextToNodes(structured.title.trim()),
    })
  }

  for (const block of structured.blocks || []) {
    const node = structuredBlockToTipTapNode(block)
    if (node) nodes.push(node)
  }

  for (const table of structured.tables || []) {
    const headers = table.headers || []
    const rows = table.rows || []
    if (headers.length > 0) {
      nodes.push(buildTableNode(headers, rows))
    }
  }

  if (structured.text?.trim() && !structured.blocks?.length) {
    const textBlocks = parseMarkdownBlocks(structured.text.trim())
    nodes.push(...textBlocks.map(blockToTipTapNode).filter(Boolean))
  }

  return nodes.length ? nodes : null
}

export function ocrTextToTipTapContent(text) {
  if (!text?.trim()) {
    return [{ type: 'paragraph', content: [{ type: 'text', text: ' ' }] }]
  }

  const blocks = parseMarkdownBlocks(text)
  if (!blocks.length) {
    return [{ type: 'paragraph', content: inlineTextToNodes(text.trim()) }]
  }

  return blocks.map(blockToTipTapNode).filter(Boolean)
}

export function insertOcrResultIntoEditor(editor, result) {
  if (!editor || !result) return false

  const structuredNodes = result.structured
    ? structuredOcrToTipTapContent(result.structured)
    : null

  const content = structuredNodes?.length
    ? structuredNodes
    : ocrTextToTipTapContent(result.text)

  if (!content?.length) return false

  editor
    .chain()
    .focus()
    .insertContent([...content, { type: 'paragraph' }])
    .run()

  return true
}

/** @deprecated use insertOcrResultIntoEditor */
export function insertOcrTextIntoEditor(editor, text) {
  return insertOcrResultIntoEditor(editor, { text })
}
