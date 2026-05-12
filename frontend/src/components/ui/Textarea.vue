<script setup>
import { cn } from '@/lib/utils.js'

const props = defineProps({
  class: { type: String, default: '' },
  modelValue: { default: '' },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <textarea
    :class="cn(
      'flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y',
      props.class
    )"
    :value="modelValue"
    @input="emit('update:modelValue', $event.target.value)"
    v-bind="$attrs"
  />
</template>
