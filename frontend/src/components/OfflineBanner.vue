<script setup>
import { computed } from 'vue'
import { useOnline } from '@vueuse/core'
import { pendingCount, isSyncing, drainOutbox } from '@/lib/syncEngine.js'
import { WifiOff, RefreshCw } from 'lucide-vue-next'

const isOnline = useOnline()
const show = computed(() => !isOnline.value || isSyncing.value || pendingCount.value > 0)
const isOffline = computed(() => !isOnline.value)

const label = computed(() => {
  if (!isOnline.value) {
    return pendingCount.value > 0
      ? `Offline — ${pendingCount.value} change${pendingCount.value !== 1 ? 's' : ''} pending sync`
      : 'You are offline'
  }
  if (isSyncing.value) {
    return `Syncing ${pendingCount.value} change${pendingCount.value !== 1 ? 's' : ''}…`
  }
  if (pendingCount.value > 0) {
    return `${pendingCount.value} pending change${pendingCount.value !== 1 ? 's' : ''} — tap to sync`
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
    enter-to-class="opacity-100 max-h-10"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 max-h-10"
    leave-to-class="opacity-0 max-h-0"
  >
    <div
      v-if="show"
      class="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-bold tracking-wide overflow-hidden shrink-0 cursor-default select-none"
      :class="isOffline ? 'bg-amber-500 text-white' : 'bg-primary/90 text-primary-foreground'"
      @click="handleClick"
    >
      <RefreshCw v-if="isSyncing && isOnline" class="h-3 w-3 animate-spin shrink-0" />
      <WifiOff v-else-if="isOffline" class="h-3 w-3 shrink-0" />
      <span>{{ label }}</span>
    </div>
  </Transition>
</template>
