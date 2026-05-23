<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  let idToken = null
  let error = null

  try {
    // Keep existing token extraction from window.location.hash unchanged
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    idToken = params.get('id_token')
    error = params.get('error')

    // BroadcastChannel as the primary action after extracting token
    try {
      const channel = new BroadcastChannel('google_auth_channel')
      channel.postMessage({ idToken, error: error ?? null })
      channel.close()
    } catch (bcError) {
      console.warn('[GoogleCallback] BroadcastChannel error:', bcError)
    }

    // window.opener.postMessage as fallback inside try/catch
    try {
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH', idToken, error: error ?? null },
          window.location.origin,
        )
      }
    } catch (popupError) {
      console.warn('[GoogleCallback] window.opener.postMessage error:', popupError)
    }
  } catch (err) {
    console.error('[GoogleCallback] Authentication parsing error:', err)
    // Fallback broadcast/postMessage with error
    try {
      const channel = new BroadcastChannel('google_auth_channel')
      channel.postMessage({ idToken: null, error: 'parse_error' })
      channel.close()
    } catch {}
    try {
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH', idToken: null, error: 'parse_error' },
          window.location.origin,
        )
      }
    } catch {}
  } finally {
    // Always call window.close() in the finally block
    window.close()
  }
})
</script>

<template><div></div></template>
