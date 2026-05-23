<script setup>
import { onMounted } from 'vue'
import AppToast from '@/components/AppToast.vue'

onMounted(() => {
  const splash = document.getElementById('splash')
  if (splash) {
    // Let the bounce animation run for 2 seconds, then zoom in to screen
    setTimeout(() => {
      splash.classList.add('zoom-out')
      // Remove it from the DOM after the CSS transition duration
      setTimeout(() => {
        splash.remove()
      }, 600)
    }, 2000)
  }
})
</script>

<template>
  <RouterView />
  <AppToast />
</template>
