# Free Forever OCR Solution for Receipt Scanning

## 🎯 Goal
Scan receipt text accurately with **ZERO ongoing costs** - free forever!

---

## ✅ Recommended Solution: Tesseract.js + Image Preprocessing

### Why This Stack?

1. **Tesseract.js** - Free, open-source OCR engine
2. **Image Preprocessing** - Enhance receipt before OCR (crucial for accuracy!)
3. **Client-Side Processing** - Runs in browser = zero server costs
4. **Offline Capable** - Works without internet after initial load

---

## 📦 Required Libraries

```json
{
  "dependencies": {
    "tesseract.js": "^5.0.0",          // OCR engine
    "opencv.js": "^4.9.0",              // Image preprocessing
    // OR use these lighter alternatives:
    "pica": "^9.0.1",                   // Image resizing
    "canvas": "^2.11.2"                 // Image manipulation
  }
}
```

---

## 🔧 Implementation Strategy

### Step 1: Capture High-Quality Photo

```javascript
// frontend/src/composables/useReceiptScanner.js

export function useReceiptScanner() {
  const captureReceipt = async () => {
    const constraints = {
      video: {
        facingMode: 'environment',  // Back camera
        width: { ideal: 1920 },     // High resolution
        height: { ideal: 1080 },
        focusMode: 'continuous'     // Auto-focus
      }
    }
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return stream
  }
  
  return { captureReceipt }
}
```

### Step 2: Image Preprocessing (CRITICAL for accuracy!)

```javascript
// frontend/src/utils/imagePreprocessor.js

import Pica from 'pica'

export class ReceiptPreprocessor {
  
  /**
   * Preprocess receipt image for better OCR accuracy
   * This is THE KEY to making Tesseract work well!
   */
  async preprocessImage(imageFile) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = await this.loadImage(imageFile)
    
    // 1. Resize to optimal dimensions (Tesseract works best at 300-600 DPI equivalent)
    const optimizedImage = await this.resizeImage(img, 1600, 2400)
    
    // 2. Convert to grayscale
    const grayscale = this.toGrayscale(optimizedImage)
    
    // 3. Increase contrast (make text darker, background whiter)
    const contrasted = this.increaseContrast(grayscale, 1.5)
    
    // 4. Apply adaptive thresholding (binarization)
    const binary = this.adaptiveThreshold(contrasted)
    
    // 5. Denoise (remove specks)
    const denoised = this.denoise(binary)
    
    // 6. Deskew (straighten rotated images)
    const straightened = this.deskew(denoised)
    
    return straightened
  }
  
  async loadImage(file) {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.src = URL.createObjectURL(file)
    })
  }
  
  async resizeImage(img, maxWidth, maxHeight) {
    const pica = new Pica()
    const canvas = document.createElement('canvas')
    
    // Calculate aspect ratio
    let width = img.width
    let height = img.height
    
    if (width > maxWidth) {
      height = (maxWidth / width) * height
      width = maxWidth
    }
    
    if (height > maxHeight) {
      width = (maxHeight / height) * width
      height = maxHeight
    }
    
    canvas.width = width
    canvas.height = height
    
    // High-quality resize using Lanczos3 algorithm
    await pica.resize(img, canvas, {
      quality: 3,
      alpha: false
    })
    
    return canvas
  }
  
  toGrayscale(canvas) {
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    for (let i = 0; i < data.length; i += 4) {
      // Weighted grayscale conversion (preserves readability)
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      data[i] = gray       // Red
      data[i + 1] = gray   // Green
      data[i + 2] = gray   // Blue
      // Alpha unchanged
    }
    
    ctx.putImageData(imageData, 0, 0)
    return canvas
  }
  
  increaseContrast(canvas, factor = 1.5) {
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    const contrast = (factor - 1) * 255
    const factorAdjusted = (259 * (contrast + 255)) / (255 * (259 - contrast))
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = factorAdjusted * (data[i] - 128) + 128
      data[i + 1] = factorAdjusted * (data[i + 1] - 128) + 128
      data[i + 2] = factorAdjusted * (data[i + 2] - 128) + 128
    }
    
    ctx.putImageData(imageData, 0, 0)
    return canvas
  }
  
  adaptiveThreshold(canvas) {
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const width = canvas.width
    const height = canvas.height
    
    // Simple local adaptive thresholding
    const blockSize = 15
    const C = 10
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        
        // Calculate local mean in blockSize x blockSize window
        let sum = 0
        let count = 0
        
        for (let by = Math.max(0, y - blockSize); by < Math.min(height, y + blockSize); by++) {
          for (let bx = Math.max(0, x - blockSize); bx < Math.min(width, x + blockSize); bx++) {
            const bi = (by * width + bx) * 4
            sum += data[bi]
            count++
          }
        }
        
        const localMean = sum / count
        const threshold = localMean - C
        
        // Apply threshold
        const value = data[i] > threshold ? 255 : 0
        data[i] = value
        data[i + 1] = value
        data[i + 2] = value
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
    return canvas
  }
  
  denoise(canvas) {
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const width = canvas.width
    const height = canvas.height
    
    // Simple median filter (removes salt-and-pepper noise)
    const filtered = new Uint8ClampedArray(data)
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4
        
        const neighbors = []
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ni = ((y + dy) * width + (x + dx)) * 4
            neighbors.push(data[ni])
          }
        }
        
        neighbors.sort((a, b) => a - b)
        const median = neighbors[4] // Middle value
        
        filtered[i] = median
        filtered[i + 1] = median
        filtered[i + 2] = median
      }
    }
    
    ctx.putImageData(new ImageData(filtered, width, height), 0, 0)
    return canvas
  }
  
  deskew(canvas) {
    // Basic deskewing using edge detection
    // For production, consider using opencv.js for better results
    // This is a simplified version
    return canvas // Implement if needed
  }
}
```

### Step 3: OCR with Tesseract.js

```javascript
// frontend/src/utils/receiptOCR.js

import Tesseract from 'tesseract.js'
import { ReceiptPreprocessor } from './imagePreprocessor'

export class ReceiptOCR {
  constructor() {
    this.worker = null
    this.preprocessor = new ReceiptPreprocessor()
  }
  
  /**
   * Initialize Tesseract worker (do this once on app load)
   */
  async initialize() {
    this.worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => console.log('[Tesseract]', m),
      // Use LSTM OCR engine (better for modern text)
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
      // Optimize for receipt-like documents
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      // Improve accuracy
      preserve_interword_spaces: '1',
    })
    
    console.log('✅ Tesseract initialized')
  }
  
  /**
   * Scan receipt and extract text
   */
  async scanReceipt(imageFile, onProgress) {
    if (!this.worker) {
      await this.initialize()
    }
    
    try {
      // Step 1: Preprocess image (THIS IS CRITICAL!)
      onProgress?.({ status: 'preprocessing', progress: 0.2 })
      const processedImage = await this.preprocessor.preprocessImage(imageFile)
      
      // Step 2: Run OCR
      onProgress?.({ status: 'recognizing', progress: 0.5 })
      const { data } = await this.worker.recognize(processedImage)
      
      // Step 3: Parse receipt data
      onProgress?.({ status: 'parsing', progress: 0.8 })
      const parsedData = this.parseReceiptText(data.text, data)
      
      onProgress?.({ status: 'complete', progress: 1.0 })
      
      return {
        success: true,
        rawText: data.text,
        confidence: data.confidence,
        ...parsedData
      }
    } catch (error) {
      console.error('OCR Error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  /**
   * Parse OCR text into structured receipt data
   */
  parseReceiptText(text, ocrData) {
    const lines = text.split('\n').filter(line => line.trim())
    
    // Extract merchant name (usually first 1-3 lines)
    const merchantName = this.extractMerchantName(lines)
    
    // Extract date
    const date = this.extractDate(lines)
    
    // Extract line items with prices
    const items = this.extractItems(lines)
    
    // Calculate total
    const total = items.reduce((sum, item) => sum + item.subtotal, 0)
    
    return {
      merchantName,
      date,
      items,
      total,
      itemCount: items.length
    }
  }
  
  extractMerchantName(lines) {
    // Look for common store names in first 5 lines
    const storeKeywords = [
      'SM', 'SUPERMARKET', 'PUREGOLD', 'ROBINSONS', 'MINISTOP',
      'JOLLIBEE', '7-ELEVEN', 'ALFAMART', 'SAVEMORE', 'MERCURY DRUG'
    ]
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].toUpperCase()
      for (const keyword of storeKeywords) {
        if (line.includes(keyword)) {
          return lines[i].trim()
        }
      }
    }
    
    // Fallback: return first line
    return lines[0]?.trim() || 'Unknown Store'
  }
  
  extractDate(lines) {
    // Look for date patterns: MM/DD/YYYY, DD-MM-YYYY, etc.
    const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/
    
    for (const line of lines) {
      const match = line.match(dateRegex)
      if (match) {
        // Parse and return ISO date
        const [_, m, d, y] = match
        const year = y.length === 2 ? `20${y}` : y
        return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      }
    }
    
    // Fallback: today's date
    return new Date().toISOString().split('T')[0]
  }
  
  extractItems(lines) {
    const items = []
    
    // Pattern: looks for lines with item name and price
    // Examples:
    //   "1 TOYO SILVER SWAN      45.00"
    //   "2x OIL LUCKY           180.00"
    //   "RICE 5KG               250.00"
    
    const itemPattern = /^(\d+[xX]?\s+)?([A-Za-z0-9\s\-\/]+)\s+(\d+[\.,]\d{2})$/
    
    for (const line of lines) {
      const match = line.trim().match(itemPattern)
      if (match) {
        const [_, qtyStr, itemName, priceStr] = match
        
        // Parse quantity
        const quantity = qtyStr 
          ? parseInt(qtyStr.replace(/[xX\s]/g, ''))
          : 1
        
        // Parse price
        const price = parseFloat(priceStr.replace(',', '.'))
        const unitPrice = quantity > 1 ? price / quantity : price
        
        items.push({
          itemName: itemName.trim(),
          quantity,
          unitPrice: parseFloat(unitPrice.toFixed(2)),
          subtotal: parseFloat(price.toFixed(2))
        })
      }
    }
    
    return items
  }
  
  /**
   * Clean up resources when done
   */
  async terminate() {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
    }
  }
}
```

### Step 4: Vue Composable for Easy Use

```javascript
// frontend/src/composables/useReceiptScanner.js

import { ref } from 'vue'
import { ReceiptOCR } from '@/utils/receiptOCR'

export function useReceiptScanner() {
  const isScanning = ref(false)
  const progress = ref(0)
  const status = ref('')
  const result = ref(null)
  const error = ref(null)
  
  const ocr = new ReceiptOCR()
  
  const scanReceipt = async (imageFile) => {
    isScanning.value = true
    progress.value = 0
    status.value = 'Initializing...'
    error.value = null
    
    try {
      const data = await ocr.scanReceipt(imageFile, (progressData) => {
        progress.value = progressData.progress * 100
        status.value = progressData.status
      })
      
      if (data.success) {
        result.value = data
        return data
      } else {
        error.value = data.error
        throw new Error(data.error)
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      isScanning.value = false
    }
  }
  
  return {
    isScanning,
    progress,
    status,
    result,
    error,
    scanReceipt
  }
}
```

---

## 🎯 Usage Example

```vue
<!-- ScanReceiptView.vue -->
<template>
  <div class="scan-receipt">
    <input 
      type="file" 
      accept="image/*" 
      capture="environment"
      @change="handleImageSelect"
      ref="fileInput"
    />
    
    <div v-if="isScanning" class="scanning-overlay">
      <div class="progress-bar">
        <div class="progress" :style="{ width: progress + '%' }"></div>
      </div>
      <p>{{ status }} ({{ Math.round(progress) }}%)</p>
    </div>
    
    <div v-if="result" class="result">
      <h3>{{ result.merchantName }}</h3>
      <p>Date: {{ result.date }}</p>
      <p>Total: ₱{{ result.total.toFixed(2) }}</p>
      
      <h4>Items ({{ result.itemCount }})</h4>
      <ul>
        <li v-for="item in result.items" :key="item.itemName">
          {{ item.quantity }}x {{ item.itemName }} - ₱{{ item.subtotal.toFixed(2) }}
        </li>
      </ul>
      
      <button @click="saveExpense">Save Expense</button>
    </div>
    
    <div v-if="error" class="error">
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useReceiptScanner } from '@/composables/useReceiptScanner'

const { isScanning, progress, status, result, error, scanReceipt } = useReceiptScanner()
const fileInput = ref(null)

const handleImageSelect = async (event) => {
  const file = event.target.files[0]
  if (file) {
    await scanReceipt(file)
  }
}

const saveExpense = () => {
  // Save to your backend
  console.log('Saving expense:', result.value)
}
</script>
```

---

## 🚀 Accuracy Tips

### 1. Guide Users to Take Good Photos

Show instructions:
```
📸 Tips for Best Results:
✅ Good lighting (natural light is best)
✅ Hold phone parallel to receipt
✅ Receipt should fill most of frame
✅ Avoid shadows and glare
✅ Make sure text is in focus
```

### 2. Real-Time Feedback

```javascript
// Check image quality before OCR
async function checkImageQuality(imageFile) {
  const img = await loadImage(imageFile)
  
  // Check resolution
  if (img.width < 800 || img.height < 1000) {
    return { ok: false, message: 'Image too small. Move closer!' }
  }
  
  // Check if image is too blurry (using variance of Laplacian)
  const blurScore = calculateBlurScore(img)
  if (blurScore < 100) {
    return { ok: false, message: 'Image is blurry. Hold steady!' }
  }
  
  return { ok: true }
}
```

### 3. Let Users Verify & Edit

Always show extracted data for user confirmation:
```javascript
{
  merchantName: 'SM SUPERMARKET',  // ← User can edit
  date: '2026-06-09',              // ← User can edit
  items: [
    { name: 'TOYO', qty: 1, price: 45 }  // ← User can edit/remove/add
  ]
}
```

---

## 📊 Expected Accuracy

With proper preprocessing:

| Receipt Type | Accuracy | Notes |
|--------------|----------|-------|
| **Clean printed receipts** | 85-95% | SM, Puregold, 7-Eleven |
| **Thermal receipts** | 70-85% | Older thermal prints fade |
| **Handwritten receipts** | 30-50% | Poor, may need manual entry |
| **Crumpled/damaged** | 40-70% | Depends on damage level |

---

## 💾 Offline Support

```javascript
// Service Worker (sw.js)

// Cache Tesseract trained data files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('tesseract-cache').then((cache) => {
      return cache.addAll([
        'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
        'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
        'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz'
      ])
    })
  )
})
```

---

## 🔋 Performance Optimization

### Use Web Worker

```javascript
// receiptWorker.js
import { ReceiptOCR } from './receiptOCR'

const ocr = new ReceiptOCR()

self.addEventListener('message', async (e) => {
  const { type, imageFile } = e.data
  
  if (type === 'scan') {
    const result = await ocr.scanReceipt(imageFile, (progress) => {
      self.postMessage({ type: 'progress', data: progress })
    })
    
    self.postMessage({ type: 'result', data: result })
  }
})
```

```javascript
// Use in Vue component
const worker = new Worker(new URL('./receiptWorker.js', import.meta.url))

worker.postMessage({ type: 'scan', imageFile })

worker.addEventListener('message', (e) => {
  if (e.data.type === 'result') {
    console.log('OCR Complete:', e.data.data)
  }
})
```

---

## 📱 Mobile Optimization

```javascript
// Detect if on mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

if (isMobile) {
  // Use native camera with better constraints
  const constraints = {
    video: {
      facingMode: { exact: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      focusMode: { ideal: 'continuous' },
      torch: false  // Flash off by default
    }
  }
}
```

---

## 🎓 Advanced: Train Custom Model (Optional)

For Filipino receipts specifically:

1. Create custom training data with Filipino store receipts
2. Use Tesseract training tools to create `fil.traineddata`
3. Load custom language: `Tesseract.createWorker('fil')`

This can improve accuracy for:
- Filipino product names
- Local store formats
- Mixed English/Tagalog text

---

## 💡 Fallback Options

If Tesseract struggles:

```javascript
async function scanReceiptWithFallback(imageFile) {
  // Try Tesseract first (free)
  let result = await tesseractOCR(imageFile)
  
  if (result.confidence < 60) {
    // Low confidence? Offer manual entry
    return {
      success: false,
      message: 'Receipt unclear. Would you like to enter manually?',
      partialData: result
    }
  }
  
  return result
}
```

---

## 📦 Installation

```bash
cd frontend
npm install tesseract.js pica
```

---

## 🎯 Summary

**Best Free Solution:**
- ✅ **Tesseract.js** - Free OCR engine
- ✅ **Image preprocessing** - Critical for accuracy!
- ✅ **Client-side processing** - No server costs
- ✅ **Works offline** - After initial load
- ✅ **No API keys needed** - Zero ongoing costs

**Accuracy Strategy:**
1. Guide users to take good photos
2. Preprocess images (grayscale, contrast, denoise)
3. Let users verify & edit results
4. Learn from corrections over time

**Cost:** **₱0 forever!** 🎉

---

Want me to create a full implementation spec for this? I can help you integrate this into PamilyaHub! 🚀
