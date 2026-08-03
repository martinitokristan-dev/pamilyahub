import { ref } from 'vue'
import imageCompression from 'browser-image-compression'
import { extractTextFromImage } from '@/utils/noteImageOcr.js'
import { insertOcrResultIntoEditor } from '@/utils/noteTextFormatter.js'
import { useToast } from '@/composables/useToast.js'

export function useNoteImageOcr() {
  const toast = useToast()
  const isExtracting = ref(false)
  const extractProgress = ref(0)
  /** @type {import('vue').Ref<'paste'|'upload'|null>} */
  const extractSource = ref(null)

  async function compressImage(file) {
    if (!file.type.startsWith('image/')) return file

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 2400,
        useWebWorker: true,
      })
      return new File([compressed], file.name || 'photo.jpg', { type: compressed.type })
    } catch {
      return file
    }
  }

  async function processImageFile(file, editor, source = 'upload') {
    if (!file || isExtracting.value) return false

    isExtracting.value = true
    extractSource.value = source
    extractProgress.value = source === 'paste' ? 8 : 0

    try {
      const compressed = await compressImage(file)
      const result = await extractTextFromImage(compressed, (pct) => {
        extractProgress.value = pct
      })

      const inserted = insertOcrResultIntoEditor(editor, result)
      if (!inserted) {
        toast.error('Could not insert extracted text')
        return false
      }

      return true
    } catch (err) {
      console.error('Note OCR failed:', err)
      toast.error(
        err.response?.data?.message || err.message || 'Failed to extract text from image'
      )
      return false
    } finally {
      isExtracting.value = false
      extractProgress.value = 0
      extractSource.value = null
    }
  }

  return {
    isExtracting,
    extractProgress,
    extractSource,
    processImageFile,
    compressImage,
  }
}
