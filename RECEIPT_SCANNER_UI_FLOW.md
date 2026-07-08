# Receipt Scanner - Camera + Gallery Upload Flow

## 📸 User Options

Users can scan receipts in TWO ways:
1. **📷 Take Photo** - Open camera and capture receipt
2. **🖼️ Upload from Gallery** - Choose existing photo

---

## 🎨 UI Implementation

### Mobile View - Scan Receipt Button

```vue
<!-- ExpensesView.vue -->
<template>
  <div class="expenses-page">
    <header>
      <h1>Expenses</h1>
      <div class="actions">
        <!-- Regular add expense button -->
        <button @click="showAddExpense" class="btn-primary">
          ➕ Add Expense
        </button>
        
        <!-- NEW: Scan receipt button -->
        <button @click="showScanOptions" class="btn-scan">
          📷 Scan Receipt
        </button>
      </div>
    </header>
    
    <!-- Action Sheet / Bottom Modal -->
    <ActionSheet v-model:show="scanOptionsOpen" title="Scan Receipt">
      <div class="scan-options">
        <!-- Option 1: Take Photo -->
        <button @click="openCamera" class="scan-option">
          <span class="icon">📷</span>
          <span class="label">Take Photo</span>
          <span class="desc">Use camera to capture receipt</span>
        </button>
        
        <!-- Option 2: Upload from Gallery -->
        <button @click="openGallery" class="scan-option">
          <span class="icon">🖼️</span>
          <span class="label">Choose from Gallery</span>
          <span class="desc">Select existing photo</span>
        </button>
      </div>
    </ActionSheet>
    
    <!-- Hidden file input for both camera and gallery -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      :capture="captureMode"
      @change="handleImageSelect"
      style="display: none"
    />
    
    <!-- Scanning Progress Modal -->
    <ScanningModal
      v-if="isScanning"
      :progress="scanProgress"
      :status="scanStatus"
    />
    
    <!-- Review Scanned Data Modal -->
    <ReviewReceiptModal
      v-if="scannedData"
      :data="scannedData"
      @save="saveScannedExpense"
      @cancel="scannedData = null"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useReceiptScanner } from '@/composables/useReceiptScanner'

const scanOptionsOpen = ref(false)
const fileInput = ref(null)
const captureMode = ref(null)

const {
  isScanning,
  scanProgress,
  scanStatus,
  scannedData,
  scanReceipt
} = useReceiptScanner()

// Show scan options bottom sheet
const showScanOptions = () => {
  scanOptionsOpen.value = true
}

// Option 1: Open Camera
const openCamera = () => {
  captureMode.value = 'environment'  // This tells mobile to use camera
  scanOptionsOpen.value = false
  fileInput.value.click()
}

// Option 2: Open Gallery
const openGallery = () => {
  captureMode.value = null  // No capture = gallery picker
  scanOptionsOpen.value = false
  fileInput.value.click()
}

// Handle image selection (from camera OR gallery)
const handleImageSelect = async (event) => {
  const file = event.target.files[0]
  if (file) {
    await scanReceipt(file)
    // Reset input so same file can be selected again
    event.target.value = ''
  }
}

const saveScannedExpense = async (expenseData) => {
  // Save to backend
  console.log('Saving:', expenseData)
}
</script>

<style scoped>
.actions {
  display: flex;
  gap: 8px;
}

.btn-scan {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.scan-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.scan-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 16px;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.scan-option:hover,
.scan-option:active {
  background: #e9ecef;
  border-color: #667eea;
  transform: scale(0.98);
}

.scan-option .icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.scan-option .label {
  font-size: 16px;
  font-weight: 600;
  color: #212529;
  margin-bottom: 4px;
}

.scan-option .desc {
  font-size: 13px;
  color: #6c757d;
}
</style>
```

---

## 📱 Visual Flow

```
┌─────────────────────────────────────────┐
│         EXPENSES PAGE                    │
│                                          │
│  [➕ Add Expense]  [📷 Scan Receipt]    │
│                                          │
│  User taps "Scan Receipt"                │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│     ACTION SHEET (Bottom Modal)          │
│  ┌───────────────────────────────────┐  │
│  │  Scan Receipt                     │  │
│  ├───────────────────────────────────┤  │
│  │                                   │  │
│  │  📷 Take Photo                    │  │
│  │  Use camera to capture receipt    │  │
│  │                                   │  │
│  ├───────────────────────────────────┤  │
│  │                                   │  │
│  │  🖼️ Choose from Gallery           │  │
│  │  Select existing photo            │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
└─────────────┬───────────────────────────┘
              │
              ├─────────────────────┬───────────────────┐
              │                     │                   │
         [Take Photo]      [Choose from Gallery]       │
              │                     │                   │
              ▼                     ▼                   │
    ┌──────────────────┐  ┌──────────────────┐         │
    │  CAMERA VIEW     │  │  GALLERY PICKER  │         │
    │  ┌────────────┐  │  │  ┌────────────┐  │         │
    │  │ Receipt    │  │  │  │ Photo 1    │  │         │
    │  │ Preview    │  │  │  │ Photo 2    │  │         │
    │  │            │  │  │  │ Photo 3    │  │         │
    │  └────────────┘  │  │  └────────────┘  │         │
    │  [Capture] ───┐  │  │  [Select] ────┐  │         │
    └───────────────┼──┘  └───────────────┼──┘         │
                    │                     │             │
                    └──────────┬──────────┘             │
                               │                        │
                               ▼                        │
                     ┌──────────────────┐               │
                     │  ⏳ PROCESSING   │               │
                     │  Scanning...     │               │
                     │  [====    ] 60%  │               │
                     └─────────┬────────┘               │
                               │                        │
                               ▼                        │
                     ┌──────────────────────────────┐   │
                     │  REVIEW SCANNED DATA         │   │
                     │                              │   │
                     │  Category: 🛒 Groceries      │   │
                     │  Merchant: SM Supermarket    │   │
                     │  Total: ₱1,234.50           │   │
                     │                              │   │
                     │  Items (12):                 │   │
                     │  ☑️ 1x Toyo          ₱45     │   │
                     │  ☑️ 2x Oil           ₱180    │   │
                     │  ☑️ 1x Asin          ₱35     │   │
                     │  ...                         │   │
                     │                              │   │
                     │  [Cancel]  [Save Expense]    │   │
                     └──────────────────────────────┘   │
                                                        │
                    Saved! ✅                           │
                                                        │
└───────────────────────────────────────────────────────┘
```

---

## 🔧 Key Implementation: File Input Attributes

### The Magic `<input>` Tag

```html
<input
  ref="fileInput"
  type="file"
  accept="image/*"
  :capture="captureMode"
  @change="handleImageSelect"
  style="display: none"
/>
```

### How It Works

**For Camera Capture:**
```javascript
captureMode.value = 'environment'  // Back camera
fileInput.value.click()
// ↓ Opens native camera on mobile
// ↓ User takes photo
// ↓ Triggers @change event with captured file
```

**For Gallery Upload:**
```javascript
captureMode.value = null  // No capture attribute
fileInput.value.click()
// ↓ Opens native gallery picker on mobile
// ↓ User selects existing photo
// ↓ Triggers @change event with selected file
```

### Browser Behavior

| Device | `capture="environment"` | No `capture` |
|--------|------------------------|--------------|
| **Android** | Opens camera app | Opens file picker |
| **iOS** | Shows "Take Photo or Video" + "Photo Library" | Opens photo picker |
| **Desktop** | Opens file picker (no camera) | Opens file picker |

---

## 💡 iOS Specific Behavior

On iOS, when you use `capture` attribute, you get a native action sheet:

```
┌────────────────────────────┐
│  Take Photo or Video       │  ← Opens camera
│  Photo Library             │  ← Opens gallery
│  Cancel                    │
└────────────────────────────┘
```

This is perfect! Users get both options even with `capture="environment"` on iOS.

---

## 🎨 Action Sheet Component

```vue
<!-- components/ActionSheet.vue -->
<template>
  <Teleport to="body">
    <Transition name="action-sheet">
      <div v-if="show" class="action-sheet-overlay" @click="close">
        <div class="action-sheet" @click.stop>
          <div class="action-sheet-header">
            <h3>{{ title }}</h3>
            <button @click="close" class="close-btn">✕</button>
          </div>
          <div class="action-sheet-content">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  show: Boolean,
  title: String
})

const emit = defineEmits(['update:show'])

const close = () => {
  emit('update:show', false)
}
</script>

<style scoped>
.action-sheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 9999;
}

.action-sheet {
  background: white;
  border-radius: 24px 24px 0 0;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
}

.action-sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.action-sheet-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
}

.action-sheet-content {
  padding-bottom: env(safe-area-inset-bottom);
}

/* Slide up animation */
.action-sheet-enter-active,
.action-sheet-leave-active {
  transition: all 0.3s ease;
}

.action-sheet-enter-from .action-sheet,
.action-sheet-leave-to .action-sheet {
  transform: translateY(100%);
}

.action-sheet-enter-from,
.action-sheet-leave-to {
  opacity: 0;
}
</style>
```

---

## 📊 Scanning Progress Modal

```vue
<!-- components/ScanningModal.vue -->
<template>
  <div class="scanning-modal">
    <div class="scanning-content">
      <div class="spinner">⏳</div>
      <h3>{{ statusText }}</h3>
      <div class="progress-bar">
        <div class="progress" :style="{ width: progress + '%' }"></div>
      </div>
      <p class="progress-text">{{ Math.round(progress) }}%</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  progress: Number,
  status: String
})

const statusText = computed(() => {
  switch (props.status) {
    case 'preprocessing': return 'Enhancing image...'
    case 'recognizing': return 'Reading receipt...'
    case 'parsing': return 'Extracting items...'
    case 'complete': return 'Done!'
    default: return 'Processing...'
  }
})
</script>

<style scoped>
.scanning-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.scanning-content {
  background: white;
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  max-width: 300px;
}

.spinner {
  font-size: 64px;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  margin: 16px 0;
  overflow: hidden;
}

.progress {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
}

.progress-text {
  color: #6c757d;
  font-size: 14px;
  margin: 8px 0 0;
}
</style>
```

---

## 🔄 Complete Flow Code

```javascript
// composables/useReceiptScanner.js
import { ref } from 'vue'
import { ReceiptOCR } from '@/utils/receiptOCR'

export function useReceiptScanner() {
  const isScanning = ref(false)
  const scanProgress = ref(0)
  const scanStatus = ref('')
  const scannedData = ref(null)
  const error = ref(null)
  
  const ocr = new ReceiptOCR()
  
  const scanReceipt = async (imageFile) => {
    isScanning.value = true
    scanProgress.value = 0
    scanStatus.value = 'preprocessing'
    error.value = null
    scannedData.value = null
    
    try {
      // Scan the receipt (from camera OR gallery)
      const result = await ocr.scanReceipt(imageFile, (progress) => {
        scanProgress.value = progress.progress * 100
        scanStatus.value = progress.status
      })
      
      if (result.success) {
        // Store scanned data for review
        scannedData.value = {
          merchantName: result.merchantName,
          date: result.date,
          total: result.total,
          items: result.items,
          itemCount: result.itemCount,
          category: autoDetectCategory(result),
          rawImage: imageFile  // Store original image
        }
        
        return result
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      error.value = err.message
      console.error('Scan failed:', err)
    } finally {
      isScanning.value = false
    }
  }
  
  const autoDetectCategory = (result) => {
    const merchant = result.merchantName.toLowerCase()
    const items = result.items.map(i => i.itemName.toLowerCase()).join(' ')
    
    // Simple category detection
    if (merchant.includes('supermarket') || merchant.includes('grocery')) {
      return 'Groceries'
    }
    if (merchant.includes('jollibee') || merchant.includes('mcdonald')) {
      return 'Restaurant'
    }
    if (items.includes('gas') || items.includes('fuel')) {
      return 'Transportation'
    }
    
    return 'Shopping'  // Default
  }
  
  return {
    isScanning,
    scanProgress,
    scanStatus,
    scannedData,
    error,
    scanReceipt
  }
}
```

---

## 📱 Mobile Native Experience

### Android

**With `capture="environment"`:**
```
User taps button
  ↓
Camera app opens
  ↓
User captures photo
  ↓
Returns to app with image
```

**Without `capture` (gallery):**
```
User taps button
  ↓
File picker opens
  ↓
User selects photo
  ↓
Returns to app with image
```

### iOS

**With `capture="environment"`:**
```
User taps button
  ↓
Action sheet appears:
  • Take Photo or Video
  • Photo Library
  • Cancel
  ↓
User chooses option
  ↓
Returns to app with image
```

**Without `capture` (gallery):**
```
User taps button
  ↓
Photo picker opens directly
  ↓
User selects photo
  ↓
Returns to app with image
```

---

## ✨ Summary

Your implementation supports **BOTH**:

1. **📷 Take Photo** - Opens camera, captures new photo
2. **🖼️ Upload from Gallery** - Opens file picker, selects existing photo

**Same processing** for both:
- Image preprocessing
- OCR with Tesseract.js
- Parse receipt data
- Show review screen
- Save to backend

**One simple input:**
```html
<input type="file" accept="image/*" :capture="captureMode" />
```

Change `captureMode` to control behavior! 🎉
