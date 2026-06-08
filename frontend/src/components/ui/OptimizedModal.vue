<script setup>
import { onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    required: true
  },
  size: {
    type: String,
    default: 'md', // sm, md, lg
    validator: (val) => ['sm', 'md', 'lg'].includes(val)
  },
  mobileFullScreen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'backdrop-click'])

const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    emit('backdrop-click')
    emit('close')
  }
}

// Prevent body scroll when modal is open
onMounted(() => {
  if (props.show) {
    document.body.style.overflow = 'hidden'
  }
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-optimized"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-optimized"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 modal-container"
        @click="handleBackdropClick"
      >
        <Transition
          enter-active-class="transition-optimized"
          :enter-from-class="mobileFullScreen ? 'translate-y-full' : 'max-sm:translate-y-full sm:scale-95 sm:opacity-0'"
          enter-to-class="translate-y-0 scale-100 opacity-100"
          leave-active-class="transition-optimized"
          leave-from-class="translate-y-0 scale-100 opacity-100"
          :leave-to-class="mobileFullScreen ? 'translate-y-full' : 'max-sm:translate-y-full sm:scale-95 sm:opacity-0'"
        >
          <div
            v-if="show"
            class="flex flex-col bg-background shadow-2xl border-0 overflow-hidden modal-container transform-gpu"
            :class="[
              mobileFullScreen 
                ? 'w-full h-[100dvh] max-h-[100dvh] rounded-none'
                : 'w-full max-sm:h-[85dvh] max-sm:rounded-t-3xl max-sm:rounded-b-none sm:rounded-3xl sm:max-h-[90vh]',
              size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'
            ]"
            @click.stop
          >
            <slot />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
