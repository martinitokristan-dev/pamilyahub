<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  try {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const idToken = params.get('id_token')
    const error = params.get('error')

    if (window.opener) {
      window.opener.postMessage(
        { type: 'GOOGLE_AUTH', idToken, error: error ?? null },
        window.location.origin,
      )
    }
  } catch {
    if (window.opener) {
      window.opener.postMessage(
        { type: 'GOOGLE_AUTH', idToken: null, error: 'parse_error' },
        window.location.origin,
      )
    }
  } finally {
    window.close()
  }
})
</script>

<template><div></div></template>
