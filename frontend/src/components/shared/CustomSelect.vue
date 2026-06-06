<script setup>
import { ref, computed } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'
import { onClickOutside } from '@vueuse/core'

const props = defineProps({
  modelValue: {
    type: [String, Number, null],
    default: null
  },
  options: {
    type: Array,
    required: true,
    // Expected format: [{ label: 'Option 1', value: 'opt1', iconUrl: '...' }]
  },
  placeholder: {
    type: String,
    default: 'Select an option'
  },
  // Allows overriding the trigger button's styles if needed in different contexts (like Archive page vs Modals)
  triggerClass: {
    type: String,
    default: 'appearance-none bg-muted/50 border-0 text-foreground text-sm rounded-lg px-3 h-11 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer w-full transition-colors hover:bg-muted/80'
  }
})

const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const selectContainer = ref(null)

onClickOutside(selectContainer, () => {
  isOpen.value = false
})

const selectedOption = computed(() => {
  return props.options.find(opt => String(opt.value) === String(props.modelValue))
})

const displayValue = computed(() => {
  return selectedOption.value ? selectedOption.value.label : props.placeholder
})

function selectOption(value) {
  emit('update:modelValue', value)
  isOpen.value = false
}
</script>

<template>
  <div ref="selectContainer" class="relative w-full" :class="isOpen ? 'z-[60]' : 'z-40'">
    <button
      type="button"
      @click="isOpen = !isOpen"
      class="flex items-center justify-between"
      :class="triggerClass"
    >
      <div class="flex items-center gap-2 overflow-hidden pr-2">
        <img v-if="selectedOption?.iconUrl" :src="selectedOption.iconUrl" class="h-5 w-5 rounded object-contain shrink-0 bg-white/20" @error="$event.target.style.display='none'" />
        <span class="truncate">{{ displayValue }}</span>
      </div>
      <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" :class="{ 'rotate-180': isOpen }" />
    </button>

    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div v-if="isOpen" class="absolute z-50 mt-1 w-full bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-lg overflow-hidden py-1 max-h-56 overflow-y-auto">
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          @click="selectOption(option.value)"
          class="w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-muted/80 flex items-center justify-between"
          :class="{ 'font-semibold text-primary bg-primary/5': String(modelValue) === String(option.value) }"
        >
          <div class="flex items-center gap-2 overflow-hidden pr-2">
            <img v-if="option.iconUrl" :src="option.iconUrl" class="h-5 w-5 rounded object-contain shrink-0 bg-white/20" @error="$event.target.style.display='none'" />
            <span class="truncate">{{ option.label }}</span>
          </div>
          <Check v-if="String(modelValue) === String(option.value)" class="h-4 w-4 shrink-0 text-primary" />
        </button>
      </div>
    </transition>
  </div>
</template>
