<script setup>
import { useOnline } from '@vueuse/core'
import { WifiOff } from 'lucide-vue-next'

const isOnline = useOnline()
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
      v-if="!isOnline"
      class="flex items-center justify-center gap-2 px-4 overflow-hidden shrink-0 select-none bg-amber-500 text-white py-1.5 text-xs font-bold tracking-wide cursor-default"
    >
      <WifiOff class="h-3.5 w-3.5 shrink-0" />
      <span class="text-xs">You are offline</span>
    </div>
  </Transition>
</template>
