<script setup>
import { computed } from 'vue'
import UiButton from '@/components/ui/Button.vue'
import { BellRing } from 'lucide-vue-next'

const props = defineProps({
  show: Boolean,
  title: {
    type: String,
    default: 'Enable Reminders'
  },
  message: {
    type: String,
    default: 'Never miss a payment! Receive timely push notifications 7 days and 2 days before a plan is due.'
  }
})

const emit = defineEmits(['enable', 'skip', 'cancel'])
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
            
            <div class="p-5 text-center flex flex-col items-center space-y-3 w-full">
              <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <BellRing class="w-6 h-6" />
              </div>
              <div>
                <h3 class="text-[17px] font-semibold text-foreground tracking-tight">{{ title }}</h3>
                <p class="text-[13px] text-muted-foreground leading-snug px-2 mt-1">{{ message }}</p>
              </div>
            </div>

            <div class="w-full flex flex-col px-8 pb-6 pt-0 gap-2.5">
              <UiButton 
                variant="default"
                class="w-full font-semibold rounded-[10px]"
                @click="emit('enable')"
              >
                Enable Notifications
              </UiButton>
              <UiButton 
                variant="ghost"
                class="w-full text-muted-foreground hover:bg-transparent"
                @click="emit('skip')"
              >
                Not Now
              </UiButton>
            </div>

          </div>
        </transition>

      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
button {
  -webkit-font-smoothing: antialiased;
}
</style>
