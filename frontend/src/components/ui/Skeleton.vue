<script setup>
defineProps({
  className: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div :class="['animate-pulse rounded-md bg-muted/40', className]"></div>
</template>
