import { ref, inject, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'

// Module-level ref shared between AppLayout (provider) and pages (consumers)
export const pageAddAction = ref(null)

/**
 * Called by page views to register their "add" action for the mobile + button.
 * Uses onActivated/onDeactivated to work with KeepAlive in AppLayout.
 */
export function useRegisterAddAction(fn) {
  onMounted(() => { pageAddAction.value = fn })
  onActivated(() => { pageAddAction.value = fn })
  onDeactivated(() => { pageAddAction.value = null })
  onUnmounted(() => { pageAddAction.value = null })
}
