<script setup>
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import DatePicker from '@/components/ui/DatePicker.vue'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  dateFrom: {
    type: String,
    default: ''
  },
  dateTo: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: 'Filter log'
  },
  description: {
    type: String,
    default: ''
  },
  infoText: {
    type: String,
    default: ''
  },
  zIndex: {
    type: Number,
    default: 70
  }
})

const emit = defineEmits(['update:show', 'update:dateFrom', 'update:dateTo', 'apply', 'clear'])

const localShow = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const localDateFrom = computed({
  get: () => props.dateFrom,
  set: (val) => emit('update:dateFrom', val)
})

const localDateTo = computed({
  get: () => props.dateTo,
  set: (val) => emit('update:dateTo', val)
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-4"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-4"
  >
    <div v-if="localShow" class="fixed inset-0" :style="{ zIndex: zIndex }">
      <div class="absolute inset-0 bg-black/30" @click="localShow = false"></div>
      <div 
        class="fixed bottom-0 inset-x-0 rounded-t-[1.75rem] bg-card/95 backdrop-blur-2xl border-t border-border/50 shadow-[0_-20px_60px_rgba(0,0,0,0.3)] px-6 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] max-w-md mx-auto"
        :style="{ zIndex: zIndex + 1 }"
      >
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-base font-bold text-foreground">{{ title }}</h3>
          <button
            type="button"
            class="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40"
            @click="localShow = false"
            aria-label="Close filter"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
        
        <p v-if="description" class="text-sm text-muted-foreground leading-relaxed mb-4">
          {{ description }}
        </p>

        <div class="space-y-3">
          <div class="space-y-1.5">
            <span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">From</span>
            <DatePicker v-model="localDateFrom" sheet-style placeholder="Start date" />
          </div>
          <div class="space-y-1.5">
            <span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">To</span>
            <DatePicker v-model="localDateTo" sheet-style placeholder="End date" />
          </div>
          <p v-if="infoText" class="text-[11px] text-muted-foreground italic pt-0.5">{{ infoText }}</p>
        </div>

        <div class="mt-5 flex flex-col gap-2">
          <UiButton class="h-11 rounded-xl font-semibold" @click="emit('apply')">Apply</UiButton>
          <button
            type="button"
            class="text-xs font-semibold text-muted-foreground hover:text-foreground"
            @click="emit('clear')"
          >
            Clear Filter
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
