/**
 * Rich clipboard export for Notes — preserves tables, headings, and bold
 * when pasting into Word, Google Docs, Notion, Excel, etc.
 */

import { DOMSerializer } from '@tiptap/pm/model'

const TABLE_STYLE = 'border-collapse:collapse;width:100%;font-size:13px'
const CELL_STYLE = 'border:1px solid #ccc;padding:6px 10px;text-align:left;vertical-align:top'
const HEADER_STYLE = `${CELL_STYLE};background:#f3f4f6;font-weight:600`

function styledHtmlFromElement(el) {
  const clone = el.cloneNode(true)

  clone.querySelectorAll('table').forEach((table) => {
    table.setAttribute('style', TABLE_STYLE)
    table.setAttribute('border', '1')
    table.querySelectorAll('th').forEach((th) => th.setAttribute('style', HEADER_STYLE))
    table.querySelectorAll('td').forEach((td) => td.setAttribute('style', CELL_STYLE))
  })

  clone.querySelectorAll('strong, b').forEach((node) => {
    node.setAttribute('style', 'font-weight:700')
  })

  clone.querySelectorAll('h1,h2,h3').forEach((h) => {
    h.setAttribute('style', 'font-weight:600;margin:0.75em 0 0.35em')
  })

  return clone.innerHTML
}

function plainTextFromElement(el) {
  const parts = []

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent
      if (t) parts.push({ type: 'text', value: t })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const tag = node.tagName?.toLowerCase()

    if (tag === 'table') {
      const rows = []
      node.querySelectorAll('tr').forEach((tr) => {
        const cells = [...tr.querySelectorAll('th, td')].map((c) => c.textContent.trim())
        if (cells.some(Boolean)) rows.push(cells.join('\t'))
      })
      if (rows.length) parts.push({ type: 'block', value: rows.join('\n') })
      return
    }

    if (tag === 'br') {
      parts.push({ type: 'text', value: '\n' })
      return
    }

    if (/^h[1-6]$/.test(tag)) {
      parts.push({ type: 'block', value: node.textContent.trim() })
      return
    }

    if (tag === 'p') {
      const text = node.textContent.trim()
      if (text) parts.push({ type: 'block', value: text })
      return
    }

    if (tag === 'li') {
      parts.push({ type: 'block', value: `• ${node.textContent.trim()}` })
      return
    }

    if (tag === 'pre' || tag === 'blockquote') {
      parts.push({ type: 'block', value: node.textContent.trim() })
      return
    }

    node.childNodes.forEach(walk)
  }

  el.childNodes.forEach(walk)

  let out = ''
  for (const part of parts) {
    if (part.type === 'block') {
      if (out && !out.endsWith('\n\n')) out += out.endsWith('\n') ? '\n' : '\n\n'
      out += part.value
    } else {
      out += part.value
    }
  }

  return out.trim()
}

export function buildClipboardPayloadFromHtml(html) {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  const styledHtml = styledHtmlFromElement(wrap)
  const plain = plainTextFromElement(wrap)
  return { html: styledHtml, plain }
}

function serializeFragmentToDiv(fragment, schema) {
  const div = document.createElement('div')
  if (!fragment?.size) return div

  const serializer = DOMSerializer.fromSchema(schema)
  div.appendChild(serializer.serializeFragment(fragment))
  return div
}

export function buildClipboardPayloadFromEditor(editor) {
  const { from, to } = editor.state.selection
  const hasSelection = from !== to

  if (hasSelection) {
    const fragment = editor.state.selection.content().content
    const div = serializeFragmentToDiv(fragment, editor.schema)
    return {
      html: styledHtmlFromElement(div),
      plain: plainTextFromElement(div),
    }
  }

  return buildClipboardPayloadFromHtml(editor.getHTML())
}

function wrapHtmlForClipboard(innerHtml) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><!--StartFragment-->${innerHtml}<!--EndFragment--></body></html>`
}

export async function copyEditorToClipboard(editor) {
  if (!editor) return false

  const { html, plain } = buildClipboardPayloadFromEditor(editor)
  const wrappedHtml = wrapHtmlForClipboard(html)

  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const htmlBlob = new Blob([wrappedHtml], { type: 'text/html' })
      const plainBlob = new Blob([plain], { type: 'text/plain' })
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': plainBlob,
        }),
      ])
      return true
    }
  } catch {
    // fall through to legacy API
  }

  try {
    await navigator.clipboard.writeText(plain)
    return true
  } catch {
    return false
  }
}

export function installRichCopyHandler(editor) {
  if (!editor?.view) return () => {}

  const dom = editor.view.dom

  const onCopy = (event) => {
    const { html, plain } = buildClipboardPayloadFromEditor(editor)
    event.preventDefault()
    event.clipboardData.setData('text/html', wrapHtmlForClipboard(html))
    event.clipboardData.setData('text/plain', plain)
  }

  dom.addEventListener('copy', onCopy)
  return () => dom.removeEventListener('copy', onCopy)
}
