<script setup>
import { Wallet } from 'lucide-vue-next'

defineProps({
  title: {
    type: String,
    default: 'No transactions found.'
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: [Object, Function],
    default: Wallet
  },
  dashed: {
    type: Boolean,
    default: false
  }
})
</script>

<template>
  <div 
    class="flex flex-col items-center justify-center text-center p-10 text-muted-foreground w-full"
    :class="dashed ? 'py-24 border rounded-xl border-dashed bg-muted/20' : ''"
  >
    <component :is="icon" class="h-10 w-10 text-muted-foreground/40 mb-3" />
    <p class="text-sm font-medium text-muted-foreground">{{ title }}</p>
    <p v-if="description" class="text-xs text-muted-foreground mt-1">{{ description }}</p>
    <slot />
  </div>
</template>
