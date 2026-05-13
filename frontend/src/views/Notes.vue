<script setup>
import { ref, onMounted, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useNotesStore } from '@/stores/notes.js'
import { Plus, Pencil, Trash2, X, NotebookPen, Search, ArrowLeft, Check, MoreVertical, Star, FolderPlus, Lock, FolderOpen, Eye, EyeOff, FileText } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import { useToast } from '@/composables/useToast.js'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

const store = useNotesStore()
const toast = useToast()
const showEditor = ref(false)
const editing = ref(null)
const form = ref({ title: '', content: '', folder_id: null })
const searchQuery = ref('')
const editor = ref(null)
const expandTools = ref(false)
const isMobile = ref(false)

// Folder & Priority State
const activeFolderId = ref(null)
const showFolderModal = ref(false)
const showCreateFolderModal = ref(false)
const showPasswordModal = ref(false)
const targetNote = ref(null)
const unlockedFolders = ref(new Set())
const folderForm = ref({ name: '', password: '' })
const passwordAttempt = ref('')
const menuOpenId = ref(null)
const showPasswordCreate = ref(false)
const showPasswordUnlock = ref(false)
const pendingFolderId = ref(null)

onMounted(() => {
  store.fetchAll()
  isMobile.value = window.innerWidth < 640
  window.addEventListener('resize', () => isMobile.value = window.innerWidth < 640)
})
onBeforeUnmount(() => {
  if (editor.value) editor.value.destroy()
})
useRegisterAddAction(openCreate)

function initEditor(content = '') {
  if (editor.value) {
    editor.value.destroy()
  }
  editor.value = new Editor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing…',
      }),
    ],
    content: content,
    editorProps: {
      attributes: {
        class: 'w-full h-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground/40 border-none outline-none resize-none leading-relaxed min-h-[300px] focus:outline-none prose prose-sm sm:prose-base dark:prose-invert max-w-none',
        spellcheck: 'true',
        autocorrect: 'on',
      },
    },
    onSelectionUpdate() {
      if (!isMobile.value) {
        expandTools.value = false
      }
    }
  })
}

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
  editing.value = null
  form.value = { 
    title: '', 
    content: '', 
    folder_id: activeFolderId.value || null
  }
  showEditor.value = true
  initEditor('')
  nextTick(() => {
    editor.value?.commands.focus()
  })
}

function openNote(note) {
  editing.value = note
  form.value = { 
    title: note.title, 
    content: note.content,
    folder_id: note.folder_id
  }
  showEditor.value = true
  initEditor(note.content)
}

async function saveNote() {
  const contentHTML = editor.value ? editor.value.getHTML() : form.value.content
  if (!form.value.title.trim() && (!contentHTML || contentHTML === '<p></p>')) {
    closeEditor()
    return
  }
  
  const data = { 
    title: form.value.title,
    content: contentHTML,
    folder_id: form.value.folder_id
  }

  if (editing.value) {
    await store.update(editing.value.id, data)
  } else {
    await store.create(data)
  }
  closeEditor()
}

function closeEditor() {
  showEditor.value = false
  if (editor.value) {
    editor.value.destroy()
    editor.value = null
  }
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
  if (!folderForm.value.name.trim()) return
  await store.createFolder({
    name: folderForm.value.name.trim(),
    password: folderForm.value.password.trim() || null
  })
  showCreateFolderModal.value = false
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
</script>

<template>
  <div class="p-4 sm:p-6 max-w-6xl mx-auto animate-fade-in pb-6">
    <!-- List view -->
    <template v-if="!showEditor">
      <div class="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div class="flex items-center gap-3 space-y-1">
          <UiButton v-if="activeFolderId" variant="ghost" size="icon" @click="activeFolderId = null" class="rounded-full">
            <ArrowLeft class="h-5 w-5" />
          </UiButton>
          <h1 class="text-[32px] sm:text-[40px] font-black tracking-tight text-foreground leading-none">
            {{ activeFolder ? activeFolder.name : 'Notes' }}
          </h1>
        </div>
        <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          <UiButton variant="outline" size="sm" @click="openCreateFolder" class="shrink-0 rounded-full h-9 px-4">
            <FolderPlus class="h-4 w-4 mr-2" /> Add Folder
          </UiButton>
          <UiButton @click="openCreate" size="sm" class="hidden sm:flex shrink-0 rounded-full h-9 px-4">
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

      <div v-if="store.notes.length === 0" class="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed bg-muted/20">
        <NotebookPen class="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p class="text-sm text-muted-foreground">No notes yet. Create your first one!</p>
      </div>

      <!-- Folders Grid -->
      <div v-if="!activeFolderId" class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-8">
        <UiCard 
          v-for="folder in store.folders"
          :key="folder.id"
          class="cursor-pointer hover:border-primary transition-all flex flex-col items-center justify-center p-6 text-center gap-3 shadow-sm hover:shadow-md relative overflow-hidden group"
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
            :key="note.id"
            class="flex flex-col h-36 hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98] relative group"
            :class="{ 'z-50': menuOpenId === note.id }"
            @click="openNote(note)"
          >
            <!-- Priority Star -->
            <div v-if="note.is_prioritized" class="absolute -top-1 -left-1 z-10 bg-yellow-400 text-white p-1 rounded-br-lg shadow-sm">
              <Star class="h-3 w-3 fill-current" />
            </div>

            <div class="flex flex-col h-full p-4">
              <div class="flex items-start justify-between gap-2 mb-2">
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
    </template>

    <!-- Full-screen notepad editor -->
    <Teleport to="body">
      <transition name="note-editor">
        <div v-if="showEditor" class="fixed inset-0 z-50 flex flex-col bg-background">
          <!-- Header bar -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-border bg-card/95 backdrop-blur-sm shrink-0">
            <button
              @click="closeEditor"
              class="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <ArrowLeft class="h-4 w-4" />
              <span>Notes</span>
            </button>
            <div class="flex items-center gap-1 sm:gap-2">
              <UiButton
                size="sm"
                @click="saveNote"
                :disabled="store.loading"
                class="px-4"
              >
                <Check class="h-4 w-4" />
                {{ store.loading ? 'Saving…' : 'Done' }}
              </UiButton>
            </div>
          </div>

          <!-- Editor body -->
          <div class="flex-1 flex flex-col overflow-y-auto">
            <div class="max-w-3xl w-full mx-auto flex flex-col flex-1 px-4 sm:px-6 py-4">
              <!-- Title input -->
              <input
                v-model="form.title"
                type="text"
                placeholder="Title"
                class="w-full bg-transparent text-2xl sm:text-3xl font-bold text-foreground placeholder:text-muted-foreground/40 border-none outline-none mb-3 pb-2"
              />

              <!-- Date stamp -->
              <p class="text-xs text-muted-foreground/60 mb-4">
                {{ editing ? formatDate(editing.updated_at) : new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }}
              </p>

              <!-- Divider -->
              <div class="h-px bg-border mb-4"></div>

              <!-- Content textarea -->
              <editor-content :editor="editor" class="flex-1 flex flex-col [&>div]:flex-1" />

              <bubble-menu
                v-if="editor"
                :editor="editor"
                :options="{ placement: 'top' }"
                class="flex items-center bg-card border border-border shadow-xl rounded-xl overflow-hidden p-1 gap-1"
              >
                <!-- Desktop Pen Toggle -->
                <div v-if="!isMobile && !expandTools">
                  <button @click="expandTools = true" class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center justify-center">
                    <Pencil class="h-4 w-4" />
                  </button>
                </div>
                
                <!-- Tools -->
                <div v-show="isMobile || expandTools" class="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
                  <button @click="editor.chain().focus().toggleBold().run()" :class="{ 'bg-muted text-foreground': editor.isActive('bold') }" class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors font-bold font-serif">
                    B
                  </button>
                  <button @click="editor.chain().focus().toggleItalic().run()" :class="{ 'bg-muted text-foreground': editor.isActive('italic') }" class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors italic font-serif">
                    I
                  </button>
                  <button @click="editor.chain().focus().toggleStrike().run()" :class="{ 'bg-muted text-foreground': editor.isActive('strike') }" class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors line-through">
                    S
                  </button>
                  <div class="w-px h-4 bg-border mx-1"></div>
                  <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ 'bg-muted text-foreground': editor.isActive('heading', { level: 2 }) }" class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors font-bold text-sm">
                    H2
                  </button>
                  <button @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" :class="{ 'bg-muted text-foreground': editor.isActive('heading', { level: 3 }) }" class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors font-bold text-sm">
                    H3
                  </button>
                  <div class="w-px h-4 bg-border mx-1"></div>
                  <button @click="editor.chain().focus().toggleBulletList().run()" :class="{ 'bg-muted text-foreground': editor.isActive('bulletList') }" class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-sm whitespace-nowrap">
                    • List
                  </button>
                </div>
              </bubble-menu>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
    <!-- Global Click Handler for Menu -->
    <div v-if="menuOpenId" class="fixed inset-0 z-40" @click="menuOpenId = null"></div>

    <!-- Folder Selection Modal -->
    <Teleport to="body">
      <div v-if="showFolderModal" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" @mousedown.self="showFolderModal = false">
        <UiCard class="w-full sm:max-w-md shadow-xl animate-fade-in rounded-t-2xl sm:rounded-2xl p-5">
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
      <div v-if="showCreateFolderModal" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" @mousedown.self="showCreateFolderModal = false">
        <UiCard class="w-full sm:max-w-sm shadow-xl animate-fade-in rounded-t-2xl sm:rounded-2xl p-5">
          <h2 class="text-lg font-semibold mb-4">New Folder</h2>
          <div class="space-y-4">
            <div>
              <UiLabel>Folder Name</UiLabel>
              <UiInput v-model="folderForm.name" placeholder="e.g. Secret, Work, Recipes" class="mt-1" autofocus autocomplete="off" />
            </div>
            <div>
              <UiLabel>Password (Optional)</UiLabel>
              <div class="relative mt-1">
                <UiInput 
                  v-model="folderForm.password" 
                  :type="showPasswordCreate ? 'text' : 'password'" 
                  placeholder="Lock this folder" 
                  autocomplete="new-password"
                />
                <button 
                  type="button"
                  @click="showPasswordCreate = !showPasswordCreate"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <component :is="showPasswordCreate ? EyeOff : Eye" class="h-4 w-4" />
                </button>
              </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
              <UiButton variant="ghost" @click="showCreateFolderModal = false">Cancel</UiButton>
              <UiButton @click="handleCreateFolder">Create Folder</UiButton>
            </div>
          </div>
        </UiCard>
      </div>
    </Teleport>

    <!-- Password Prompt Modal -->
    <Teleport to="body">
      <div v-if="showPasswordModal" class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md">
        <UiCard class="w-full sm:max-w-xs shadow-2xl animate-fade-in rounded-t-3xl sm:rounded-2xl p-6 text-center">
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

<style scoped>
.note-editor-enter-active,
.note-editor-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.note-editor-enter-from {
  transform: translateY(100%);
  opacity: 0.8;
}
.note-editor-leave-to {
  transform: translateY(100%);
  opacity: 0.8;
}

/* TipTap Editor Styles */
:deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: hsl(var(--muted-foreground) / 0.4);
  pointer-events: none;
  height: 0;
}
:deep(.tiptap) {
  outline: none !important;
}
:deep(.tiptap p) {
  margin-bottom: 0.75em;
}
:deep(.tiptap h1) {
  font-size: 1.5em;
  font-weight: 700;
  margin-bottom: 0.5em;
  margin-top: 1em;
}
:deep(.tiptap h2) {
  font-size: 1.25em;
  font-weight: 600;
  margin-bottom: 0.5em;
  margin-top: 1em;
}
:deep(.tiptap h3) {
  font-size: 1.1em;
  font-weight: 600;
  margin-bottom: 0.5em;
  margin-top: 1em;
}
:deep(.tiptap ul) {
  list-style-type: disc;
  padding-left: 1.5em;
  margin-bottom: 0.75em;
}
:deep(.tiptap ol) {
  list-style-type: decimal;
  padding-left: 1.5em;
  margin-bottom: 0.75em;
}
:deep(.tiptap blockquote) {
  border-left: 3px solid hsl(var(--border));
  padding-left: 1em;
  color: hsl(var(--muted-foreground));
  font-style: italic;
}
</style>
