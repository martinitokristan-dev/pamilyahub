/**
 * Note Image OCR — extracts copyable text from photos/screenshots.
 * Uses Gemini Vision API when online, Tesseract.js + bbox table rebuild as offline fallback.
 */

import { createWorker } from 'tesseract.js'
import { noteService } from '@/services/noteService.js'
import { reconstructTableFromTesseract, reconstructDocumentFromTesseract, structuredToPlainText } from '@/utils/noteTableReconstruct.js'

let _worker = null
let _workerReady = false
let _workerInitPromise = null

async function getNoteOcrWorker(onProgress) {
  if (_workerReady && _worker) return _worker
  if (_workerInitPromise) return _workerInitPromise

  _workerInitPromise = (async () => {
    _worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round((m.progress || 0) * 100))
        }
      },
    })

    await _worker.setParameters({
      tessedit_pageseg_mode: '6',
      tessedit_ocr_engine_mode: '1',
      preserve_interword_spaces: '1',
    })

    _workerReady = true
    return _worker
  })()

  return _workerInitPromise
}

async function extractWithTesseract(imageFile, onProgress) {
  const worker = await getNoteOcrWorker(onProgress)
  onProgress?.(5)

  const { data } = await worker.recognize(imageFile)
  onProgress?.(100)

  const tableStructured = reconstructTableFromTesseract(data)
  if (tableStructured?.tables?.length) {
    return {
      text: structuredToPlainText(tableStructured),
      structured: tableStructured,
      provider: 'tesseract',
    }
  }

  const docStructured = reconstructDocumentFromTesseract(data)
  if (docStructured?.blocks?.length) {
    return {
      text: structuredToPlainText(docStructured),
      structured: docStructured,
      provider: 'tesseract',
    }
  }

  const text = data.text?.trim()
  if (!text) {
    throw new Error('No readable text found in the image.')
  }

  return { text, structured: null, provider: 'tesseract' }
}

async function extractWithApi(imageFile, onProgress) {
  onProgress?.(10)
  const formData = new FormData()
  formData.append('image', imageFile)

  const res = await noteService.extractTextFromImage(formData, (pct) => {
    onProgress?.(10 + Math.round(pct * 0.85))
  })

  onProgress?.(100)

  const payload = res.data?.data ?? res.data
  return {
    text: payload.text,
    structured: payload.structured || null,
    provider: payload.provider || 'gemini',
    model: payload.model || null,
  }
}

export async function extractTextFromImage(imageFile, onProgress) {
  if (!imageFile?.type?.startsWith('image/')) {
    throw new Error('Please choose a valid image file.')
  }

  try {
    return await extractWithApi(imageFile, onProgress)
  } catch (apiError) {
    const status = apiError.response?.status
    const isOffline = !navigator.onLine || apiError.code === 'ERR_NETWORK'
    const canFallback = isOffline || status === 503 || status === 502 || status === 429

    if (!canFallback) {
      throw apiError
    }

    console.warn('[Note OCR] API unavailable, falling back to offline Tesseract:', apiError.message)
    return extractWithTesseract(imageFile, onProgress)
  }
}

export async function terminateNoteOcrWorker() {
  if (_worker) {
    await _worker.terminate()
    _worker = null
    _workerReady = false
    _workerInitPromise = null
  }
}
