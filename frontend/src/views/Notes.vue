<script setup>
defineOptions({ name: 'Notes' })
import { ref, onMounted, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotesStore } from '@/stores/notes.js'
import { useToast } from '@/composables/useToast.js'
import { Plus, Pencil, Trash2, X, NotebookPen, Search, Check, Undo, Redo, MoreVertical, Star, FolderPlus, Lock, FolderOpen, Eye, EyeOff, FileText } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import AppBackButton from '@/components/AppBackButton.vue'
import { SkeletonNoteCard } from '@/components/skeletons'
import { useModalsStore } from '@/stores/modals.js'

const store = useNotesStore()
const toast = useToast()
const modals = useModalsStore()
const isMobile = ref(false)

// Folder & Priority State
const activeFolderId = computed({
  get: () => store.activeFolderId,
  set: (val) => { store.activeFolderId = val }
})
const showFolderModal = ref(false)
const showCreateFolderModal = ref(false)
const isCreatingFolder = ref(false)
const showPasswordModal = ref(false)
const targetNote = ref(null)
const unlockedFolders = ref(new Set())
const folderForm = ref({ name: '', password: '' })
const passwordAttempt = ref('')
const menuOpenId = ref(null)
const showPasswordCreate = ref(false)
const showPasswordUnlock = ref(false)
const pendingFolderId = ref(null)
const searchQuery = ref('')

const route = useRoute()
const router = useRouter()

onMounted(() => {
  store.fetchAll()
  isMobile.value = window.innerWidth < 640
  window.addEventListener('resize', () => isMobile.value = window.innerWidth < 640)
  
  if (route.query.action === 'add') {
    openCreate()
    router.replace({ query: { ...route.query, action: undefined } })
  }
})
// Editor logic moved to NoteModal

const activeFolder = computed(() => {
  if (!activeFolderId.value) return null
  return store.folders.find(f => f.id === activeFolderId.value)
})

const notesByFolder = computed(() => {
  const groups = { 'Uncategorized': [] }
  
  // Initialize groups for all folders
  store.folders.forEach(f => {
    groups[f.id] = []
  })

  store.notes.forEach(note => {
    const key = note.folder_id || 'Uncategorized'
    if (!groups[key]) groups[key] = []
    groups[key].push(note)
  })
  return groups
})

const filteredNotes = computed(() => {
  let list = store.notes
  
  // Filter by active folder
  if (activeFolderId.value) {
    list = list.filter(n => n.folder_id === activeFolderId.value)
  } else {
    // On root, only show uncategorized
    list = list.filter(n => !n.folder_id)
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(n =>
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    )
  }

  // Sort: Prioritized first, then updated_at
  return [...list].sort((a, b) => {
    if (a.is_prioritized !== b.is_prioritized) {
      return b.is_prioritized ? 1 : -1
    }
    return new Date(b.updated_at) - new Date(a.updated_at)
  })
})

function openCreate() {
  modals.openNoteModal(null, activeFolderId.value)
}

function openNote(note) {
  modals.openNoteModal(note.id)
}

// Menu Actions
function toggleMenu(e, noteId) {
  e.stopPropagation()
  menuOpenId.value = menuOpenId.value === noteId ? null : noteId
}

async function togglePriority(note) {
  menuOpenId.value = null
  await store.update(note.id, { is_prioritized: !note.is_prioritized })
}

function openFolderModal(note) {
  menuOpenId.value = null
  targetNote.value = note
  showFolderModal.value = true
}

async function moveNoteToFolder(folderId) {
  if (!targetNote.value) return
  await store.update(targetNote.value.id, { folder_id: folderId })
  showFolderModal.value = false
  targetNote.value = null
}

function openCreateFolder() {
  folderForm.value = { name: '', password: '' }
  showCreateFolderModal.value = true
}

async function handleCreateFolder() {
  if (!folderForm.value.name.trim() || isCreatingFolder.value) return
  isCreatingFolder.value = true
  try {
    await store.createFolder({
      name: folderForm.value.name.trim(),
      password: folderForm.value.password.trim() || null
    })
    showCreateFolderModal.value = false
  } catch (err) {
    console.error(err)
    toast.error('Failed to create folder')
  } finally {
    isCreatingFolder.value = false
  }
}

function tryOpenFolder(folder) {
  if (folder.password && !unlockedFolders.value.has(folder.id)) {
    pendingFolderId.value = folder.id
    passwordAttempt.value = ''
    showPasswordUnlock.value = false
    showPasswordModal.value = true
  } else {
    activeFolderId.value = folder.id
  }
}

function checkPassword() {
  const folder = store.folders.find(f => f.id === pendingFolderId.value)
  if (passwordAttempt.value === folder.password) {
    unlockedFolders.value.add(folder.id)
    activeFolderId.value = folder.id // Now enter the folder
    showPasswordModal.value = false
    pendingFolderId.value = null
    passwordAttempt.value = ''
  } else {
    toast.error('Incorrect password')
  }
}

function closePasswordModal() {
  showPasswordModal.value = false
  pendingFolderId.value = null
  passwordAttempt.value = ''
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getPreviewLines(content) {
  if (!content) return ''
  const plainText = content.replace(/<p[^>]*>/g, '\n').replace(/<[^>]+>/g, '').trim()
  return plainText.split('\n').slice(0, 3).join('\n')
}

onBeforeUnmount(() => {
  store.activeFolderId = null
})
</script>

<template>
  <div class="px-3 py-4 md:p-6 max-w-6xl mx-auto animate-fade-in pb-6">
    <!-- List view -->
    <div>
      <div class="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div class="flex items-center gap-3 space-y-1">
          <AppBackButton
            v-if="activeFolderId"
            @click="activeFolderId = null"
            class="shrink-0"
          />
          <h1 class="text-2xl font-medium tracking-tight text-foreground">
            {{ activeFolder ? activeFolder.name : 'Notes' }}
          </h1>
        </div>
        <div class="flex items-center justify-end gap-3 w-full sm:w-auto">
          <UiButton v-if="!activeFolderId" variant="outline" size="sm" @click="openCreateFolder" class="shrink-0 rounded-full h-9 px-4">
            <FolderPlus class="h-4 w-4 mr-2" /> Add Folder
          </UiButton>
          <UiButton @click="openCreate" variant="outline" size="sm" class="shrink-0 rounded-full h-9 px-4" :class="{'hidden sm:flex': !activeFolderId}">
            <Plus class="h-4 w-4 mr-2" /> New Note
          </UiButton>
        </div>
      </div>

      <!-- Search bar -->
      <div class="relative mb-5">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <UiInput
          v-model="searchQuery"
          class="pl-9"
          type="search"
          autocomplete="off"
          placeholder="Search notes by title or content…"
        />
      </div>

      <div v-if="store.loading && store.notes.length === 0">
        <SkeletonNoteCard :count="6" />
      </div>

      <div v-else-if="store.notes.length === 0" class="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed bg-muted/20">
        <NotebookPen class="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p class="text-sm text-muted-foreground">No notes yet. Create your first one!</p>
      </div>

      <!-- Folders Grid -->
      <div v-if="!activeFolderId" class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-6">
        <UiCard 
          v-for="folder in store.folders"
          :key="folder.id"
          class="cursor-pointer hover:border-primary transition-all flex flex-col items-center justify-center p-4 text-center gap-2 shadow-sm hover:shadow-md relative overflow-hidden group rounded-2xl"
          @click="tryOpenFolder(folder)"
        >
          <!-- Delete Folder Button -->
          <button 
            @click.stop="store.removeFolder(folder.id)" 
            class="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>

          <div class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <FolderOpen class="h-6 w-6" />
          </div>
          <div>
            <p class="font-semibold text-sm line-clamp-1">{{ folder.name }}</p>
            <p class="text-[11px] text-muted-foreground mt-0.5">{{ notesByFolder[folder.id]?.length || 0 }} note{{ (notesByFolder[folder.id]?.length || 0) !== 1 ? 's' : '' }}</p>
          </div>
          <Lock v-if="folder.password" class="absolute top-2 right-2 h-3.5 w-3.5 text-muted-foreground/40" />
        </UiCard>
      </div>

      <div v-if="activeFolderId || (notesByFolder['Uncategorized'] && notesByFolder['Uncategorized'].length > 0)">
        <h2 v-if="!activeFolderId && store.notes.length > 0" class="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-1">Other Notes</h2>
        
        <div v-if="filteredNotes.length === 0 && activeFolderId" class="flex flex-col items-center justify-center py-16 text-center border rounded-xl border-dashed bg-muted/20">
          <Search class="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p class="text-sm text-muted-foreground">No notes found here.</p>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <UiCard
            v-for="note in filteredNotes"
            :key="note._clientKey || note.id"
            class="flex flex-col h-32 sm:h-36 hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98] relative group rounded-2xl border-border"
            :class="{ 'z-50': menuOpenId === note.id }"
            @click="openNote(note)"
          >
            <!-- Priority Star -->
            <div v-if="note.is_prioritized" class="absolute -top-1 -left-1 z-10 bg-yellow-400 text-white p-1 rounded-br-lg shadow-sm">
              <Star class="h-3 w-3 fill-current" />
            </div>

            <div class="flex flex-col h-full p-3 sm:p-4">
              <div class="flex items-start justify-between gap-2 mb-1">
                <h3 class="font-bold text-sm sm:text-base leading-tight line-clamp-1 flex-1 pr-6">{{ note.title || 'Untitled' }}</h3>
                
                <!-- 3 Dots Menu -->
                <div class="absolute top-2 right-1.5" @click.stop>
                  <UiButton variant="ghost" size="icon" class="h-7 w-7 rounded-full" @click="toggleMenu($event, note.id)">
                    <MoreVertical class="h-4 w-4" />
                  </UiButton>
                  
                  <!-- Simple Dropdown Overlay -->
                  <div v-if="menuOpenId === note.id" class="absolute right-0 top-8 w-40 bg-card border rounded-lg shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-200">
                    <button @click="togglePriority(note)" class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors">
                      <Star class="h-4 w-4" :class="{'fill-yellow-400 text-yellow-400': note.is_prioritized}" />
                      {{ note.is_prioritized ? 'Unprioritize' : 'Prioritize' }}
                    </button>
                    <button @click="openFolderModal(note)" class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors">
                      <FolderPlus class="h-4 w-4" />
                      Move to Folder
                    </button>
                    <div class="h-px bg-border my-1"></div>
                    <button @click="store.remove(note.id)" class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 class="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>

              <!-- Content Preview with Ellipsis -->
              <p class="text-[12px] text-muted-foreground leading-relaxed line-clamp-2 flex-1 mb-2 whitespace-pre-line">
                {{ getPreviewLines(note.content) }}
              </p>

              <!-- Footer info -->
              <div class="mt-auto flex items-center justify-between pt-1.5 border-t border-border/50">
                <p class="text-[9px] text-muted-foreground/60">{{ formatDate(note.updated_at) }}</p>
                <div v-if="note.folder_id && !activeFolderId" class="flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-full bg-primary/5 text-primary/70 border border-primary/10 max-w-[70px]">
                  <FolderOpen class="h-2 w-2 shrink-0" />
                  <span class="truncate">{{ store.folders.find(f => f.id === note.folder_id)?.name }}</span>
                </div>
              </div>
            </div>
          </UiCard>
        </div>
      </div>
    </div>

    <!-- Global Click Handler for Menu -->
    <div v-if="menuOpenId" class="fixed inset-0 z-40" @click="menuOpenId = null"></div>

    <!-- Folder Selection Modal -->
    <Teleport to="body">
      <div v-if="showFolderModal" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" @mousedown.self="showFolderModal = false">
        <UiCard class="w-full sm:max-w-md shadow-xl animate-fade-in rounded-2xl p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">Move to Folder</h2>
            <UiButton variant="ghost" size="icon" @click="showFolderModal = false">
              <X class="h-4 w-4" />
            </UiButton>
          </div>
          <div class="space-y-2 max-h-[300px] overflow-y-auto mb-4 pr-1">
            <button 
              class="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors text-sm"
              @click="moveNoteToFolder(null)"
            >
              <div class="flex items-center gap-2">
                <FileText class="h-4 w-4 text-muted-foreground" />
                <span>Other Notes</span>
              </div>
              <Check v-if="!targetNote?.folder_id" class="h-4 w-4 text-primary" />
            </button>
            <button 
              v-for="folder in store.folders" 
              :key="folder.id"
              class="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors text-sm"
              @click="moveNoteToFolder(folder.id)"
            >
              <div class="flex items-center gap-2">
                <FolderOpen class="h-4 w-4 text-primary" />
                <span>{{ folder.name }}</span>
                <Lock v-if="folder.password" class="h-3 w-3 text-muted-foreground/40" />
              </div>
              <Check v-if="targetNote?.folder_id === folder.id" class="h-4 w-4 text-primary" />
            </button>
          </div>
          <UiButton variant="outline" class="w-full" @click="showFolderModal = false; openCreateFolder()">
            <Plus class="h-4 w-4 mr-2" /> Create New Folder
          </UiButton>
        </UiCard>
      </div>
    </Teleport>

    <!-- Create Folder Modal -->
    <Teleport to="body">
      <div v-if="showCreateFolderModal" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" @mousedown.self="!isCreatingFolder && (showCreateFolderModal = false)">
        <UiCard class="w-full sm:max-w-sm shadow-xl animate-fade-in rounded-2xl p-5">
          <h2 class="text-lg font-semibold mb-4">New Folder</h2>
          <div class="space-y-4">
            <div>
              <UiLabel>Folder Name</UiLabel>
              <UiInput v-model="folderForm.name" :disabled="isCreatingFolder" placeholder="e.g. Secret, Work, Recipes" class="mt-1" autofocus autocomplete="off" />
            </div>
            <div>
              <UiLabel>Password (Optional)</UiLabel>
              <div class="relative mt-1">
                <UiInput 
                  v-model="folderForm.password" 
                  :disabled="isCreatingFolder"
                  :type="showPasswordCreate ? 'text' : 'password'" 
                  placeholder="Lock this folder" 
                  autocomplete="new-password"
                />
                <button 
                  type="button"
                  :disabled="isCreatingFolder"
                  @click="showPasswordCreate = !showPasswordCreate"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <component :is="showPasswordCreate ? EyeOff : Eye" class="h-4 w-4" />
                </button>
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
              <UiButton variant="ghost" :disabled="isCreatingFolder" @click="showCreateFolderModal = false">Cancel</UiButton>
              <UiButton :disabled="isCreatingFolder" @click="handleCreateFolder">
                {{ isCreatingFolder ? 'Creating...' : 'Create Folder' }}
              </UiButton>
            </div>
          </div>
        </UiCard>
      </div>
    </Teleport>

    <!-- Password Prompt Modal -->
    <Teleport to="body">
      <div v-if="showPasswordModal" class="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
        <UiCard class="w-full sm:max-w-xs shadow-2xl animate-fade-in rounded-2xl p-6 text-center">
          <div class="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
            <Lock class="h-7 w-7" />
          </div>
          <h2 class="text-xl font-bold mb-2">Folder Locked</h2>
          <p class="text-sm text-muted-foreground mb-6">Enter password for <span class="font-semibold text-foreground">{{ store.folders.find(f => f.id === pendingFolderId)?.name || 'Folder' }}</span>.</p>
          
          <div class="relative mb-4">
            <UiInput 
              v-model="passwordAttempt" 
              :type="showPasswordUnlock ? 'text' : 'password'" 
              placeholder="Password" 
              class="text-center"
              @keyup.enter="checkPassword"
              autofocus
              autocomplete="new-password"
            />
            <button 
              type="button"
              @click="showPasswordUnlock = !showPasswordUnlock"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <component :is="showPasswordUnlock ? EyeOff : Eye" class="h-4 w-4" />
            </button>
          </div>
          
          <div class="flex flex-col gap-2">
            <UiButton @click="checkPassword" class="w-full">Unlock Folder</UiButton>
            <UiButton variant="ghost" @click="closePasswordModal" class="w-full">Cancel</UiButton>
          </div>
        </UiCard>
      </div>
    </Teleport>
  </div>
</template>
