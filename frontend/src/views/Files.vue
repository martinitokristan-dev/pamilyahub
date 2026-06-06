<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFilesStore } from '@/stores/files.js'
import { Upload, Trash2, ExternalLink, FileText, Loader2, FolderOpen, ChevronLeft, ChevronRight, WifiOff } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiCard from '@/components/ui/Card.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import { SkeletonGrid } from '@/components/skeletons'
import FileModal from '@/components/modals/FileModal.vue'

const store = useFilesStore()
const currentPage = ref(1)
const isOffline = ref(!navigator.onLine)

// Listen for online/offline changes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => isOffline.value = false)
  window.addEventListener('offline', () => isOffline.value = true)
}

const route = useRoute()
const router = useRouter()

onMounted(() => {
  if (!isOffline.value) store.fetchAll(false, currentPage.value)
  
  if (route.query.action === 'add') {
    uploadAlbumName.value = activeAlbum.value || ''
    showUploadModal.value = true 
    router.replace({ query: { ...route.query, action: undefined } })
  }
})

watch(currentPage, (val) => {
  if (!isOffline.value) store.fetchAll(false, val)
  const main = document.querySelector('main')
  if (main) {
    main.scrollTop = 0
  }
})

const showUploadModal = ref(false)
const activeAlbum = ref(null)
const uploadAlbumName = ref('')

// Upload logic moved to FileModal

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
          <h1 class="text-2xl font-medium tracking-tight text-foreground">Files & Albums</h1>
          <p class="text-sm font-medium text-muted-foreground">{{ store.files.length }} file{{ store.files.length !== 1 ? 's' : '' }} stored securely</p>
        </div>
        <UiButton @click="showUploadModal = true" :disabled="store.uploading" class="hidden sm:flex shrink-0">
          <Loader2 v-if="store.uploading" class="h-4 w-4 animate-spin mr-2" />
          <Upload v-else class="h-4 w-4 mr-2" />
          {{ store.uploading ? `Uploading ${store.uploadProgress}%` : 'Upload' }}
        </UiButton>
      </div>

      <!-- Upload progress banner -->
      <div v-if="store.uploading" class="mb-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div class="p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <div class="rounded-full bg-primary/10 p-1.5">
                <Upload class="h-4 w-4 text-primary animate-bounce" />
              </div>
              <span class="text-sm font-semibold">
                Uploading file...
              </span>
            </div>
            <span class="text-xs font-medium text-muted-foreground">{{ store.uploadProgress }}%</span>
          </div>
          <div class="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-primary transition-all duration-300 ease-out"
              :style="{ width: `${store.uploadProgress}%` }"
            />
          </div>
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
            <button
              @click="activeAlbum = null"
              class="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-all active:scale-90 shrink-0"
            >
              <ChevronLeft class="h-5 w-5" />
            </button>
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
      <div v-if="store.pagination.total > 10" class="flex items-center justify-center mt-8 mb-6">
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

      <FileModal
        :show="showUploadModal"
        :defaultAlbum="uploadAlbumName"
        @close="showUploadModal = false"
      />
    </div>
  </div>
</template>
