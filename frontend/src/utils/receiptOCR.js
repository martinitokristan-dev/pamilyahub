/**
 * Receipt OCR Engine
 * 
 * Uses Tesseract.js for free, offline OCR
 * Includes receipt-specific parsing logic
 */

import { createWorker } from 'tesseract.js'
import { ReceiptPreprocessor } from './imagePreprocessor'

// 4C: Singleton worker instance (module-level)
let _workerInstance = null
let _workerInitializing = false
let _workerReady = false

/**
 * Get or create the singleton Tesseract worker
 */
async function getWorker() {
  if (_workerReady && _workerInstance) return _workerInstance

  if (_workerInitializing) {
    // Wait for existing initialization to complete
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (_workerReady) {
          clearInterval(check)
          resolve(_workerInstance)
        }
      }, 100)
    })
  }

  _workerInitializing = true
  
  try {
    _workerInstance = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          // Progress tracking only
        }
      }
    })

    // Optimized parameters for receipt text recognition
    await _workerInstance.setParameters({
      tessedit_pageseg_mode: '6', // Uniform block of text (best for receipt structure)
      tessedit_ocr_engine_mode: '1', // LSTM neural net only (more accurate for printed text)
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz₱$.,/-:&\' ',
    })

    _workerReady = true
    _workerInitializing = false
    return _workerInstance
  } catch (error) {
    _workerInitializing = false
    console.error('OCR initialization failed:', error)
    throw new Error('Failed to initialize OCR engine. Please refresh and try again.')
  }
}

/**
 * Terminate the singleton worker
 */
export async function terminateWorker() {
  if (_workerInstance) {
    await _workerInstance.terminate()
    _workerInstance = null
    _workerReady = false
  }
}

export class ReceiptOCR {
  constructor() {
    this.worker = null
    this.preprocessor = new ReceiptPreprocessor()
  }

  /**
   * Initialize Tesseract worker with optimal settings for receipt scanning
   */
  async initialize() {
    if (this.worker) return

    try {
      // Use singleton worker instead of creating new one
      this.worker = await getWorker()
    } catch (error) {
      console.error('OCR initialization failed:', error)
      throw new Error('Failed to initialize OCR engine. Please refresh and try again.')
    }
  }

  /**
   * Scan receipt and extract data
   * @param {File} imageFile - Receipt image
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Extracted receipt data
   */
  async scanReceipt(imageFile, onProgress) {
    try {
      // Validate input
      if (!imageFile) {
        throw new Error('No image file provided')
      }

      if (!imageFile.type.startsWith('image/')) {
        throw new Error('Invalid file type. Please select an image file.')
      }

      // Initialize if needed
      if (!this.worker) {
        onProgress?.({ status: 'initializing', progress: 0.1 })
        await this.initialize()
      }

      // Step 1: Preprocess image
      onProgress?.({ status: 'preprocessing', progress: 0.2 })
      const processedImage = await this.preprocessor.preprocessImage(imageFile)

      if (!processedImage) {
        throw new Error('Image preprocessing failed. Please try a clearer image.')
      }

      // Step 2: Run OCR
      onProgress?.({ status: 'recognizing', progress: 0.5 })
      const { data } = await this.worker.recognize(processedImage)

      if (!data || !data.text) {
        throw new Error('Unable to read text from image. Please ensure the receipt is clearly visible.')
      }

      // Check OCR confidence - reject if too low
      const MINIMUM_CONFIDENCE = 25 // Lowered from 35 for rotated/official receipts
      const overallConfidence = data.confidence
      const wordConfidences = data.words?.map(w => w.confidence) ?? []
      const meanWordConfidence = wordConfidences.length > 0
        ? wordConfidences.reduce((a, b) => a + b, 0) / wordConfidences.length
        : 0

      if (overallConfidence < MINIMUM_CONFIDENCE && meanWordConfidence < MINIMUM_CONFIDENCE) {
        return {
          success: false,
          error: 'low_confidence',
          confidence: overallConfidence,
          message: `OCR quality too low (${Math.round(overallConfidence)}%). Try scanning in better lighting or on a flat surface.`
        }
      }

      // Step 3: Parse receipt data
      onProgress?.({ status: 'parsing', progress: 0.8 })
      const parsedData = this.parseReceiptText(data.text)

      // More lenient validation - accept if we found ANY items OR fees
      if (parsedData.items.length === 0 && parsedData.fees.length === 0) {
        // Check if OCR produced mostly garbage (very few readable lines)
        const textLines = data.text.split('\n').filter(line => line.trim())
        if (textLines.length < 5) {
          throw new Error('Unable to read receipt. Try rotating the image or taking a clearer photo.')
        }
        throw new Error('No items found. Please ensure the receipt shows item names and prices clearly.')
      }

      // Don't require a total - we can calculate it from items
      // if (parsedData.total === 0) {
      //   throw new Error('Unable to detect total amount.')
      // }

      onProgress?.({ status: 'complete', progress: 1.0 })

      return {
        success: true,
        rawText: data.text,
        confidence: data.confidence,
        ...parsedData
      }
    } catch (error) {
      console.error('OCR Error:', error)
      
      // Return user-friendly error message
      return {
        success: false,
        error: error.message || 'Failed to scan receipt. Please try again with a clearer image.'
      }
    }
  }

  /**
   * Parse OCR text into structured receipt data
   */
  parseReceiptText(text) {
    let lines = text.split('\n').filter(line => line.trim())

    // Filter out noisy/garbage lines
    lines = this.filterNoisyLines(lines)

    // Apply OCR error corrections
    lines = lines.map(line => this.correctOCRErrors(line))
    
    // If after filtering we have very few lines with readable text, likely complete OCR failure
    if (lines.length < 3) {
      if (import.meta.env.DEV) {
        console.log('[OCR] Too few readable lines after filtering. Possible rotation or quality issue.')
      }
    }

    // DEBUG: Temporary logging to see what OCR is reading
    if (import.meta.env.DEV) {
      console.log('=== OCR RAW TEXT ===')
      console.log(text)
      console.log('=== OCR LINES (FILTERED & CORRECTED) ===')
      lines.forEach((line, idx) => console.log(`${idx}: "${line}"`))
      console.log('==================')
    }

    // Extract merchant name (usually in first 5 lines)
    const merchantName = this.extractMerchantName(lines)

    // Extract date
    const date = this.extractDate(lines)

    // Extract line items and fees (separated)
    const { items, fees } = this.extractItems(lines)

    if (import.meta.env.DEV) {
      console.log('=== PARSED ITEMS ===')
      console.log('Items:', items)
      console.log('Fees:', fees)
      console.log('==================')
    }

    // Try to find TOTAL line first (most accurate)
    let total = this.extractTotal(lines)
    
    // If no TOTAL found, calculate from items + fees
    if (total === null) {
      const itemsTotal = items.reduce((sum, item) => sum + item.subtotal, 0)
      const feesTotal = fees.reduce((sum, fee) => sum + fee.subtotal, 0)
      total = itemsTotal + feesTotal
    }

    // Calculate subtotals
    const itemsSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    const feesSubtotal = fees.reduce((sum, fee) => sum + fee.subtotal, 0)

    // Validate total against computed sum
    const validation = this.validateTotal(items, fees, total)

    return {
      merchantName,
      date,
      items,
      fees,
      itemsSubtotal: parseFloat(itemsSubtotal.toFixed(2)),
      feesSubtotal: parseFloat(feesSubtotal.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      itemCount: items.length,
      feeCount: fees.length,
      totalWarning: validation.warning || null,
      computedTotal: validation.computedTotal || null
    }
  }

  /**
   * Validate parsed total against sum of items
   */
  validateTotal(items, fees, parsedTotal) {
    const itemsSum = items.reduce((sum, item) => sum + item.subtotal, 0)
    const feesSum = fees.reduce((sum, fee) => sum + fee.subtotal, 0)
    const computedTotal = itemsSum + feesSum

    if (parsedTotal === 0 || computedTotal === 0) {
      return { valid: false, warning: 'Could not verify total' }
    }

    const discrepancy = Math.abs(parsedTotal - computedTotal) / parsedTotal
    if (discrepancy > 0.15) {
      return {
        valid: false,
        warning: `Parsed total ₱${parsedTotal.toFixed(2)} differs from items sum ₱${computedTotal.toFixed(2)}. Please verify.`,
        computedTotal
      }
    }

    return { valid: true }
  }

  /**
   * Filter out noisy/garbage lines from OCR output
   */
  filterNoisyLines(lines) {
    return lines.filter(line => {
      const trimmed = line.trim()
      if (trimmed.length === 0) return false

      // Remove lines that are too short to be meaningful
      if (trimmed.length < 3) return false

      // Count alphanumeric characters vs total non-space characters
      const alphanumCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length
      const nonSpaceLength = trimmed.replace(/\s/g, '').length
      
      // Allow common receipt punctuation (: , . - / & ' ₱ $)
      // Only fail if line has very few alphanumerics AND no numbers (likely garbage)
      const hasNumbers = /\d/.test(trimmed)
      if (nonSpaceLength > 0) {
        const ratio = alphanumCount / nonSpaceLength
        // Be more lenient: accept if ratio >= 0.4 OR if line contains numbers (likely item/price line)
        if (ratio < 0.4 && !hasNumbers) {
          if (import.meta.env.DEV) {
            console.log(`[FILTER] Rejected (low alphanum): "${trimmed}" (ratio: ${ratio.toFixed(2)})`)
          }
          return false
        }
      }

      // Remove lines consisting of single letters separated by spaces ("a a a aE")
      const tokens = trimmed.split(/\s+/)
      const singleCharTokens = tokens.filter(t => t.length <= 2).length
      if (tokens.length >= 3 && singleCharTokens / tokens.length > 0.6) {
        if (import.meta.env.DEV) {
          console.log(`[FILTER] Rejected (single chars): "${trimmed}"`)
        }
        return false
      }

      // Remove lines with 3+ identical consecutive NON-SPACE characters (OCR hallucination pattern)
      // Don't count spaces, as receipts often have multiple spaces for alignment
      if (/([^\s])\1{2,}/.test(trimmed)) {
        if (import.meta.env.DEV) {
          console.log(`[FILTER] Rejected (repeated chars): "${trimmed}"`)
        }
        return false
      }

      // Remove lines that are all-caps noise (e.g., "EE ENE Eh", "wn EEE")
      // A valid all-caps line should have at least one word of 4+ chars OR contain numbers
      if (trimmed === trimmed.toUpperCase() && trimmed.length > 5) {
        const hasRealWord = tokens.some(t => t.length >= 4 && /^[A-Z]+$/.test(t))
        if (!hasRealWord && !hasNumbers) {
          if (import.meta.env.DEV) {
            console.log(`[FILTER] Rejected (all-caps noise): "${trimmed}"`)
          }
          return false
        }
      }

      return true
    })
  }

  /**
   * Correct common OCR misreads
   */
  correctOCRErrors(line) {
    return line
      // Percent symbol commonly misread as digits in "10% Service" → "109 Service"
      .replace(/(\d)(9|0)\s*(service|charge|fee|tax|gst|vat)/gi, (match, num, _, label) => `${num}% ${label}`)
      // Percent after number followed by space: "10 9" near fee keywords → "10%"
      .replace(/(\d+)\s+9(\s+(?:service|fee|charge|tax))/gi, '$1%$2')
      // "l" misread as "1" at start of words
      .replace(/\b1([a-z]{2,})/gi, (match, rest) => `l${rest}`)
      // "Tather" misread as "Father" (common OCR error - T instead of F)
      .replace(/\bTather\b/gi, 'Father')
      // Remove stray vertical bars often from receipt borders
      .replace(/\s*\|\s*/g, ' ')
      // Normalize multiple spaces to single space
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  /**
   * Extract total from TOTAL line
   */
  extractTotal(lines) {
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Match "TOTAL 311.20" or "Total: ₱311.20" etc.
      const totalMatch = trimmed.match(/^total[\s:]*[₱P]?\s*(\d+[\.,]\d{2})$/i)
      
      if (totalMatch) {
        return parseFloat(totalMatch[1].replace(',', '.'))
      }
    }
    
    return null
  }

  /**
   * Validate if a line could be a merchant name
   */
  isValidMerchantName(line) {
    const trimmed = line.trim()
    if (trimmed.length < 4) return false

    // Must have at least 40% actual alphabetic characters
    const alphaCount = (trimmed.match(/[a-zA-Z]/g) || []).length
    if (alphaCount / trimmed.length < 0.4) return false

    // Must have at least one word of 3+ real alphabetic characters
    const words = trimmed.split(/\s+/)
    const hasRealWord = words.some(w => /^[a-zA-Z]{3,}/.test(w))
    if (!hasRealWord) return false

    // Reject if it looks like an address or date line
    if (/\d{1,2}[\/\-]\d{1,2}/.test(trimmed)) return false
    if (/address:|tel:|phone:|date:/i.test(trimmed)) return false

    return true
  }

  /**
   * Extract merchant/store name
   */
  extractMerchantName(lines) {
    // Common Filipino store names
    const stores = [
      'SM', 'SUPERMARKET', 'PUREGOLD', 'ROBINSONS', 'MINISTOP',
      'JOLLIBEE', '7-ELEVEN', 'ALFAMART', 'SAVEMORE', 'MERCURY DRUG',
      'WATSONS', 'LANDMARK', 'RUSTANS', 'SHOPWISE', 'WILCON',
      'ACE HARDWARE', 'HANDYMAN', 'NATIONAL BOOKSTORE', 'FULLY BOOKED',
      'STARBUCKS', 'MCDONALDS', 'KFC', 'PIZZA HUT', 'SHAKEYS',
      'CHOWKING', 'GREENWICH', 'MANG INASAL', 'MAX\'S', 'YELLOW CAB',
      'ROCKPOOL', 'BAR', 'GRILL', 'RESTAURANT', 'CAFE', 'BISTRO'
    ]

    // First, check if first line looks like a complete store name (all caps, substantial length)
    if (lines.length > 0) {
      const firstLine = lines[0].trim()
      // If first line is all caps and substantial (>3 chars), likely the store name
      if (firstLine.length > 3 && firstLine === firstLine.toUpperCase() && /^[A-Z\s\&\'\-\.]+$/.test(firstLine)) {
        // Not a generic word like "TAX" or "INVOICE"
        if (!/^(TAX|INVOICE|RECEIPT|TOTAL|CHECK|TABLE)$/i.test(firstLine) && this.isValidMerchantName(firstLine)) {
          return this.cleanMerchantName(firstLine)
        }
      }
    }

    // Search first 5 lines for known stores
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].toUpperCase()
      for (const store of stores) {
        if (line.includes(store)) {
          const candidateName = lines[i].trim()
          if (this.isValidMerchantName(candidateName)) {
            return this.cleanMerchantName(candidateName)
          }
        }
      }
    }

    // Fallback: return first non-empty line that's not "TAX INVOICE" or similar
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i].trim()
      if (line.length > 2 && !/^(TAX|INVOICE|RECEIPT|TOTAL)$/i.test(line) && this.isValidMerchantName(line)) {
        return this.cleanMerchantName(line)
      }
    }

    return 'Unknown Merchant'
  }

  cleanMerchantName(name) {
    let cleaned = name.trim()
    
    // Step 1: Remove leading garbage - single/double letter words at the start
    // "i zg Tather Saturnino" → "Tather Saturnino"
    cleaned = cleaned.replace(/^([a-z]{1,2}\s+){1,3}/i, '')
    
    // Step 2: Remove trailing garbage - words after university/college/store names
    // "Saturnino Urios University rs J Coe a" → "Saturnino Urios University"
    const nameEnders = /\b(university|college|store|market|restaurant|cafe|bar|grill|hotel|inn)\b/i
    const enderMatch = cleaned.match(nameEnders)
    if (enderMatch) {
      // Keep everything up to and including the ender word
      const enderIndex = cleaned.indexOf(enderMatch[0]) + enderMatch[0].length
      cleaned = cleaned.substring(0, enderIndex)
    }
    
    // Step 3: Remove common business suffixes if at the end
    cleaned = cleaned
      .replace(/^(THE|A)\s+/i, '')
      .replace(/\s+(INC|CORP|CO|LTD|STORE)\.?$/i, '')
      .trim()
    
    // Step 4: Remove standalone single letters at the end (leftover garbage)
    // "Tather Saturnino Urios University j" → "Tather Saturnino Urios University"
    cleaned = cleaned.replace(/\s+[a-z]$/i, '')
    
    return cleaned
  }

  /**
   * Extract date from receipt
   */
  extractDate(lines) {
    // Date patterns: MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD, 24Apr'24, etc.
    const datePatterns = [
      // Month name formats: 24Apr'24, 24 Apr 2024, Apr 24 2024 (improved to handle space-separated digits)
      { pattern: /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s'\-,]*(\d{2,4})/i, type: 'month_name' },
      // Standard formats
      { pattern: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/, type: 'slash' },
      // Month name with comma: April 24, 2024
      { pattern: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s'\-,]*(\d{1,2})[\s,]*(\d{2,4})/i, type: 'month_first' },
      // ISO format
      { pattern: /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/, type: 'iso' },
    ]

    const monthMap = {
      'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
      'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }

    // Try matching on single lines first
    for (const line of lines) {
      for (const { pattern, type } of datePatterns) {
        const match = line.match(pattern)
        if (match) {
          try {
            if (type === 'month_name') {
              // Format: 24Apr'24
              const day = parseInt(match[1])
              const month = monthMap[match[2].toLowerCase().slice(0, 3)]
              let year = parseInt(match[3])
              year = year < 100 ? 2000 + year : year
              
              return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            } else if (type === 'month_first') {
              // Format: Apr 24, 2024
              const month = monthMap[match[1].toLowerCase().slice(0, 3)]
              const day = parseInt(match[2])
              let year = parseInt(match[3])
              year = year < 100 ? 2000 + year : year
              
              return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            } else {
              return this.parseDate(match[0])
            }
          } catch (e) {
            console.warn('Date parsing failed:', e)
            continue
          }
        }
      }
    }

    // Check two adjacent lines concatenated (in case leading digit was split)
    for (let i = 0; i < lines.length - 1; i++) {
      const combined = lines[i] + ' ' + lines[i + 1]
      for (const { pattern, type } of datePatterns) {
        const match = combined.match(pattern)
        if (match) {
          try {
            if (type === 'month_name') {
              const day = parseInt(match[1])
              const month = monthMap[match[2].toLowerCase().slice(0, 3)]
              let year = parseInt(match[3])
              year = year < 100 ? 2000 + year : year
              
              return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            } else if (type === 'month_first') {
              const month = monthMap[match[1].toLowerCase().slice(0, 3)]
              const day = parseInt(match[2])
              let year = parseInt(match[3])
              year = year < 100 ? 2000 + year : year
              
              return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            } else {
              return this.parseDate(match[0])
            }
          } catch (e) {
            console.warn('Date parsing failed:', e)
            continue
          }
        }
      }
    }

    // Fallback: today's date
    return new Date().toISOString().split('T')[0]
  }

  parseDate(dateStr) {
    try {
      // Try parsing common formats
      const parts = dateStr.split(/[\/\-]/)

      if (parts.length === 3) {
        const [a, b, c] = parts.map(p => parseInt(p))

        // Detect format
        if (a > 31) {
          // YYYY-MM-DD
          return `${String(a).padStart(4, '20')}-${String(b).padStart(2, '0')}-${String(c).padStart(2, '0')}`
        } else if (c > 31) {
          // MM/DD/YYYY or DD/MM/YYYY
          const year = c < 100 ? 2000 + c : c
          // Assume MM/DD for Philippine receipts
          return `${year}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
        }
      }
    } catch (e) {
      console.warn('Date parsing failed:', e)
    }

    // Fallback
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Detect receipt type based on content patterns
   * Returns: 'itemized' | 'official' | 'invoice'
   * 
   * UNIVERSAL RECEIPT DETECTION - Handles receipts from around the world:
   * - Restaurant receipts (numbered items, menu format)
   * - Grocery/retail receipts (item + price list)
   * - Official receipts (Philippines, single payment)
   * - Tax invoices (business purchases)
   * - Utility bills (electricity, water, internet)
   * - Service receipts (hotel, spa, salon)
   * - Medical receipts (hospital, clinic, pharmacy)
   * - Transport receipts (taxi, parking, toll)
   * - Education receipts (tuition, books, certification)
   */
  detectReceiptType(lines) {
    const allText = lines.join(' ').toUpperCase()
    
    // Count numbered item lines (1 Item, 2 Item, etc.) - STRONGEST INDICATOR
    const numberedLines = lines.filter(line => 
      /^\d+\s+[A-Za-z]/.test(line.trim())
    ).length
    
    // Count lines with "text + price" pattern (itemized receipts)
    const itemizedLines = lines.filter(line => 
      /^[A-Za-z].+\d+[.,]\d{2}\s*$/.test(line.trim())
    ).length
    
    // Count price-only lines (amount on separate line after description)
    const priceOnlyLines = lines.filter(line =>
      /^\s*[\$₱€£¥₹]\s*\d+[.,]\d{2}\s*$/.test(line.trim()) ||
      /^\s*\d+[.,]\d{2}\s*[\$₱€£¥₹]?\s*$/.test(line.trim())
    ).length
    
    // PRIORITY 1: Numbered items = Itemized (Restaurant, retail with numbering)
    if (numberedLines >= 2) {
      return 'itemized'
    }
    
    // PRIORITY 2: Multiple item-price lines = Itemized (Grocery, convenience store)
    if (itemizedLines >= 3) {
      return 'itemized'
    }
    
    // PRIORITY 3: Multiple prices but not itemized format = Could be itemized with descriptions above prices
    if (priceOnlyLines >= 3 && itemizedLines < 2) {
      return 'itemized' // Menu-style format: description on one line, price below
    }
    
    // Official receipt indicators (Philippines, Southeast Asia)
    const hasOfficialReceipt = /OFFICIAL\s+RECEIPT|OR\s+NO\.|OR\s+NUMBER/.test(allText)
    const hasPaymentFor = /PAYMENT\s+FOR|RECEIVED\s+FROM|PARTIAL\s+PAYMENT|IN\s+PAYMENT\s+OF/.test(allText)
    const hasSettlement = /SETTLEMENT|TUITION|ENROLLMENT|CERTIFICATION/.test(allText)
    
    // PRIORITY 4: Official receipt keywords (Single payment documents)
    if (hasOfficialReceipt || (hasPaymentFor && itemizedLines < 2)) {
      return 'official'
    }
    
    // Education/service receipts (usually single payment)
    const hasEducation = /UNIVERSITY|COLLEGE|SCHOOL|TUITION|ENROLLMENT|TRANSCRIPT|CLEARANCE/.test(allText)
    const hasService = /CONSULTATION|CHECKUP|TREATMENT|MEMBERSHIP|SUBSCRIPTION/.test(allText)
    
    if ((hasEducation || hasService) && itemizedLines < 2) {
      return 'official' // Single payment for service
    }
    
    // Invoice indicators (Business documents, bills)
    const hasInvoice = /INVOICE|BILLING\s+STATEMENT|STATEMENT\s+OF\s+ACCOUNT|BILL/.test(allText)
    const hasUtility = /ELECTRICITY|WATER|INTERNET|CABLE|PHONE|MERALCO|MAYNILAD|PLDT/.test(allText)
    
    // PRIORITY 5: Invoice/Bill (but not if it has itemized lines)
    if ((hasInvoice || hasUtility) && itemizedLines < 2) {
      return 'official' // Utility bills are single-payment documents
    }
    
    // Default: If has any prices but unclear format, try itemized first
    if (priceOnlyLines >= 1 || itemizedLines >= 1) {
      return 'itemized' // Be optimistic - try to extract multiple items
    }
    
    // Final fallback: official receipt for unclear formats
    return 'official'
  }

  /**
   * Extract line items with prices
   * Now returns object with items and fees separated
   * SUPER LENIENT: Works with extremely poor OCR quality
   * ENHANCED: Handles official receipts, invoices, and itemized receipts
   */
  extractItems(lines) {
    const items = []
    const fees = [] // Service charges, taxes, etc.
    
    // Detect receipt type first
    const receiptType = this.detectReceiptType(lines)
    
    if (receiptType === 'official' || receiptType === 'invoice') {
      // OFFICIAL RECEIPT / INVOICE MODE
      // Look for description + total pattern
      return this.extractOfficialReceiptItems(lines)
    }
    
    // ITEMIZED RECEIPT MODE (existing logic)
    let i = 0
    let lastLineWasItem = false // Track if previous line added an item
    let itemsStarted = false // Track if we've seen the first numbered item (e.g., "1 ItemName")

    while (i < lines.length) {
      const line = lines[i].trim()
      
      // Skip very short lines or empty
      if (line.length < 2) {
        i++
        continue
      }
      
      // Skip obvious headers/footers and metadata
      if (/^(cash\s+receipt|shop\s+name|shoo\s+name|address\s*:|adzress|tel\s*:|date\s*:|manager\s*:|fiance\s*:)/i.test(line)) {
        lastLineWasItem = false
        i++
        continue
      }
      
      // Skip check/table/invoice metadata lines  
      if (/^(check|tbl|table|invoice)[\s:]/i.test(line)) {
        lastLineWasItem = false
        i++
        continue
      }
      
      // Skip lines with "lorem ipsum" - common placeholder text
      if (/lorem|ipsum|dolor/i.test(line)) {
        lastLineWasItem = false
        i++
        continue
      }
      
      // Skip lines that look like timestamps or dates
      // Match "24Apr'24 19:11", "24Apr-'24 19:11", "Apr'24 19:", etc.
      if (/^\d{0,2}\s*[a-z]{3}[\-\']?\s*['']?\d{2,4}\s+\d{1,2}:\d{0,2}$/i.test(line.trim())) {
        lastLineWasItem = false
        i++
        continue
      }
      
      // Check if this line starts with "1 " followed by a letter - this marks the beginning of items section
      // Pattern: "1 ItemName" where ItemName starts with a letter
      if (!itemsStarted && /^1\s+[A-Za-z]/.test(line.trim())) {
        itemsStarted = true
        // Don't skip this line, let it process as an item below
      }
      
      // SMARTER FALLBACK: If no "1 " pattern found, detect first line with "text + price" pattern
      // Pattern: words followed by a price at the end (e.g., "Lorem 12.50")
      if (!itemsStarted && /^[A-Za-z].+\d+[.,]\d{2}\s*$/.test(line.trim())) {
        // This looks like an item line (text + price), start accepting items
        itemsStarted = true
        // Don't skip this line, let it process as an item below
      }
      
      // Skip lines before items section starts (prevents header garbage from becoming items)
      if (!itemsStarted) {
        lastLineWasItem = false
        i++
        continue
      }

      // STEP 1: Check if this line is a continuation of a multi-line item FIRST
      // (before checking for numbers, so text-only continuation lines aren't skipped)
      // Criteria:
      // - No price at end (rightmost number doesn't look like a price)
      // - Doesn't start a new item (doesn't start with item number like "2 Item Name")
      // - Previous line WAS an item (lastLineWasItem is true) ← KEY FIX
      // - At least one item exists to append to
      const trimmedLine = line.trim()
      const hasPriceAtEnd = /\d+[.,]\d{2}\s*$/.test(trimmedLine)
      const startsNewItem = /^\d+\s+[A-Z]/.test(trimmedLine)
      const isContinuation = !hasPriceAtEnd && !startsNewItem && lastLineWasItem && items.length > 0
      
      // If this looks like a continuation line, append to last item
      if (isContinuation) {
        const lastItem = items[items.length - 1]
        if (lastItem) {
          lastItem.itemName += ' ' + trimmedLine
          // Keep lastLineWasItem true so multi-line continuations work
          i++
          continue
        }
      }
      
      // STEP 2: Extract ALL numbers from line (with or without decimal/comma)
      // Matches: 2.15, 215, 1000, 12.34, 1,234, ₱50, P 100, etc.
      const allNumbers = line.match(/\d+[\.,]?\d*/g)
      
      if (!allNumbers || allNumbers.length === 0) {
        // No numbers and not a continuation = skip
        lastLineWasItem = false
        i++
        continue
      }

      // STEP 2: Find the MOST LIKELY price (rightmost number that looks like money)
      let bestPrice = null
      let bestPriceStr = null
      let bestPriceIndex = -1

      for (let j = allNumbers.length - 1; j >= 0; j--) {
        const numStr = allNumbers[j]
        const num = numStr.replace(',', '.')
        
        // Try to parse as price
        let price = null
        
        if (num.includes('.')) {
          // Has decimal: 12.34 → 12.34
          price = parseFloat(num)
        } else {
          // No decimal: need to infer
          const intVal = parseInt(num)
          
          if (intVal < 10) {
            // 0-9: likely whole number (e.g., 5 for ₱5.00)
            price = intVal
          } else if (intVal >= 10 && intVal <= 99) {
            // 10-99: AMBIGUOUS - could be cents or pesos
            // For receipts: 50 could be ₱50.00 OR ₱0.50
            // DEFAULT: Treat as whole pesos (₱50.00)
            // BUT if this looks too high compared to other items, might be cents
            price = intVal
          } else if (intVal >= 100 && intVal <= 999) {
            // 100-999: Most likely has missing decimal
            // 215 → ₱2.15, 875 → ₱8.75, 350 → ₱3.50
            price = intVal / 100
          } else if (intVal >= 1000 && intVal <= 9999) {
            // 1000-9999: Could be ₱10.00-₱99.99 OR ₱1000-₱9999
            // Check if last 2 digits could be cents
            // 1440 → ₱14.40, 1250 → ₱12.50, 1565 → ₱15.65
            price = intVal / 100
          } else {
            // 10000+: definitely whole pesos
            price = intVal
          }
        }
        
        // Validate price range (₱0.01 to ₱100,000)
        if (price >= 0.01 && price <= 100000) {
          bestPrice = price
          bestPriceStr = numStr
          bestPriceIndex = line.lastIndexOf(numStr)
          break // Take rightmost valid price
        }
      }

      // No valid price found - might be item name continuation
      if (bestPrice === null) {
        lastLineWasItem = false
        i++
        continue
      }

      // STEP 3: Extract item name (everything before the price)
      let itemName = line.substring(0, bestPriceIndex).trim()
      
      // Remove leading/trailing garbage symbols
      itemName = itemName.replace(/^[₱P\s\-\*\.\"'`~\^]+/, '').replace(/[₱P\s\-\*\.\"'`~\^]+$/, '').trim()
      
      // Remove leading item numbers like "1", "2", "3" etc.
      itemName = itemName.replace(/^\d+\s+/, '')
      
      // Skip if no meaningful name left
      if (itemName.length < 1) {
        lastLineWasItem = false
        i++
        continue
      }
      
      // Skip if "name" is just numbers or single letter
      if (/^[\d\s]+$/.test(itemName) || itemName.length === 1) {
        lastLineWasItem = false
        i++
        continue
      }
      
      // Skip lines that are check/table metadata
      // "Check: 41831", "Tbl: H17", "Table: 5", etc.
      if (/^(check|tbl|table)\s*:\s*[\w\d]+$/i.test(itemName)) {
        lastLineWasItem = false
        i++
        continue
      }
      
      // Skip obvious summary lines
      if (/^(total|subtotal|balance|paid|change|tender|amount)/i.test(itemName)) {
        lastLineWasItem = false
        i++
        continue
      }
      
      // STEP 4: Classify as ITEM or FEE
      const isFee = /service|fee|charge|tax|vat|tip|gratuity|%/i.test(itemName)
      
      const itemData = {
        itemName: this.cleanItemName(itemName),
        quantity: 1,
        unitPrice: parseFloat(bestPrice.toFixed(2)),
        subtotal: parseFloat(bestPrice.toFixed(2)),
        type: isFee ? 'fee' : 'item'
      }
      
      if (isFee) {
        fees.push(itemData)
      } else {
        items.push(itemData)
      }
      
      // Mark that this line added an item (so next line can be a continuation)
      lastLineWasItem = true

      i++
    }

    return { items, fees }
  }

  cleanItemName(name) {
    return name
      .replace(/\s{2,}/g, ' ')  // Multiple spaces to single
      .replace(/^\d+\s*[xX]?\s*/, '')  // Remove leading quantity
      .replace(/\s*(each|ea|pc|pcs|box|bag|pack|bottle|can)$/i, '')  // Remove common suffixes
      .trim()
  }

  /**
   * Extract items from official receipts or invoices
   * These receipts have a description block followed by a total amount
   * Example: "PAYMENT FOR TUITION FEE" followed by "270.00"
   */
  extractOfficialReceiptItems(lines) {
    const items = []
    const fees = []
    
    // Strategy: Find all prices, then work backwards to find their descriptions
    const pricesFound = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Skip very short lines
      if (line.length < 2) continue
      
      // Skip header/footer metadata
      if (/^(official\s+receipt|received\s+from|address|tel|date|or\s+no|tin|vat\s+reg)/i.test(line)) continue
      
      // Look for standalone price lines or "label: price" patterns
      // Matches: "PY 2,700.00", "CASH AMT : 2,700.00", "PHP 2700", with commas
      const priceMatch = line.match(/(?:total|amount|payment|php|₱|py|cash\s+amt)\s*:?\s*(\d{1,3}(?:,\d{3})*(?:[.,]\d{2})?)\s*$/i)
      
      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(/,/g, '').replace(',', '.'))
        
        // Validate price range
        if (price >= 0.01 && price <= 100000) {
          if (import.meta.env.DEV) {
            console.log(`[Official Receipt] Found price ${price} at line ${i}: "${line}"`)
          }
          pricesFound.push({
            price,
            lineIndex: i,
            line: line
          })
        }
      }
    }
    
    // If no prices found, return empty
    if (pricesFound.length === 0) {
      if (import.meta.env.DEV) {
        console.log('[Official Receipt] No prices found')
      }
      return { items, fees }
    }
    
    // For each price, extract description from THE SAME LINE first
    for (let p = 0; p < pricesFound.length; p++) {
      const priceInfo = pricesFound[p]
      const priceLineIndex = priceInfo.lineIndex
      const priceLine = lines[priceLineIndex].trim()
      
      let description = ''
      
      // STEP 1: Try to extract description from the SAME line as the price
      // Example: "I East West Certification CASH AMT : 2,700.00"
      // Remove the price pattern to get the description
      const descFromSameLine = priceLine.replace(/(?:total|amount|payment|php|₱|py|cash\s+amt)\s*:?\s*\d{1,3}(?:,\d{3})*(?:[.,]\d{2})?\s*$/i, '').trim()
      
      // Check if the description is a written amount (e.g., "Two thousand pesos")
      // These typically contain: thousand, hundred, pesos, only, words like "ory" (OCR error for "only")
      const isWrittenAmount = /(?:thousand|hundred|pesos|only|ory)\s+/i.test(descFromSameLine)
      
      if (isWrittenAmount) {
        // Skip this price entirely - it's a written amount, not an actual item
        if (import.meta.env.DEV) {
          console.log(`[Official Receipt] Skipping written amount line: "${priceLine}"`)
        }
        continue // Skip to next price
      }
      
      if (descFromSameLine && descFromSameLine.length >= 3) {
        description = descFromSameLine
        if (import.meta.env.DEV) {
          console.log(`[Official Receipt] Description from same line: "${description}"`)
        }
      } else {
        // STEP 2: If same line doesn't have description, look backwards (max 3 lines)
        let startIndex = Math.max(0, priceLineIndex - 3)
        
        // If there's a previous price, don't go past it
        if (p > 0) {
          startIndex = Math.max(startIndex, pricesFound[p - 1].lineIndex + 1)
        }
        
        const descriptionLines = []
        for (let i = startIndex; i < priceLineIndex; i++) {
          const line = lines[i].trim()
          
          // Skip metadata lines
          if (/^(official\s+receipt|received\s+from|address|tel|date|or\s+no|tin|payment\s+date|payor|vat\s+reg)/i.test(line)) continue
          
          // Skip lines with only numbers or single letters
          if (/^[\d\s]+$/.test(line) || line.length <= 2) continue
          
          // Skip lines that are just labels without content
          if (/^(particulars|description|amount|total|no\.|form\s+of)[\s:]*$/i.test(line)) continue
          
          // Skip "SETTLEMENT OF THE FOLLOWING" header line
          if (/settlement\s+of\s+the\s+following/i.test(line)) continue
          
          // Skip "IN PARTIAL/FULL PAYMENT FOR" filler lines
          if (/in\s+(partial|full)\s+payment\s+for/i.test(line)) continue
          
          // Skip "ENGAGED IN THE BUS" type lines
          if (/engaged\s+in\s+the\s+bus/i.test(line)) continue
          
          descriptionLines.push(line)
        }
        
        description = descriptionLines.join(' ').trim()
        if (import.meta.env.DEV) {
          console.log(`[Official Receipt] Description from previous lines: "${description}"`)
        }
      }
      
      // Default description if still empty
      if (!description || description.length < 3) {
        description = 'Payment'
      }
      
      // Clean up description - more aggressive cleanup
      description = description
        .replace(/^(payment\s+for|particulars|description|settlement\s+of|the\s+sum\s+of|pesos|i\s+)/i, '') // Remove leading "I "
        .replace(/\s+/g, ' ')
        .replace(/^[:\-\s]+/, '') // Remove leading punctuation
        .trim()
      
      // Truncate very long descriptions (keep first 50 chars for better display)
      if (description.length > 50) {
        description = description.substring(0, 50).trim() + '...'
      }
      
      // Create item
      const itemData = {
        itemName: this.cleanItemName(description),
        quantity: 1,
        unitPrice: parseFloat(priceInfo.price.toFixed(2)),
        subtotal: parseFloat(priceInfo.price.toFixed(2)),
        type: 'item'
      }
      
      if (import.meta.env.DEV) {
        console.log(`[Official Receipt] Created item:`, itemData)
      }
      
      items.push(itemData)
    }
    
    // If we found multiple prices with the SAME AMOUNT, keep only the LAST one (most likely the actual item)
    // Remove earlier duplicates (often these are written amounts in words like "Two thousand pesos")
    if (items.length > 1) {
      // Group items by price
      const priceGroups = new Map()
      items.forEach((item, index) => {
        const price = item.subtotal
        if (!priceGroups.has(price)) {
          priceGroups.set(price, [])
        }
        priceGroups.get(price).push({ item, index })
      })
      
      // For each price that appears multiple times, keep only the LAST occurrence
      const indicesToRemove = new Set()
      priceGroups.forEach((group, price) => {
        if (group.length > 1) {
          // Remove all except the last one
          for (let i = 0; i < group.length - 1; i++) {
            indicesToRemove.add(group[i].index)
            if (import.meta.env.DEV) {
              console.log(`[Official Receipt] Removing duplicate price ${price}: "${group[i].item.itemName}"`)
            }
          }
        }
      })
      
      // Remove items in reverse order to maintain indices
      Array.from(indicesToRemove).sort((a, b) => b - a).forEach(index => {
        items.splice(index, 1)
      })
    }
    
    return { items, fees }
  }

  /**
   * Auto-detect category from receipt content
   * Priority: Merchant name keywords > Item name keywords > Default
   */
  detectCategory(merchantName, items) {
    const merchant = merchantName.toLowerCase()
    const itemNames = items.map(i => i.itemName.toLowerCase()).join(' ')

    // Priority 1: Specific restaurant/bar keywords in merchant name
    if (merchant.includes('bar') || merchant.includes('grill') || 
        merchant.includes('restaurant') || merchant.includes('bistro') ||
        merchant.includes('cafe') || merchant.includes('coffee')) {
      return 'Restaurant'
    }

    // Priority 2: Fast food chains
    if (merchant.includes('jollibee') || merchant.includes('mcdonald') ||
        merchant.includes('kfc') || merchant.includes('burger king') ||
        merchant.includes('subway') || merchant.includes('pizza')) {
      return 'Restaurant'
    }

    // Priority 3: Grocery/supermarket
    if (merchant.includes('supermarket') || merchant.includes('grocery') || 
        merchant.includes('puregold') || merchant.includes('sm mart') ||
        merchant.includes('robinsons') || merchant.includes('savemore')) {
      return 'Groceries'
    }

    // Priority 4: Gas stations
    if (merchant.includes('gas') || merchant.includes('petron') ||
        merchant.includes('shell') || merchant.includes('caltex') ||
        merchant.includes('seaoil') || merchant.includes('phoenix')) {
      return 'Transportation'
    }

    // Priority 5: Pharmacy
    if (merchant.includes('mercury') || merchant.includes('pharmacy') ||
        merchant.includes('drug') || merchant.includes('watsons') ||
        merchant.includes('southstar')) {
      return 'Healthcare'
    }

    // Priority 6: Education/School
    if (merchant.includes('university') || merchant.includes('college') ||
        merchant.includes('school') || merchant.includes('academy') ||
        merchant.includes('institute') || merchant.includes('education')) {
      return 'Education'
    }

    // Priority 7: Item-based detection
    // Restaurant items (wine, alcohol, entrees)
    if (itemNames.match(/wine|beer|cocktail|steak|pasta|burger|pizza|salad|dessert|appetizer/i)) {
      return 'Restaurant'
    }

    // Grocery items
    if (itemNames.match(/rice|egg|milk|bread|vegetable|meat|fish|chicken|pork|beef/i)) {
      return 'Groceries'
    }

    // Fuel
    if (itemNames.match(/gasoline|diesel|fuel|premium|unleaded/i)) {
      return 'Transportation'
    }

    // Medicine
    if (itemNames.match(/tablet|capsule|syrup|medicine|vitamin|supplement/i)) {
      return 'Healthcare'
    }

    // Education items (tuition, books, certification)
    if (itemNames.match(/tuition|enrollment|book|certification|exam|transcript|clearance|uniform/i)) {
      return 'Education'
    }

    // Default
    return 'Shopping'
  }

  /**
   * Clean up resources
   */
  async terminate() {
    // Don't terminate the singleton worker from instance
    // Use terminateWorker() exported function instead
    this.worker = null
  }
}
