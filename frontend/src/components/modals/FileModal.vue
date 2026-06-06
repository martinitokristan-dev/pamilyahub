<script setup>
import { ref, watch } from 'vue'
import { useFilesStore } from '@/stores/files.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import { Upload, Loader2 } from 'lucide-vue-next'
import imageCompression from 'browser-image-compression'
import { shouldFetchFromServer } from '@/lib/syncEngine.js'

const props = defineProps({
  show: Boolean,
  defaultAlbum: { type: String, default: '' }
})

const emit = defineEmits(['close'])

const store = useFilesStore()
const dashboardStore = useDashboardStore()

const fileInput = ref(null)
const uploadAlbumName = ref('')
const compressionStatus = ref('')

watch(() => props.show, (val) => {
  if (val) {
    uploadAlbumName.value = props.defaultAlbum || ''
    compressionStatus.value = ''
  }
})

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleUpload(e) {
  const selectedFiles = Array.from(e.target.files)
  if (!selectedFiles.length) return

  // Close the modal but keep uploading in the background
  emit('close')
  
  // Limit to 10 files at once
  const filesToUpload = selectedFiles.slice(0, 10)

  for (let i = 0; i < filesToUpload.length; i++) {
    let file = filesToUpload[i]
    
    // Compress if it's an image
    if (file.type.startsWith('image/')) {
      compressionStatus.value = `Compressing file ${i + 1} of ${filesToUpload.length}...`
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      }
      try {
        const compressedFile = await imageCompression(file, options)
        file = new File([compressedFile], file.name, { type: compressedFile.type })
      } catch (err) {
        console.error('Compression error:', err)
      } finally {
        compressionStatus.value = ''
      }
    }

    const formData = new FormData()
    formData.append('file', file)
    if (uploadAlbumName.value) {
      formData.append('album_name', uploadAlbumName.value)
    }
    
    try {
      await store.upload(formData)
    } catch (err) {
      console.error('Upload failed for file:', file.name, err)
    }
  }
  
  e.target.value = ''
  
  if (shouldFetchFromServer()) {
    dashboardStore.fetchStats()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200" @mousedown.self="emit('close')">
      <UiCard class="w-full sm:max-w-md shadow-xl
        max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300
        sm:animate-in sm:zoom-in-95 sm:duration-200
        max-sm:rounded-b-none max-sm:rounded-t-2xl sm:rounded-2xl p-5" @mousedown.stop>
        <h2 class="text-lg font-semibold mb-4">Upload Files</h2>
        <div class="space-y-4">
          <div>
            <UiLabel>Album Name (Optional)</UiLabel>
            <UiInput v-model="uploadAlbumName" placeholder="e.g. Vacation 2026, Receipts..." class="mt-1" autofocus />
            <p class="text-[11px] text-muted-foreground mt-1.5">Leave empty to keep files uncategorized.</p>
          </div>
          
          <!-- Hidden input -->
          <input ref="fileInput" type="file" multiple class="hidden" @change="handleUpload" />
          
          <div class="flex justify-end gap-2 mt-6">
            <UiButton variant="ghost" @click="emit('close')">Cancel</UiButton>
            <UiButton @click="triggerFileInput" :disabled="store.uploading || !!compressionStatus">
              <Loader2 v-if="store.uploading || compressionStatus" class="h-4 w-4 animate-spin mr-2" />
              <Upload v-else class="h-4 w-4 mr-2" />
              Select Files
            </UiButton>
          </div>
        </div>
      </UiCard>
    </div>
  </Teleport>
</template>
