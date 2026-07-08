/**
 * Receipt Scanner Composable
 * 
 * Provides reactive state and methods for scanning receipts
 */

import { ref } from 'vue'
import { ReceiptOCR, terminateWorker } from '@/utils/receiptOCR'

export function useReceiptScanner() {
  const isScanning = ref(false)
  const scanProgress = ref(0)
  const scanStatus = ref('')
  const scannedData = ref(null)
  const error = ref(null)
  const rawImage = ref(null)
  const scanError = ref(null) // 4D: Detailed error info

  let ocrInstance = null

  /**
   * Initialize OCR engine (call once on app start)
   */
  const initializeOCR = async () => {
    if (!ocrInstance) {
      ocrInstance = new ReceiptOCR()
      await ocrInstance.initialize()
    }
  }

  /**
   * Scan receipt from image file
   * @param {File} imageFile - Receipt image from camera or gallery
   * @returns {Promise<Object>} Scanned receipt data
   */
  const scanReceipt = async (imageFile) => {
    isScanning.value = true
    scanProgress.value = 0
    scanStatus.value = 'preprocessing'
    error.value = null
    scannedData.value = null
    rawImage.value = imageFile

    try {
      // Initialize OCR if not already done
      if (!ocrInstance) {
        await initializeOCR()
      }

      // Scan the receipt
      const result = await ocrInstance.scanReceipt(imageFile, (progress) => {
        scanProgress.value = progress.progress * 100
        scanStatus.value = progress.status
      })

      if (result.success) {
        // Auto-detect category
        const category = ocrInstance.detectCategory(result.merchantName, result.items)

        // Store scanned data
        scannedData.value = {
          merchantName: result.merchantName,
          date: result.date,
          total: result.total,
          items: result.items,
          fees: result.fees || [],
          itemsSubtotal: result.itemsSubtotal,
          feesSubtotal: result.feesSubtotal,
          itemCount: result.itemCount,
          feeCount: result.feeCount || 0,
          category,
          confidence: result.confidence,
          rawText: result.rawText,
          rawImage: imageFile
        }

        return scannedData.value
      } else {
        // Handle different error types
        if (result.error === 'low_confidence') {
          throw new Error(result.message || 'Image quality too low. Please try scanning in better lighting or on a flat surface.')
        } else {
          throw new Error(result.error || 'Failed to scan receipt')
        }
      }
    } catch (err) {
      // 4D: Enhanced error handling
      if (import.meta.env.DEV) {
        console.error('[ReceiptScanner] Scan failed:', err)
      }
      error.value = err.message || 'Scan failed unexpectedly'
      scanError.value = {
        message: err.message,
        code: err.code || 'UNKNOWN',
        timestamp: new Date().toISOString()
      }
      throw err
    } finally {
      isScanning.value = false
    }
  }

  /**
   * Clear scanned data
   */
  const clearScannedData = () => {
    scannedData.value = null
    error.value = null
    scanProgress.value = 0
    scanStatus.value = ''
    rawImage.value = null
  }

  /**
   * Cleanup resources
   */
  const cleanup = async () => {
    if (ocrInstance) {
      await ocrInstance.terminate()
      ocrInstance = null
    }
    // Note: Don't terminate the singleton worker here
    // It will be reused across scans for better performance
  }

  /**
   * Force terminate the singleton worker (use sparingly)
   */
  const forceCleanup = async () => {
    await terminateWorker()
    ocrInstance = null
  }

  return {
    // State
    isScanning,
    scanProgress,
    scanStatus,
    scannedData,
    error,
    rawImage,
    scanError, // 4D: Detailed error

    // Methods
    scanReceipt,
    clearScannedData,
    initializeOCR,
    cleanup,
    forceCleanup
  }
}
