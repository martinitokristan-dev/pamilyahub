<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useFilesStore } from '@/stores/files.js'
import { Upload, Trash2, ExternalLink, FileText, Loader2, FolderOpen, ArrowLeft, ChevronLeft, ChevronRight, WifiOff } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiCard from '@/components/ui/Card.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import { SkeletonGrid } from '@/components/skeletons'
import imageCompression from 'browser-image-compression'

const store = useFilesStore()
const currentPage = ref(1)
const isOffline = ref(!navigator.onLine)

// Listen for online/offline changes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => isOffline.value = false)
  window.addEventListener('offline', () => isOffline.value = true)
}

onMounted(() => {
  if (!isOffline.value) store.fetchAll(false, currentPage.value)
})

watch(currentPage, (val) => {
  if (!isOffline.value) store.fetchAll(false, val)
  window.scrollTo({ top: 0, behavior: 'smooth' })
})

const showUploadModal = ref(false)
const activeAlbum = ref(null)

useRegisterAddAction(() => { 
  if (activeAlbum.value) {
    uploadAlbumName.value = activeAlbum.value
    fileInput.value?.click()
  } else {
    uploadAlbumName.value = ''
    showUploadModal.value = true 
  }
})

const fileInput = ref(null)
const compressionStatus = ref('')
const uploadAlbumName = ref('')

const albums = computed(() => {
  const groups = {}
  store.files.forEach(f => {
    const name = f.album_name || 'Uncategorized'
    if (!groups[name]) groups[name] = []
    groups[name].push(f)
  })
  return groups
})

function triggerFileInput() {
  showUploadModal.value = false
  fileInput.value?.click()
}

async function handleUpload(e) {
  const selectedFiles = Array.from(e.target.files)
  if (!selectedFiles.length) return
  
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
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-6xl mx-auto animate-fade-in">
    <!-- Offline Message -->
    <div v-if="isOffline" class="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
      <div class="flex items-center gap-3">
        <div class="rounded-full bg-amber-100 dark:bg-amber-900/30 p-2">
          <WifiOff class="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">Files are not available offline</p>
          <p class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">Please connect to the internet to access your files</p>
        </div>
      </div>
    </div>

    <div v-else>
      <div class="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div class="space-y-1">
          <h1 class="text-[32px] sm:text-[40px] font-black tracking-tight text-foreground leading-none">Files & Albums</h1>
          <p class="text-sm font-medium text-muted-foreground">{{ store.files.length }} file{{ store.files.length !== 1 ? 's' : '' }} stored securely</p>
        </div>
        <UiButton @click="showUploadModal = true" :disabled="store.uploading || !!compressionStatus" class="hidden sm:flex shrink-0">
          <Loader2 v-if="store.uploading || compressionStatus" class="h-4 w-4 animate-spin mr-2" />
          <Upload v-else class="h-4 w-4 mr-2" />
          {{ compressionStatus || (store.uploading ? `Uploading ${store.uploadProgress}%` : 'Upload') }}
        </UiButton>
        <input ref="fileInput" type="file" multiple class="hidden" @change="handleUpload" />
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

      <div v-if="store.loading">
        <SkeletonGrid :count="6" variant="wallet" cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" />
      </div>

      <div v-else-if="store.files.length === 0" class="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed bg-muted/20">
        <Upload class="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p class="text-sm text-muted-foreground">No files uploaded yet.</p>
        <p class="text-xs text-muted-foreground/60 mt-1">Upload files to store them on Google Drive</p>
      </div>

      <div v-else>
        <!-- Folders View -->
        <div v-if="activeAlbum === null">
          <!-- Album Folders -->
          <div class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 mb-8">
            <template v-for="(albumFiles, albumName) in albums" :key="'folder-'+albumName">
              <UiCard
                v-if="albumName !== 'Uncategorized'"
                class="cursor-pointer hover:border-primary transition-all flex flex-col items-center justify-center p-6 text-center gap-3 shadow-sm hover:shadow-md"
                @click="activeAlbum = albumName"
              >
                <div class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <FolderOpen class="h-6 w-6" />
                </div>
                <div>
                  <p class="font-semibold text-sm line-clamp-1">{{ albumName }}</p>
                  <p class="text-[11px] text-muted-foreground mt-0.5">{{ albumFiles.length }} file{{ albumFiles.length !== 1 ? 's' : '' }}</p>
                </div>
              </UiCard>
            </template>
          </div>

          <!-- Uncategorized Files -->
          <div v-if="albums['Uncategorized'] && albums['Uncategorized'].length > 0">
            <h2 class="text-lg font-bold tracking-tight mb-4">Uncategorized</h2>
            <div class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <UiCard
                v-for="file in albums['Uncategorized']"
                :key="file.id"
                class="flex flex-col gap-0 hover:shadow-md transition-shadow"
              >
                <div class="flex items-start gap-3 p-4 pb-3">
                  <div class="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <FileText class="h-5 w-5 text-primary" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-medium truncate" :title="file.file_name">{{ file.file_name }}</p>
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
                    <Trash2 class="h-4 w-4" />
                  </UiButton>
                </div>
              </UiCard>
            </div>
          </div>
        </div>

        <!-- Inside an Album View -->
        <div v-else class="animate-fade-in">
          <div class="flex items-center gap-3 mb-6">
            <UiButton variant="ghost" size="icon" class="shrink-0 rounded-full hover:bg-muted" @click="activeAlbum = null">
              <ArrowLeft class="h-5 w-5" />
            </UiButton>
            <div class="flex items-center gap-2">
              <FolderOpen class="h-6 w-6 text-primary" />
              <h2 class="text-xl font-bold tracking-tight">{{ activeAlbum }}</h2>
              <span class="ml-2 text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {{ albums[activeAlbum]?.length || 0 }} files
              </span>
            </div>
          </div>

          <div v-if="!albums[activeAlbum] || albums[activeAlbum].length === 0" class="text-sm text-muted-foreground py-16 text-center border border-dashed rounded-xl bg-muted/10">
            <FolderOpen class="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p>No files in this album.</p>
            <p class="text-xs text-muted-foreground/60 mt-1">Tap the + button to add files here.</p>
          </div>

          <div v-else class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <UiCard
              v-for="file in albums[activeAlbum]"
              :key="file.id"
              class="flex flex-col gap-0 hover:shadow-md transition-shadow"
            >
              <div class="flex items-start gap-3 p-4 pb-3">
                <div class="rounded-lg bg-primary/10 p-2.5 shrink-0">
                  <FileText class="h-5 w-5 text-primary" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium truncate" :title="file.file_name">{{ file.file_name }}</p>
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
                  <Trash2 class="h-4 w-4" />
                </UiButton>
              </div>
            </UiCard>
          </div>
        </div>
      </div>

      <!-- Pagination Controls -->
      <div v-if="store.pagination.total > 10" class="flex items-center justify-end mt-8 mb-6">
        <div class="flex items-center bg-card border border-border shadow-sm rounded-full p-1 gap-1">
          <button
            class="h-11 w-11 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-muted active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
            :disabled="currentPage <= 1"
            @click="currentPage--"
          >
            <ChevronLeft class="h-5 w-5" />
          </button>

          <div class="px-4 py-1 text-xs font-bold tracking-tight text-foreground flex items-center gap-1.5 border-x border-border/50">
            <span class="text-primary">{{ currentPage }}</span>
            <span class="text-muted-foreground/50">/</span>
            <span>{{ store.pagination.last_page }}</span>
          </div>

          <button
            class="h-11 w-11 flex items-center justify-center rounded-full transition-all duration-200 hover:bg-muted active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
            :disabled="currentPage >= store.pagination.last_page"
            @click="currentPage++"
          >
            <ChevronRight class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Upload Modal -->
      <Teleport to="body">
        <div v-if="showUploadModal" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" @mousedown.self="showUploadModal = false">
          <UiCard class="w-full sm:max-w-md shadow-xl animate-fade-in rounded-2xl p-5">
            <h2 class="text-lg font-semibold mb-4">Upload Files</h2>
            <div class="space-y-4">
              <div>
                <UiLabel>Album Name (Optional)</UiLabel>
                <UiInput v-model="uploadAlbumName" placeholder="e.g. Vacation 2026, Receipts..." class="mt-1" autofocus />
                <p class="text-[11px] text-muted-foreground mt-1.5">Leave empty to keep files uncategorized.</p>
              </div>
              <div class="flex justify-end gap-2 mt-6">
                <UiButton variant="ghost" @click="showUploadModal = false">Cancel</UiButton>
                <UiButton @click="triggerFileInput">Select Files</UiButton>
              </div>
            </div>
          </UiCard>
        </div>
      </Teleport>
    </div>
  </div>
</template>
