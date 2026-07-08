<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { Camera, Upload, X, Check, Edit3, Trash2, RotateCw } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import DatePicker from '@/components/ui/DatePicker.vue'
import { useReceiptScanner } from '@/composables/useReceiptScanner'

const props = defineProps({
  show: Boolean
})

const emit = defineEmits(['close', 'scanned'])

const { isScanning, scanProgress, scanStatus, scannedData, error, scanReceipt, cleanup } = useReceiptScanner()

// Cleanup on unmount
onUnmounted(() => {
  cleanup()
})

const fileInput = ref(null)
const captureMode = ref(null)
const showScannedData = ref(false)
const errorMessage = ref(null)

// 4A: Image preview state
const modalStep = ref('idle') // 'idle' | 'preview' | 'scanning' | 'results'
const previewImage = ref(null)
const selectedFile = ref(null)
const currentRotation = ref(0) // Track rotation angle (0, 90, 180, 270)

// Status text mapping
const statusText = computed(() => {
  switch (scanStatus.value) {
    case 'preprocessing':
      return 'Scanning image...'
    case 'recognizing':
      return 'Reading receipt...'
    case 'parsing':
      return 'Extracting items...'
    case 'complete':
      return 'Done!'
    default:
      return 'Processing...'
  }
})

// 4B: Confidence badge
const confidenceBadge = computed(() => {
  if (!scannedData.value?.confidence) return null
  
  const conf = scannedData.value.confidence
  
  if (conf >= 75) {
    return { label: 'High quality', color: 'emerald', bgClass: 'bg-emerald-100 dark:bg-emerald-950/30', textClass: 'text-emerald-700 dark:text-emerald-300' }
  } else if (conf >= 50) {
    return { label: 'Review items', color: 'amber', bgClass: 'bg-amber-100 dark:bg-amber-950/30', textClass: 'text-amber-700 dark:text-amber-300' }
  } else {
    return { label: 'Low quality — please verify', color: 'red', bgClass: 'bg-red-100 dark:bg-red-950/30', textClass: 'text-red-700 dark:text-red-300' }
  }
})

// Open camera
const openCamera = () => {
  captureMode.value = 'environment'
  fileInput.value.click()
}

// Open gallery
const openGallery = () => {
  captureMode.value = null
  fileInput.value.click()
}

// Handle image selection - show preview
const handleImageSelect = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  // Validate file type (reject HEIC and other unsupported formats)
  const supported = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/gif']
  if (!supported.includes(file.type.toLowerCase())) {
    errorMessage.value = 'Unsupported file type. Please use a JPEG or PNG photo.'
    modalStep.value = 'idle'
    event.target.value = '' // Reset input
    return
  }
  
  errorMessage.value = null
  selectedFile.value = file
  currentRotation.value = 0 // Reset rotation
  
  // Create preview URL
  previewImage.value = URL.createObjectURL(file)
  modalStep.value = 'preview'
  
  event.target.value = '' // Reset input
}

// Rotate preview image
const rotatePreview = (degrees) => {
  currentRotation.value = (currentRotation.value + degrees + 360) % 360
  console.log(`[Preview] Rotated to ${currentRotation.value}°`)
}

// Apply rotation to canvas and return as blob
const getRotatedImageBlob = async () => {
  if (currentRotation.value === 0) {
    return selectedFile.value // No rotation needed
  }
  
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      // Calculate new dimensions
      if (currentRotation.value === 90 || currentRotation.value === 270) {
        canvas.width = img.height
        canvas.height = img.width
      } else {
        canvas.width = img.width
        canvas.height = img.height
      }
      
      // Apply rotation
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((currentRotation.value * Math.PI) / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      ctx.restore()
      
      // Convert to blob
      canvas.toBlob((blob) => {
        resolve(new File([blob], selectedFile.value.name, { type: selectedFile.value.type }))
      }, selectedFile.value.type)
    }
    img.src = previewImage.value
  })
}

// Start scanning the previewed image
const startScan = async () => {
  if (!selectedFile.value) return
  
  modalStep.value = 'scanning'
  errorMessage.value = null // Clear previous errors
  
  try {
    // Apply rotation if user rotated the preview
    const fileToScan = await getRotatedImageBlob()
    await scanReceipt(fileToScan)
    modalStep.value = 'results'
    showScannedData.value = true
  } catch (err) {
    console.error('Scan failed:', err)
    errorMessage.value = err.message || 'Failed to scan receipt. Please try again with a clearer image.'
    modalStep.value = 'scanning' // Keep in scanning state to show error overlay
  }
}

// Retake/choose different image
const retakeImage = () => {
  if (previewImage.value) {
    URL.revokeObjectURL(previewImage.value)
  }
  previewImage.value = null
  selectedFile.value = null
  currentRotation.value = 0
  modalStep.value = 'idle'
}

// Use scanned data
const useScannedData = () => {
  emit('scanned', scannedData.value)
  handleClose()
}

// Close modal
const handleClose = () => {
  // Cleanup preview URL
  if (previewImage.value) {
    URL.revokeObjectURL(previewImage.value)
  }
  previewImage.value = null
  selectedFile.value = null
  modalStep.value = 'idle'
  showScannedData.value = false
  errorMessage.value = null
  emit('close')
}

// Remove item from scanned list
const removeItem = (index) => {
  scannedData.value.items.splice(index, 1)
  // Recalculate subtotals
  scannedData.value.itemsSubtotal = scannedData.value.items.reduce((sum, item) => sum + item.subtotal, 0)
  scannedData.value.total = scannedData.value.itemsSubtotal + scannedData.value.feesSubtotal
  scannedData.value.itemCount = scannedData.value.items.length
}

// Remove fee from scanned list
const removeFee = (index) => {
  scannedData.value.fees.splice(index, 1)
  // Recalculate subtotals
  scannedData.value.feesSubtotal = scannedData.value.fees.reduce((sum, fee) => sum + fee.subtotal, 0)
  scannedData.value.total = scannedData.value.itemsSubtotal + scannedData.value.feesSubtotal
  scannedData.value.feeCount = scannedData.value.fees.length
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4 animate-in fade-in duration-200"
      @mousedown.self="handleClose"
    >
      <!-- Hidden file input -->
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
        :capture="captureMode"
        @change="handleImageSelect"
        style="display: none"
      />

      <!-- Scanning Options (Initial State) -->
      <UiCard
        v-if="modalStep === 'idle'"
        class="flex w-full max-w-none flex-col overflow-hidden bg-background shadow-2xl border-0
          max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300
          sm:animate-in sm:zoom-in-95 sm:duration-200
          max-sm:h-auto max-sm:max-h-[85dvh] max-sm:rounded-t-3xl max-sm:rounded-b-none
          sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl"
        @mousedown.stop
      >
        <div class="relative shrink-0 pt-8 pb-6 flex flex-col items-center">
          <UiButton
            type="button"
            variant="ghost"
            size="icon"
            @click="handleClose"
            class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors"
          >
            <X class="h-5 w-5 text-muted-foreground" />
          </UiButton>

          <div class="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 mb-3 shadow-lg">
            <Camera class="h-7 w-7 text-white" />
          </div>

          <h2 class="text-xl font-bold text-foreground mb-1">Scan Receipt</h2>
          <p class="text-sm text-muted-foreground text-center px-4">
            Capture or upload your receipt to automatically extract items
          </p>
        </div>

        <div class="flex flex-col gap-3 p-6">
          <!-- Camera option -->
          <button
            @click="openCamera"
            class="group relative overflow-hidden flex items-center gap-4 p-5 bg-gradient-to-br from-card to-muted/30 border-2 border-border hover:border-primary rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          >
            <div class="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <Camera class="h-6 w-6 text-primary" />
            </div>
            <div class="flex-1 text-left">
              <div class="text-base font-bold text-foreground mb-0.5">Take Photo</div>
              <div class="text-sm text-muted-foreground">Use camera to capture receipt</div>
            </div>
          </button>

          <!-- Gallery option -->
          <button
            @click="openGallery"
            class="group relative overflow-hidden flex items-center gap-4 p-5 bg-gradient-to-br from-card to-muted/30 border-2 border-border hover:border-primary rounded-2xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          >
            <div class="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <Upload class="h-6 w-6 text-primary" />
            </div>
            <div class="flex-1 text-left">
              <div class="text-base font-bold text-foreground mb-0.5">Choose from Gallery</div>
              <div class="text-sm text-muted-foreground">Select existing photo</div>
            </div>
          </button>
        </div>

        <div class="p-6 pt-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div class="bg-muted/50 rounded-xl p-4">
            <p class="text-xs text-muted-foreground text-center">
              💡 <strong>Tip:</strong> For best results, ensure good lighting and hold phone parallel to receipt
            </p>
          </div>
        </div>
      </UiCard>

      <!-- Error Display -->
      <UiCard
        v-if="errorMessage && (modalStep === 'idle' || modalStep === 'scanning')"
        class="flex w-full max-w-none flex-col overflow-hidden bg-background shadow-2xl border-0
          max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300
          sm:animate-in sm:zoom-in-95 sm:duration-200
          max-sm:h-auto max-sm:max-h-[85dvh] max-sm:rounded-t-3xl max-sm:rounded-b-none
          sm:max-h-[90vh] sm:max-w-md sm:rounded-3xl"
        @mousedown.stop
      >
        <div class="relative shrink-0 pt-8 pb-6 flex flex-col items-center">
          <UiButton
            type="button"
            variant="ghost"
            size="icon"
            @click="handleClose"
            class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors"
          >
            <X class="h-5 w-5 text-muted-foreground" />
          </UiButton>

          <div class="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 mb-3">
            <X class="h-7 w-7 text-red-600" />
          </div>

          <h2 class="text-xl font-bold text-foreground mb-1">Scan Failed</h2>
          <p class="text-sm text-muted-foreground text-center px-6 mb-6">
            {{ errorMessage }}
          </p>
        </div>

        <div class="p-6 pt-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <UiButton
            type="button"
            class="w-full font-semibold h-12"
            @click="errorMessage = null"
          >
            Try Again
          </UiButton>
          
          <div class="mt-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800/30">
            <p class="text-xs text-amber-800 dark:text-amber-200 mb-2 font-semibold">💡 Tips for better results:</p>
            <ul class="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
              <li>Ensure good lighting</li>
              <li>Hold phone parallel to receipt</li>
              <li>Make sure text is clearly visible</li>
              <li>Avoid shadows and glare</li>
            </ul>
          </div>
        </div>
      </UiCard>

      <!-- Image Preview State (NEW - 4A) -->
      <UiCard
        v-if="modalStep === 'preview' && previewImage"
        class="flex w-full max-w-none flex-col overflow-hidden bg-background shadow-2xl border-0
          max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300
          sm:animate-in sm:zoom-in-95 sm:duration-200
          max-sm:h-auto max-sm:max-h-[85dvh] max-sm:rounded-t-3xl max-sm:rounded-b-none
          sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl"
        @mousedown.stop
      >
        <div class="relative shrink-0 pt-8 pb-6 px-6 border-b border-border">
          <UiButton
            type="button"
            variant="ghost"
            size="icon"
            @click="handleClose"
            class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors"
          >
            <X class="h-5 w-5 text-muted-foreground" />
          </UiButton>

          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
              <Camera class="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 class="text-lg font-bold text-foreground">Review Image</h2>
              <p class="text-sm text-muted-foreground">Rotate if needed, then scan</p>
            </div>
          </div>
        </div>

        <!-- Image Preview with Rotation -->
        <div class="flex-1 overflow-y-auto px-1 py-2 sm:px-2 sm:py-4">
          <div class="flex flex-col items-center gap-4 max-w-4xl mx-auto">
            <!-- Square container that provides consistent space for rotation -->
            <div class="relative bg-muted/30 rounded-xl w-full" style="max-width: 700px; aspect-ratio: 1/1;">
              <!-- Centering wrapper with extra bottom padding for controls -->
              <div class="absolute inset-0 flex items-center justify-center p-2 pb-12">
                <img 
                  :src="previewImage" 
                  alt="Receipt preview" 
                  class="max-w-full max-h-full object-contain transition-transform duration-300"
                  :style="{ transform: `rotate(${currentRotation}deg)` }"
                />
              </div>
              
              <!-- Rotation Controls Overlay - Compact -->
              <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg z-10">
                <button
                  @click="rotatePreview(-90)"
                  class="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  title="Rotate left"
                >
                  <RotateCw class="h-4 w-4 text-white transform -scale-x-100" />
                </button>
                <span class="text-white text-xs font-medium min-w-[2.5rem] text-center">{{ currentRotation }}°</span>
                <button
                  @click="rotatePreview(90)"
                  class="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  title="Rotate right"
                >
                  <RotateCw class="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
            
            <!-- Rotation Hint -->
            <div class="w-full bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800/30">
              <p class="text-xs text-blue-800 dark:text-blue-200 text-center">
                💡 <strong>Tip:</strong> Text should read normally (not sideways or upside down)
              </p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="shrink-0 p-6 bg-background border-t border-border flex items-center gap-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <UiButton
            type="button"
            variant="secondary"
            class="flex-1 font-semibold h-12"
            @click="retakeImage"
          >
            Retake
          </UiButton>
          <UiButton
            type="button"
            class="flex-1 font-bold h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            @click="startScan"
          >
            Scan Receipt
          </UiButton>
        </div>
      </UiCard>

      <!-- Scanning Progress -->
      <UiCard
        v-if="modalStep === 'scanning' && !errorMessage"
        class="flex w-full max-w-none flex-col items-center justify-center overflow-hidden bg-background shadow-2xl border-0 p-12
          max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300
          sm:animate-in sm:zoom-in-95 sm:duration-200
          max-sm:h-auto max-sm:rounded-t-3xl max-sm:rounded-b-none
          sm:max-w-md sm:rounded-3xl"
        @mousedown.stop
      >
        <div class="h-20 w-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-6 animate-pulse">
          <Camera class="h-10 w-10 text-white" />
        </div>

        <h3 class="text-xl font-bold text-foreground mb-2">{{ statusText }}</h3>

        <div class="w-full max-w-xs mt-4">
          <div class="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-300 ease-out"
              :style="{ width: scanProgress + '%' }"
            />
          </div>
          <p class="text-sm text-muted-foreground text-center mt-3">{{ Math.round(scanProgress) }}%</p>
        </div>
      </UiCard>

      <!-- Scanned Data Review - FULL SCREEN -->
      <UiCard
        v-if="modalStep === 'results' && scannedData"
        class="flex w-full h-full flex-col overflow-hidden bg-background shadow-2xl border-0
          animate-in fade-in duration-200
          max-sm:rounded-none
          sm:max-w-2xl sm:max-h-[90vh] sm:rounded-3xl"
        @mousedown.stop
      >
        <!-- Header -->
        <div class="relative shrink-0 pt-8 pb-5 px-6 border-b border-border">
          <UiButton
            type="button"
            variant="ghost"
            size="icon"
            @click="handleClose"
            class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors"
          >
            <X class="h-5 w-5 text-muted-foreground" />
          </UiButton>

          <div class="flex items-center gap-3 mb-3">
            <div class="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Check class="h-5 w-5 text-emerald-600" />
            </div>
            <div class="flex-1">
              <h2 class="text-lg font-bold text-foreground">Scanned Successfully!</h2>
              <p class="text-sm text-muted-foreground">Review and edit items before saving</p>
            </div>
          </div>
          
          <!-- 4B: Confidence Badge -->
          <div v-if="confidenceBadge" class="mt-3">
            <span 
              :class="[confidenceBadge.bgClass, confidenceBadge.textClass]"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="`bg-${confidenceBadge.color}-600`"></span>
              {{ confidenceBadge.label }}
            </span>
          </div>
        </div>

        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- Receipt Card -->
          <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
            <!-- Receipt Header -->
            <div class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-6 border-b-2 border-dashed border-slate-300 dark:border-slate-600">
              <div class="text-center mb-4">
                <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">{{ scannedData.merchantName }}</h2>
                <p class="text-sm text-slate-600 dark:text-slate-400">{{ scannedData.date }}</p>
              </div>
            </div>

            <!-- Receipt Body -->
            <div class="p-6 space-y-6">
              <!-- Items Section -->
              <div>
                <div class="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Items ({{ scannedData.itemCount }})</h3>
                  <span class="text-xs text-slate-400 dark:text-slate-500">Tap to remove</span>
                </div>
                
                <div class="space-y-3">
                  <div
                    v-for="(item, index) in scannedData.items"
                    :key="'item-' + index"
                    class="group relative"
                  >
                    <div class="flex items-start justify-between gap-4 font-mono text-sm">
                      <div class="flex-1">
                        <div class="font-semibold text-slate-900 dark:text-slate-100 leading-tight">{{ item.itemName }}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ item.quantity }}x @ ₱{{ item.unitPrice.toFixed(2) }}</div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="font-bold text-slate-900 dark:text-slate-100 tabular-nums">₱{{ item.subtotal.toFixed(2) }}</span>
                        <button
                          @click="removeItem(index)"
                          class="opacity-60 hover:opacity-100 h-6 w-6 rounded-md bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 flex items-center justify-center transition-all"
                        >
                          <Trash2 class="h-3 w-3 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Items Subtotal (shown only if fees exist) -->
                <div v-if="scannedData.fees && scannedData.fees.length > 0" class="mt-4 pt-3 border-t border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-between font-mono text-sm">
                  <span class="text-slate-600 dark:text-slate-400 font-medium">Subtotal</span>
                  <span class="font-bold text-slate-900 dark:text-slate-100 tabular-nums">₱{{ scannedData.itemsSubtotal.toFixed(2) }}</span>
                </div>
              </div>

              <!-- Other Charges Section (if any) -->
              <div v-if="scannedData.fees && scannedData.fees.length > 0" class="pt-4 border-t border-slate-200 dark:border-slate-700">
                <div class="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <h3 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Other Charges ({{ scannedData.feeCount }})</h3>
                  <span class="text-xs text-amber-600 dark:text-amber-400">Tax, Service, Fees</span>
                </div>
                
                <div class="space-y-3">
                  <div
                    v-for="(fee, index) in scannedData.fees"
                    :key="'fee-' + index"
                    class="group relative p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800/30"
                  >
                    <div class="flex items-start justify-between gap-4 font-mono text-sm">
                      <div class="flex-1">
                        <div class="font-semibold text-slate-900 dark:text-slate-100 leading-tight">{{ fee.itemName }}</div>
                        <div class="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Additional charge</div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="font-bold text-slate-900 dark:text-slate-100 tabular-nums">₱{{ fee.subtotal.toFixed(2) }}</span>
                        <button
                          @click="removeFee(index)"
                          class="opacity-60 hover:opacity-100 h-6 w-6 rounded-md bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 flex items-center justify-center transition-all"
                        >
                          <Trash2 class="h-3 w-3 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Total -->
              <div class="pt-4 border-t-2 border-slate-900 dark:border-slate-100">
                <div class="flex items-center justify-between font-mono">
                  <span class="text-lg font-bold text-slate-900 dark:text-slate-100 uppercase">Total</span>
                  <span class="text-2xl font-black text-slate-900 dark:text-slate-100 tabular-nums">₱{{ scannedData.total.toFixed(2) }}</span>
                </div>
              </div>
            </div>

            <!-- Receipt Footer -->
            <div class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4 border-t-2 border-dashed border-slate-300 dark:border-slate-600">
              <p class="text-center text-xs text-slate-500 dark:text-slate-400">
                Review items before saving to your expenses
              </p>
            </div>
          </div>
        </div>

        <!-- Total Warning (if any) -->
        <div v-if="scannedData.totalWarning" class="shrink-0 px-6 pb-4">
          <div class="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800/30">
            <p class="text-sm text-amber-800 dark:text-amber-200 font-medium">
              ⚠️ {{ scannedData.totalWarning }}
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="shrink-0 p-6 pt-0 bg-background border-t border-border flex items-center gap-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <UiButton
            type="button"
            variant="secondary"
            class="flex-1 font-semibold h-12"
            @click="handleClose"
          >
            Cancel
          </UiButton>
          <UiButton
            type="button"
            class="flex-1 font-bold h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            @click="useScannedData"
          >
            Save
          </UiButton>
        </div>
      </UiCard>
    </div>
  </Teleport>
</template>
