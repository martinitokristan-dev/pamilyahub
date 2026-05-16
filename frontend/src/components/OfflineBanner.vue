<script setup>
import { computed } from 'vue'
import { useOnline } from '@vueuse/core'
import { pendingCount, isSyncing, drainOutbox } from '@/lib/syncEngine.js'
import { WifiOff, RefreshCw } from 'lucide-vue-next'

const isOnline = useOnline()
const show = computed(() => !isOnline.value || pendingCount.value > 0)
const isOffline = computed(() => !isOnline.value)

const label = computed(() => {
  if (!isOnline.value) {
    // When offline, don't show pending count to avoid annoying the user
    return 'You are offline'
  }
  if (pendingCount.value > 0) {
    return `${pendingCount.value} pending — tap to sync`
  }
  return ''
})

function handleClick() {
  if (isOnline.value && pendingCount.value > 0 && !isSyncing.value) {
    drainOutbox()
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 max-h-0"
    enter-to-class="opacity-100 max-h-12"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 max-h-12"
    leave-to-class="opacity-0 max-h-0"
  >
    <div
      v-if="show"
      class="flex items-center justify-center gap-2 px-4 overflow-hidden shrink-0 select-none"
      :class="isOffline
        ? 'bg-amber-500 text-white py-1.5 text-xs font-bold tracking-wide cursor-default'
        : 'bg-background border-b border-border text-foreground py-1.5 text-xs font-medium cursor-pointer'"
      @click="handleClick"
    >
      <WifiOff v-if="isOffline" class="h-3.5 w-3.5 shrink-0" />
      <RefreshCw v-else class="h-3 w-3 shrink-0 text-primary" />
      <span class="text-xs">{{ label }}</span>
    </div>
  </Transition>
</template>
