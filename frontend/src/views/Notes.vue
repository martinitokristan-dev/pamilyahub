<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useNotesStore } from '@/stores/notes.js'
import { Plus, Pencil, Trash2, X, NotebookPen, Search, ArrowLeft, Check } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'

const store = useNotesStore()
const showEditor = ref(false)
const editing = ref(null)
const form = ref({ title: '', content: '' })
const searchQuery = ref('')
const contentTextarea = ref(null)

onMounted(() => store.fetchAll())
useRegisterAddAction(openCreate)

const filteredNotes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return store.notes
  return store.notes.filter(n =>
    n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
  )
})

function openCreate() {
  editing.value = null
  form.value = { title: '', content: '' }
  showEditor.value = true
  nextTick(() => {
    if (contentTextarea.value) contentTextarea.value.focus()
  })
}

function openNote(note) {
  editing.value = note
  form.value = { title: note.title, content: note.content }
  showEditor.value = true
}

async function saveNote() {
  if (!form.value.title.trim() && !form.value.content.trim()) {
    showEditor.value = false
    return
  }
  if (editing.value) {
    await store.update(editing.value.id, form.value)
  } else {
    await store.create(form.value)
  }
  showEditor.value = false
}

function closeEditor() {
  showEditor.value = false
}

// Auto bullet point logic — iPhone Notepad style
function handleContentKeydown(e) {
  if (e.key === 'Enter') {
    const textarea = e.target
    const { selectionStart } = textarea
    const text = textarea.value
    // Find the start of the current line
    const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1
    const currentLine = text.substring(lineStart, selectionStart)
    // Check if line starts with bullet
    const bulletMatch = currentLine.match(/^(\s*)([-•]\s)/)
    if (bulletMatch) {
      // If line is only a bullet (empty content after bullet), remove it
      const afterBullet = currentLine.substring(bulletMatch[0].length)
      if (afterBullet.trim() === '') {
        e.preventDefault()
        // Remove the empty bullet line and just add newline
        const before = text.substring(0, lineStart)
        const after = text.substring(selectionStart)
        form.value.content = before + '\n' + after
        nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = before.length + 1
        })
        return
      }
      e.preventDefault()
      const indent = bulletMatch[1]
      const bulletChar = bulletMatch[2]
      const newBullet = '\n' + indent + bulletChar
      const before = text.substring(0, selectionStart)
      const after = text.substring(selectionStart)
      form.value.content = before + newBullet + after
      nextTick(() => {
        const newPos = selectionStart + newBullet.length
        textarea.selectionStart = textarea.selectionEnd = newPos
      })
    }
  }
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getPreviewLines(content) {
  if (!content) return ''
  return content.split('\n').slice(0, 3).join('\n')
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-6xl mx-auto animate-fade-in pb-6">
    <!-- List view -->
    <template v-if="!showEditor">
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Notes</h1>
        </div>
        <UiButton @click="openCreate" class="self-start sm:self-auto hidden sm:flex">
          <Plus class="h-4 w-4" /> New Note
        </UiButton>
      </div>

      <!-- Search bar -->
      <div class="relative mb-5">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <UiInput
          v-model="searchQuery"
          class="pl-9"
          placeholder="Search notes by title or content…"
        />
      </div>

      <div v-if="store.notes.length === 0" class="flex flex-col items-center justify-center py-24 text-center border rounded-xl border-dashed bg-muted/20">
        <NotebookPen class="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p class="text-sm text-muted-foreground">No notes yet. Create your first one!</p>
      </div>

      <div v-else-if="filteredNotes.length === 0" class="flex flex-col items-center justify-center py-16 text-center border rounded-xl border-dashed bg-muted/20">
        <Search class="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p class="text-sm text-muted-foreground">No notes match "<span class="font-medium">{{ searchQuery }}</span>"</p>
      </div>

      <div v-else class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <UiCard
          v-for="note in filteredNotes"
          :key="note.id"
          class="flex flex-col gap-0 hover:shadow-md transition-all duration-200 cursor-pointer active:scale-[0.98]"
          @click="openNote(note)"
        >
          <div class="flex items-start justify-between gap-2 p-4 pb-2">
            <h3 class="font-semibold leading-tight line-clamp-1">{{ note.title }}</h3>
            <div class="hidden sm:flex gap-1 shrink-0" @click.stop>
              <UiButton variant="ghost" size="icon" class="h-8 w-8" @click="openNote(note)">
                <Pencil class="h-4 w-4" />
              </UiButton>
              <UiButton variant="ghost" size="icon" class="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" @click="store.remove(note.id)">
                <Trash2 class="h-4 w-4" />
              </UiButton>
            </div>
          </div>
          <div class="px-4 pb-4 flex-1 flex flex-col">
            <p class="text-sm text-muted-foreground line-clamp-4 flex-1 whitespace-pre-line">{{ getPreviewLines(note.content) }}</p>
            <p class="text-xs text-muted-foreground/60 mt-3">{{ formatDate(note.updated_at) }}</p>
          </div>
        </UiCard>
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
                v-if="editing"
                variant="ghost"
                size="icon"
                class="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                @click="store.remove(editing.id); showEditor = false"
                title="Delete note"
              >
                <Trash2 class="h-4 w-4" />
              </UiButton>
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
              <textarea
                ref="contentTextarea"
                v-model="form.content"
                placeholder="Start writing…"
                @keydown="handleContentKeydown"
                class="w-full flex-1 bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground/40 border-none outline-none resize-none leading-relaxed min-h-[300px]"
              ></textarea>
            </div>
          </div>

          <!-- Toolbar hint -->
          <div class="border-t border-border px-4 py-2.5 bg-card/95 backdrop-blur-sm shrink-0">
            <p class="text-[11px] text-muted-foreground/60 text-center">
              Tip: Start a line with <span class="font-mono bg-muted px-1 py-0.5 rounded text-muted-foreground">-</span> or <span class="font-mono bg-muted px-1 py-0.5 rounded text-muted-foreground">•</span> for auto bullet points
            </p>
          </div>
        </div>
      </transition>
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
</style>
