<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { useNotesStore } from '@/stores/notes.js'
import { useDashboardStore } from '@/stores/dashboard.js'
import { Check, Undo, Redo, Pencil, Camera, Loader2, Copy, ClipboardCopy } from 'lucide-vue-next'
import AppBackButton from '@/components/AppBackButton.vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { shouldFetchFromServer } from '@/lib/syncEngine.js'
import { useNoteImageOcr } from '@/composables/useNoteImageOcr.js'
import { copyEditorToClipboard, installRichCopyHandler } from '@/utils/noteClipboard.js'
import { useToast } from '@/composables/useToast.js'

const props = defineProps({
  show: Boolean,
  noteId: { type: [String, Number], default: null },
  defaultFolderId: { type: [String, Number], default: null }
})

const emit = defineEmits(['close'])

const store = useNotesStore()
const dashboardStore = useDashboardStore()
const toast = useToast()
const { isExtracting, extractProgress, extractSource, processImageFile } = useNoteImageOcr()

const form = ref({ title: '', content: '', folder_id: null })
const editor = ref(null)
const editorAreaRef = ref(null)
const imageInputRef = ref(null)
const expandTools = ref(false)
const currentEditorHTML = ref('')
const isMobile = ref(window.innerWidth < 640)
const autoSaveTimer = ref(null)
const isSaving = ref(false)
const editingModeId = ref(null)
let removeCopyHandler = null

const contextMenu = ref({ show: false, x: 0, y: 0 })
const longPressTimer = ref(null)
const longPressTriggered = ref(false)
const LONG_PRESS_MS = 450

const handleResize = () => isMobile.value = window.innerWidth < 640

function hideContextMenu() {
  if (menuOpenGuard.value) return
  contextMenu.value.show = false
}

const menuOpenGuard = ref(false)

function showContextMenu(clientX, clientY) {
  const menuWidth = 220
  const menuHeight = 48
  const x = Math.min(clientX, window.innerWidth - menuWidth - 12)
  const y = Math.min(clientY, window.innerHeight - menuHeight - 12)
  contextMenu.value = { show: true, x, y }
  menuOpenGuard.value = true
  setTimeout(() => { menuOpenGuard.value = false }, 350)
}

function triggerImagePicker() {
  hideContextMenu()
  imageInputRef.value?.click()
}

async function handleImageSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !editor.value) return
  await processImageFile(file, editor.value, 'upload')
}

async function handlePastedImage(file) {
  if (!file || !editor.value || isExtracting.value) return
  await processImageFile(file, editor.value, 'paste')
}

async function copyNoteContent(selectAllFirst = false) {
  if (!editor.value) return
  if (selectAllFirst) {
    editor.value.commands.focus()
    editor.value.commands.selectAll()
  }
  const ok = await copyEditorToClipboard(editor.value)
  if (ok) toast.success('Copied to clipboard')
  else toast.error('Could not copy to clipboard')
}

function selectAllContent() {
  editor.value?.commands.focus()
  editor.value?.commands.selectAll()
}

function getImageFromClipboardEvent(event) {
  const cd = event.clipboardData
  if (!cd) return null

  if (cd.files?.length) {
    for (const file of cd.files) {
      if (file.type?.startsWith('image/')) return file
    }
  }

  for (const item of cd.items || []) {
    if (item.type?.startsWith('image/')) {
      return item.getAsFile()
    }
  }

  return null
}

function onDocumentPaste(event) {
  if (!props.show || isExtracting.value) return

  const file = getImageFromClipboardEvent(event)
  if (!file) return

  event.preventDefault()
  event.stopPropagation()
  handlePastedImage(file)
}

function onEditorContextMenu(event) {
  event.preventDefault()
  showContextMenu(event.clientX, event.clientY)
}

function onEditorTouchStart(event) {
  if (event.touches.length !== 1) return
  longPressTriggered.value = false
  const touch = event.touches[0]

  longPressTimer.value = setTimeout(() => {
    longPressTriggered.value = true
    if (navigator.vibrate) navigator.vibrate(15)
    showContextMenu(touch.clientX, touch.clientY)
  }, LONG_PRESS_MS)
}

function onEditorTouchEnd() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

function onEditorTouchMove() {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
}

watch(() => props.show, (val) => {
  if (val) {
    window.addEventListener('resize', handleResize)
    document.addEventListener('click', hideContextMenu)
    document.addEventListener('paste', onDocumentPaste, true)
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
    document.removeEventListener('click', hideContextMenu)
    document.removeEventListener('paste', onDocumentPaste, true)
    hideContextMenu()
    closeEditor(false) // don't emit close again
  }
})

onBeforeUnmount(() => {
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
  if (longPressTimer.value) clearTimeout(longPressTimer.value)
  removeCopyHandler?.()
  removeCopyHandler = null
  if (editor.value) editor.value.destroy()
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('click', hideContextMenu)
  document.removeEventListener('paste', onDocumentPaste, true)
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
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: isMobile.value
          ? 'Write here… Paste a screenshot or long-press to upload'
          : 'Write here… Ctrl+V to paste a screenshot, or right-click to upload',
      }),
    ],
    content: content,
    editorProps: {
      attributes: {
        class: 'w-full h-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground/40 border-none outline-none resize-none leading-relaxed min-h-[300px] focus:outline-none prose prose-sm sm:prose-base dark:prose-invert max-w-none',
        spellcheck: 'true',
        autocorrect: 'on',
      },
      handleDOMEvents: {
        contextmenu: (_view, event) => {
          onEditorContextMenu(event)
          return true
        },
      },
      handlePaste: (_view, event) => {
        const file = getImageFromClipboardEvent(event)
        if (file) {
          event.preventDefault()
          handlePastedImage(file)
          return true
        }
        return false
      },
      handleKeyDown: (_view, event) => {
        const mod = event.ctrlKey || event.metaKey
        if (mod && event.key.toLowerCase() === 'a') {
          selectAllContent()
          return true
        }
        if (mod && event.shiftKey && event.key.toLowerCase() === 'c') {
          event.preventDefault()
          copyNoteContent(true)
          return true
        }
        return false
      },
    },
    onCreate({ editor: e }) {
      removeCopyHandler?.()
      removeCopyHandler = installRichCopyHandler(e)
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
  removeCopyHandler?.()
  removeCopyHandler = null
  
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
            <!-- Copy all -->
            <button
              type="button"
              title="Copy all (Ctrl+Shift+C)"
              @click="copyNoteContent(true)"
              class="hidden sm:flex w-10 h-10 rounded-full border border-border items-center justify-center text-foreground hover:bg-muted transition-all active:scale-90"
            >
              <ClipboardCopy class="h-4 w-4" />
            </button>

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

            <!-- OCR / paste loading overlay -->
            <Teleport to="body">
              <div
                v-if="isExtracting"
                class="fixed inset-0 z-[95] flex items-center justify-center bg-background/70 backdrop-blur-sm px-4"
              >
                <div class="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl px-6 py-5 text-center">
                  <Loader2 class="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                  <p class="text-sm font-semibold text-foreground">
                    {{ extractSource === 'paste' ? 'Please wait, pasting your screenshot…' : 'Converting image to text…' }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-1.5">This may take a few seconds</p>
                  <div class="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      class="h-full bg-primary transition-all duration-300"
                      :style="{ width: `${Math.max(extractProgress, 8)}%` }"
                    />
                  </div>
                </div>
              </div>
            </Teleport>

            <!-- Content editor -->
            <div
              ref="editorAreaRef"
              class="flex-1 flex flex-col relative"
              @touchstart.passive="onEditorTouchStart"
              @touchend="onEditorTouchEnd"
              @touchcancel="onEditorTouchEnd"
              @touchmove="onEditorTouchMove"
            >
              <editor-content :editor="editor" class="flex-1 flex flex-col [&>div]:flex-1" />
            </div>

            <input
              ref="imageInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleImageSelected"
            />

            <bubble-menu
              v-if="editor"
              :editor="editor"
              :options="{ placement: 'top' }"
              class="flex items-center bg-card border border-border shadow-xl rounded-xl overflow-hidden p-1 gap-1"
            >
              <!-- Desktop Pen Toggle -->
              <div v-if="!isMobile && !expandTools" class="flex items-center gap-1">
                <button @click="expandTools = true" class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center justify-center" title="Formatting tools">
                  <Pencil class="h-4 w-4" />
                </button>
                <button @click="copyNoteContent(false)" class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center justify-center" title="Copy selection">
                  <Copy class="h-4 w-4" />
                </button>
              </div>
              
              <!-- Tools -->
              <div v-show="isMobile || expandTools" class="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
                <button @click="selectAllContent()" class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-xs font-medium whitespace-nowrap" title="Select all (Ctrl+A)">
                  All
                </button>
                <button @click="copyNoteContent(false)" class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center justify-center" title="Copy">
                  <Copy class="h-4 w-4" />
                </button>
                <div class="w-px h-4 bg-border mx-1"></div>
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

        <!-- Context menu: upload or paste screenshot -->
        <Teleport to="body">
          <div
            v-if="contextMenu.show"
            class="fixed z-[100] min-w-[240px] max-w-[280px] rounded-xl border border-border bg-card shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150"
            :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
            @click.stop
          >
            <button
              type="button"
              class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
              @click="triggerImagePicker"
            >
              <Camera class="h-4 w-4 text-primary shrink-0" />
              <span>Upload image</span>
            </button>
            <p class="px-4 pb-2.5 pt-0 text-[11px] text-muted-foreground leading-snug">
              Or paste a screenshot with {{ isMobile ? 'long-press → Paste' : 'Ctrl+V' }} anywhere in this note
            </p>
          </div>
        </Teleport>
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
:deep(.tiptap pre) {
  background: hsl(var(--muted) / 0.5);
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre;
  margin-bottom: 0.75em;
}
:deep(.tiptap code) {
  background: hsl(var(--muted) / 0.6);
  border-radius: 0.25rem;
  padding: 0.1em 0.35em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875em;
}
:deep(.tiptap table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75em 0 1em;
  font-size: 0.8125rem;
  table-layout: auto;
}
:deep(.tiptap th),
:deep(.tiptap td) {
  border: 1px solid hsl(var(--border));
  padding: 0.5rem 0.75rem;
  text-align: left;
  vertical-align: top;
  min-width: 4rem;
}
:deep(.tiptap th) {
  background: hsl(var(--muted) / 0.5);
  font-weight: 600;
}
:deep(.tiptap td p),
:deep(.tiptap th p) {
  margin: 0;
}
</style>
