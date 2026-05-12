<script setup>
import { ref, onMounted } from 'vue'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useFilesStore } from '@/stores/files.js'
import { Upload, Trash2, ExternalLink, FileText, Loader2 } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiCard from '@/components/ui/Card.vue'
import imageCompression from 'browser-image-compression'

const store = useFilesStore()
onMounted(() => store.fetchAll())
useRegisterAddAction(() => fileInput.value?.click())

const fileInput = ref(null)
const compressionStatus = ref('')

async function handleUpload(e) {
  let file = e.target.files[0]
  if (!file) return

  // Compress if it's an image
  if (file.type.startsWith('image/')) {
    compressionStatus.value = 'Compressing image...'
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    }
    try {
      const compressedFile = await imageCompression(file, options)
      file = compressedFile
    } catch (err) {
      console.error('Compression error:', err)
    } finally {
      compressionStatus.value = ''
    }
  }

  const formData = new FormData()
  formData.append('file', file)
  try {
    await store.upload(formData)
  } catch (err) {
    console.error(err)
  }
  e.target.value = ''
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-6xl mx-auto animate-fade-in">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Files</h1>
        <p class="text-sm text-muted-foreground mt-1">{{ store.files.length }} file{{ store.files.length !== 1 ? 's' : '' }} stored on Google Drive</p>
      </div>
      <UiButton @click="fileInput.click()" :disabled="store.uploading || !!compressionStatus" class="hidden sm:flex">
        <Loader2 v-if="store.uploading || compressionStatus" class="h-4 w-4 animate-spin" />
        <Upload v-else class="h-4 w-4" />
        {{ compressionStatus || (store.uploading ? `Uploading ${store.uploadProgress}%` : 'Upload File') }}
      </UiButton>
      <input ref="fileInput" type="file" class="hidden" @change="handleUpload" />
    </div>

    <!-- Upload progress banner -->
    <div v-if="store.uploading || compressionStatus" class="mb-6 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div class="p-4">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <div class="rounded-full bg-primary/10 p-1.5">
              <Upload v-if="!compressionStatus" class="h-4 w-4 text-primary animate-bounce" />
              <Loader2 v-else class="h-4 w-4 text-primary animate-spin" />
            </div>
            <span class="text-sm font-semibold">
              {{ compressionStatus || 'Uploading file...' }}
            </span>
          </div>
          <span v-if="!compressionStatus" class="text-xs font-medium text-muted-foreground">{{ store.uploadProgress }}%</span>
        </div>
        <div v-if="!compressionStatus" class="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div 
            class="h-full bg-primary transition-all duration-300 ease-out" 
            :style="{ width: `${store.uploadProgress}%` }"
          />
        </div>
        <p v-else class="text-xs text-muted-foreground">Preparing your file for storage...</p>
      </div>
    </div>

    <div v-if="store.error" class="mb-4 p-4 rounded-xl bg-destructive/10 text-destructive text-sm font-medium">
      {{ store.error }}
    </div>

    <div v-if="store.loading" class="text-sm text-muted-foreground">Loading…</div>

    <div v-else-if="store.files.length === 0" class="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed bg-muted/20">
      <Upload class="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p class="text-sm text-muted-foreground">No files uploaded yet.</p>
      <p class="text-xs text-muted-foreground/60 mt-1">Upload files to store them on Google Drive</p>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <UiCard
        v-for="file in store.files"
        :key="file.id"
        class="flex flex-col gap-0 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start gap-3 p-4 pb-3">
          <div class="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <FileText class="h-5 w-5 text-primary" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">{{ file.file_name }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ formatSize(file.size) }}</p>
          </div>
        </div>

        <div class="flex gap-2 px-4 pb-4 mt-auto">
          <a
            :href="file.drive_link"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ExternalLink class="h-3 w-3" /> View
          </a>
          <UiButton variant="ghost" size="icon" class="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" @click="store.remove(file.id)">
            <Trash2 class="h-3.5 w-3.5" />
          </UiButton>
        </div>
      </UiCard>
    </div>
  </div>
</template>
