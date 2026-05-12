<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Select date' },
})
const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const showYearPicker = ref(false)
const yearListRef = ref(null)

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa']
const YEAR_FROM = 1990

function parseDate(str) {
  if (!str) return null
  const parts = str.split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0])) return null
  return { year: parts[0], month: parts[1] - 1, day: parts[2] }
}

const selected = computed(() => parseDate(props.modelValue))

watch(
  () => props.modelValue,
  (val) => {
    const d = parseDate(val)
    if (d) { viewYear.value = d.year; viewMonth.value = d.month }
  },
  { immediate: true },
)

const displayValue = computed(() => {
  const d = parseDate(props.modelValue)
  if (!d) return ''
  return new Date(d.year, d.month, d.day).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
})

const calendarCells = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1).getDay()
  const total = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  const cells = Array(first).fill(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  return cells
})

function isToday(day) {
  return (
    day !== null &&
    day === today.getDate() &&
    viewMonth.value === today.getMonth() &&
    viewYear.value === today.getFullYear()
  )
}

function isSelected(day) {
  if (day === null || !selected.value) return false
  return (
    day === selected.value.day &&
    viewMonth.value === selected.value.month &&
    viewYear.value === selected.value.year
  )
}

function selectDay(day) {
  if (!day) return
  const m = String(viewMonth.value + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  emit('update:modelValue', `${viewYear.value}-${m}-${d}`)
  isOpen.value = false
}

function goToday() {
  viewYear.value = today.getFullYear()
  viewMonth.value = today.getMonth()
  selectDay(today.getDate())
}

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}

function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

const yearRange = computed(() => {
  const arr = []
  for (let y = YEAR_FROM; y <= today.getFullYear() + 10; y++) arr.push(y)
  return arr
})

function openYearPicker() {
  showYearPicker.value = true
  nextTick(() => {
    if (yearListRef.value) {
      const idx = viewYear.value - YEAR_FROM
      yearListRef.value.scrollTop = Math.max(0, idx * 44 - 88)
    }
  })
}

function selectYear(y) {
  viewYear.value = y
  showYearPicker.value = false
}

function open() {
  const d = parseDate(props.modelValue)
  if (d) { viewYear.value = d.year; viewMonth.value = d.month }
  else { viewYear.value = today.getFullYear(); viewMonth.value = today.getMonth() }
  showYearPicker.value = false
  isOpen.value = true
}
</script>

<template>
  <div class="relative">
    <!-- Trigger -->
    <button
      type="button"
      @click="open"
      class="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm text-left transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      :class="displayValue ? 'text-foreground' : 'text-muted-foreground'"
    >
      <CalendarDays class="h-4 w-4 shrink-0 text-muted-foreground" />
      <span class="flex-1 truncate">{{ displayValue || placeholder }}</span>
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-6"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-6"
      >
        <div
          v-if="isOpen"
          class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          @mousedown.self="isOpen = false"
        >
          <div class="w-full sm:max-w-xs bg-background rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">

            <!-- ── Year picker ── -->
            <div v-if="showYearPicker" class="flex flex-col">
              <div class="flex items-center justify-between px-5 pt-5 pb-3">
                <span class="text-base font-semibold">Select Year</span>
                <button
                  type="button"
                  @click="showYearPicker = false"
                  class="text-sm font-semibold text-primary"
                >Done</button>
              </div>
              <div
                ref="yearListRef"
                class="grid grid-cols-4 gap-1.5 px-4 pb-6 max-h-72 overflow-y-auto"
              >
                <button
                  v-for="y in yearRange"
                  :key="y"
                  type="button"
                  @click="selectYear(y)"
                  class="rounded-xl py-2.5 text-sm font-medium transition-all"
                  :class="y === viewYear
                    ? 'bg-primary text-primary-foreground shadow-md scale-105'
                    : 'hover:bg-muted text-foreground'"
                >{{ y }}</button>
              </div>
            </div>

            <!-- ── Calendar view ── -->
            <div v-else class="p-5">
              <!-- Handle bar (mobile only) -->
              <div class="flex justify-center mb-4 sm:hidden">
                <div class="h-1 w-12 rounded-full bg-muted-foreground/30" />
              </div>

              <!-- Month / Year header -->
              <div class="flex items-center justify-between mb-5">
                <button
                  type="button"
                  @click="prevMonth"
                  class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  <ChevronLeft class="h-4 w-4" />
                </button>

                <button
                  type="button"
                  @click="openYearPicker"
                  class="text-[15px] font-semibold px-3 py-1 rounded-xl hover:bg-muted transition-colors"
                >
                  {{ MONTHS[viewMonth] }} {{ viewYear }}
                </button>

                <button
                  type="button"
                  @click="nextMonth"
                  class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  <ChevronRight class="h-4 w-4" />
                </button>
              </div>

              <!-- Day-of-week labels -->
              <div class="grid grid-cols-7 mb-1">
                <div
                  v-for="dl in DAY_LABELS"
                  :key="dl"
                  class="text-center text-[11px] font-semibold text-muted-foreground py-1"
                >{{ dl }}</div>
              </div>

              <!-- Day cells -->
              <div class="grid grid-cols-7 gap-y-0.5">
                <div v-for="(day, i) in calendarCells" :key="i" class="flex justify-center">
                  <button
                    v-if="day !== null"
                    type="button"
                    @click="selectDay(day)"
                    class="relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all duration-150 select-none active:scale-95"
                    :class="[
                      isSelected(day)
                        ? 'bg-primary text-primary-foreground shadow-lg scale-110 font-bold'
                        : isToday(day)
                          ? 'text-primary font-bold hover:bg-primary/10'
                          : 'hover:bg-muted text-foreground',
                    ]"
                  >
                    {{ day }}
                    <!-- Today dot -->
                    <span
                      v-if="isToday(day) && !isSelected(day)"
                      class="absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary"
                    />
                  </button>
                  <div v-else class="h-10 w-10" />
                </div>
              </div>

              <!-- Today shortcut -->
              <div class="mt-4 pt-3 border-t border-border flex items-center justify-center">
                <button
                  type="button"
                  @click="goToday"
                  class="text-sm font-semibold text-primary hover:underline"
                >Today</button>
              </div>
            </div>

          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
