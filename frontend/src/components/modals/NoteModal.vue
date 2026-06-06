<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { useNotesStore } from '@/stores/notes.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { Check, Undo, Redo, Pencil } from 'lucide-vue-next'
import AppBackButton from '@/components/AppBackButton.vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { shouldFetchFromServer } from '@/lib/syncEngine.js'

const props = defineProps({
  show: Boolean,
  noteId: { type: [String, Number], default: null },
  defaultFolderId: { type: [String, Number], default: null }
})

const emit = defineEmits(['close'])

const store = useNotesStore()
const dashboardStore = useDashboardStore()

const form = ref({ title: '', content: '', folder_id: null })
const editor = ref(null)
const expandTools = ref(false)
const currentEditorHTML = ref('')
const isMobile = ref(window.innerWidth < 640)
const autoSaveTimer = ref(null)
const isSaving = ref(false)
const editingModeId = ref(null)

const handleResize = () => isMobile.value = window.innerWidth < 640

watch(() => props.show, (val) => {
  if (val) {
    window.addEventListener('resize', handleResize)
    editingModeId.value = props.noteId

    if (props.noteId) {
      const note = store.notes.find(n => n.id === props.noteId)
      if (note) {
        form.value = {
          title: note.title,
          content: note.content,
          folder_id: note.folder_id
        }
        currentEditorHTML.value = note.content
        initEditor(note.content)
      }
    } else {
      form.value = { 
        title: '', 
        content: '', 
        folder_id: props.defaultFolderId || null
      }
      currentEditorHTML.value = ''
      initEditor('')
      nextTick(() => {
        editor.value?.commands.focus()
      })
    }
  } else {
    window.removeEventListener('resize', handleResize)
    closeEditor(false) // don't emit close again
  }
})

onBeforeUnmount(() => {
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
  if (editor.value) editor.value.destroy()
  window.removeEventListener('resize', handleResize)
})

function scheduleAutoSave() {
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
  autoSaveTimer.value = setTimeout(() => performAutoSave(), 500)
}

async function performAutoSave() {
  if (!props.show || isSaving.value) return
  const contentHTML = currentEditorHTML.value
  const title = form.value.title
  const isEmpty = !title.trim() && (!contentHTML || contentHTML === '<p></p>')
  if (isEmpty) return

  const data = {
    title,
    content: contentHTML,
    folder_id: form.value.folder_id
  }

  isSaving.value = true
  try {
    if (editingModeId.value) {
      await store.update(editingModeId.value, data)
    } else {
      const created = await store.create(data)
      if (created) editingModeId.value = created.id
    }
    if (shouldFetchFromServer()) {
      dashboardStore.fetchStats()
    }
  } finally {
    isSaving.value = false
  }
}

watch(() => form.value.title, (newVal, oldVal) => {
  if (props.show && newVal !== oldVal) {
    scheduleAutoSave()
  }
})

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
    onUpdate({ editor: e }) {
      currentEditorHTML.value = e.getHTML()
      scheduleAutoSave()
    },
    onSelectionUpdate() {
      if (!isMobile.value) {
        expandTools.value = false
      }
    }
  })
}

function closeEditor(shouldEmit = true) {
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value)
    autoSaveTimer.value = null
    performAutoSave()
  }

  if (editor.value) {
    editor.value.destroy()
    editor.value = null
  }
  
  if (shouldEmit) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <transition name="note-editor">
      <div v-if="show" class="fixed inset-0 z-[80] flex flex-col bg-background">
        <!-- Header bar -->
        <div class="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-card/95 backdrop-blur-sm shrink-0">
          <AppBackButton @click="closeEditor(true)" />

          <div class="flex items-center gap-2">
            <!-- Undo/Redo Pill -->
            <div class="flex items-center border border-border rounded-full overflow-hidden bg-card/50">
              <button
                @click="editor?.chain().focus().undo().run()"
                :disabled="!editor?.can().undo()"
                class="w-10 h-10 flex items-center justify-center text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-90 border-r border-border"
              >
                <Undo class="h-4 w-4" />
              </button>
              <button
                @click="editor?.chain().focus().redo().run()"
                :disabled="!editor?.can().redo()"
                class="w-10 h-10 flex items-center justify-center text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-all active:scale-90"
              >
                <Redo class="h-4 w-4" />
              </button>
            </div>

            <!-- Check Button -->
            <button
              @click="closeEditor(true)"
              class="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted transition-all active:scale-90"
            >
              <Check class="h-5 w-5" />
            </button>
          </div>
        </div>

        <!-- Editor body -->
        <div class="flex-1 flex flex-col overflow-y-auto relative">
          <div class="max-w-3xl w-full mx-auto flex flex-col flex-1 px-4 sm:px-6 py-4">
            <!-- Title input -->
            <input
              v-model="form.title"
              type="text"
              placeholder="Title"
              class="w-full bg-transparent text-2xl sm:text-3xl font-bold text-foreground placeholder:text-muted-foreground/40 border-none outline-none mb-3 pb-2"
            />

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
