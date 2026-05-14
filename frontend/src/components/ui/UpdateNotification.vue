<script setup>
import { RefreshCw, X } from 'lucide-vue-next'
import Button from './Button.vue'

const props = defineProps({
  offlineReady: Boolean,
  needRefresh: Boolean,
})

const emit = defineEmits(['update', 'close'])

const close = () => {
  emit('close')
}

const update = () => {
  emit('update')
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-10 scale-95"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-10 scale-95"
  >
    <div
      v-if="offlineReady || needRefresh"
      class="fixed bottom-24 left-4 right-4 z-[100] lg:bottom-6 lg:right-6 lg:left-auto lg:w-96"
    >
      <div class="bg-card/95 backdrop-blur-2xl border border-border shadow-2xl rounded-2xl p-4 flex flex-col gap-3">
        <div class="flex items-start justify-between">
          <div class="flex gap-3">
            <div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <RefreshCw class="h-5 w-5" :class="{ 'animate-spin': needRefresh }" />
            </div>
            <div>
              <h3 class="font-bold text-sm text-foreground">
                {{ needRefresh ? 'Update Available' : 'Ready to work offline' }}
              </h3>
              <p class="text-xs text-muted-foreground mt-0.5">
                {{ needRefresh ? 'A new version of EleFam is available. Update now to get the latest features.' : 'App is ready to be used offline.' }}
              </p>
            </div>
          </div>
          <button 
            @click="close"
            class="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <div v-if="needRefresh" class="flex gap-2">
          <Button 
            size="sm" 
            class="flex-1 gap-2"
            @click="update"
          >
            <RefreshCw class="h-3.5 w-3.5" />
            Update Now
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            @click="close"
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>
