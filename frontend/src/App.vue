<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  const splash = document.getElementById('splash')
  if (splash) {
    // Let the pulse animation run for a moment, then zoom in to screen
    setTimeout(() => {
      splash.classList.add('zoom-out')
      // Remove it from the DOM after the CSS transition duration
      setTimeout(() => {
        splash.remove()
      }, 600)
    }, 1000)
  }
})
</script>

<template>
  <RouterView />
</template>
