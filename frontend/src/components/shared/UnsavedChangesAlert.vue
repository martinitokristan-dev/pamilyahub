<script setup>
import { computed } from 'vue'
import UiButton from '@/components/ui/Button.vue'
const props = defineProps({
  show: Boolean,
  title: {
    type: String,
    default: 'Unsaved Changes'
  },
  message: {
    type: String,
    default: 'You have unsaved changes. Do you want to save or discard them?'
  }
})

const emit = defineEmits(['save', 'discard', 'cancel'])

</script>

<template>
  <Teleport to="body">
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" @mousedown.self="emit('cancel')">
        
        <transition
          enter-active-class="transition ease-out duration-300"
          enter-from-class="opacity-0 scale-95 translate-y-4"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition ease-in duration-200"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-4"
        >
          <div v-if="show" class="bg-card/95 backdrop-blur-xl w-full max-w-[320px] rounded-[15px] shadow-2xl overflow-hidden flex flex-col items-center">
            
            <div class="p-5 text-center flex flex-col items-center space-y-1 w-full">
              <h3 class="text-[17px] font-semibold text-foreground tracking-tight">{{ title }}</h3>
              <p class="text-[13px] text-muted-foreground leading-snug px-2">{{ message }}</p>
            </div>

            <div class="w-full flex gap-3 p-4 pt-0">
              <UiButton 
                variant="secondary"
                class="flex-1"
                @click="emit('discard')"
              >
                Discard Changes
              </UiButton>
              <UiButton 
                variant="default"
                class="flex-1"
                @click="emit('save')"
              >
                Save Changes
              </UiButton>
            </div>

          </div>
        </transition>

      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* Adjust iOS style font rendering for the alert */
button {
  -webkit-font-smoothing: antialiased;
}
</style>
