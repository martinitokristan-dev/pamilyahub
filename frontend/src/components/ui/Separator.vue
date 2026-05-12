<script setup>
import { cn } from '@/lib/utils.js'
const props = defineProps({
  class: { type: String, default: '' },
  orientation: { type: String, default: 'horizontal' },
})
</script>
<template>
  <div
    :class="cn(
      'shrink-0 bg-border',
      props.orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      props.class
    )"
  />
</template>
