<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { useNotesStore } from '@/stores/notes.js'
import { Plus, Pencil, Trash2, X, NotebookPen, Search } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiTextarea from '@/components/ui/Textarea.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'

const store = useNotesStore()
const showForm = ref(false)
const editing = ref(null)
const form = ref({ title: '', content: '' })
const searchQuery = ref('')

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
  showForm.value = true
}

function openEdit(note) {
  editing.value = note
  form.value = { title: note.title, content: note.content }
  showForm.value = true
}

async function submit() {
  if (editing.value) {
    await store.update(editing.value.id, form.value)
  } else {
    await store.create(form.value)
  }
  showForm.value = false
}
</script>

<template>
  <div class="p-4 sm:p-6 max-w-6xl mx-auto animate-fade-in pb-6">
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

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <UiCard
        v-for="note in filteredNotes"
        :key="note.id"
        class="flex flex-col gap-0 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between gap-2 p-4 pb-2">
          <h3 class="font-semibold leading-tight line-clamp-1">{{ note.title }}</h3>
          <div class="flex gap-1 shrink-0">
            <UiButton variant="ghost" size="icon" class="h-7 w-7" @click="openEdit(note)">
              <Pencil class="h-3.5 w-3.5" />
            </UiButton>
            <UiButton variant="ghost" size="icon" class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" @click="store.remove(note.id)">
              <Trash2 class="h-3.5 w-3.5" />
            </UiButton>
          </div>
        </div>
        <div class="px-4 pb-4 flex-1 flex flex-col">
          <p class="text-sm text-muted-foreground line-clamp-4 flex-1">{{ note.content }}</p>
          <p class="text-xs text-muted-foreground/60 mt-3">{{ new Date(note.updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) }}</p>
        </div>
      </UiCard>
    </div>

    <Teleport to="body">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" @mousedown.self="showForm = false">
        <UiCard class="w-full sm:max-w-lg shadow-xl animate-fade-in rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 pb-4 sticky top-0 bg-card border-b border-border">
            <h2 class="text-lg font-semibold">{{ editing ? 'Edit Note' : 'New Note' }}</h2>
            <UiButton variant="ghost" size="icon" @click="showForm = false"><X class="h-4 w-4" /></UiButton>
          </div>
          <UiCardContent class="p-5">
            <form @submit.prevent="submit" class="space-y-4">
              <div class="space-y-1.5">
                <UiLabel>Title</UiLabel>
                <UiInput v-model="form.title" placeholder="Note title" required />
              </div>
              <div class="space-y-1.5">
                <UiLabel>Content</UiLabel>
                <UiTextarea v-model="form.content" class="min-h-[140px]" placeholder="Write your note…" required />
              </div>
              <div class="flex justify-end gap-2 pt-2">
                <UiButton type="button" variant="outline" @click="showForm = false">Cancel</UiButton>
                <UiButton type="submit" :disabled="store.loading">
                  {{ store.loading ? 'Saving…' : (editing ? 'Save changes' : 'Create note') }}
                </UiButton>
              </div>
            </form>
          </UiCardContent>
        </UiCard>
      </div>
    </Teleport>
  </div>
</template>
