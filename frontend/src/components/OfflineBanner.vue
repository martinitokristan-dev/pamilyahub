<script setup>
import { useOnline } from '@vueuse/core'
import { WifiOff, AlertCircle, RefreshCw } from 'lucide-vue-next'
import { hasFailedEntries, retryFailedEntries } from '@/lib/syncEngine.js'
import { ref } from 'vue'

const isOnline = useOnline()
const isRetrying = ref(false)

async function handleRetry() {
  if (isRetrying.value) return
  isRetrying.value = true
  try {
    await retryFailedEntries()
  } catch (e) {
    console.error('Retry failed', e)
  } finally {
    isRetrying.value = false
  }
}
</script>

<template>
  <div class="flex flex-col shrink-0 select-none">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-12"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 max-h-12"
      leave-to-class="opacity-0 max-h-0"
    >
      <div
        v-if="!isOnline"
        class="flex items-center justify-center gap-2 px-4 overflow-hidden shrink-0 bg-amber-500 text-white py-1.5 text-xs font-bold tracking-wide cursor-default"
      >
        <WifiOff class="h-3.5 w-3.5 shrink-0" />
        <span class="text-xs">You are offline</span>
      </div>
    </Transition>

    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-12"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 max-h-12"
      leave-to-class="opacity-0 max-h-0"
    >
      <div
        v-if="isOnline && hasFailedEntries"
        @click="handleRetry"
        class="flex items-center justify-center gap-2 px-4 overflow-hidden shrink-0 bg-red-600 hover:bg-red-700 text-white py-1.5 text-xs font-bold tracking-wide cursor-pointer transition-colors duration-200"
      >
        <AlertCircle v-if="!isRetrying" class="h-3.5 w-3.5 shrink-0" />
        <RefreshCw v-else class="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span class="text-xs">Some items failed to sync. Tap to retry.</span>
      </div>
    </Transition>
  </div>
</template>

