import { ref, inject, onMounted, onUnmounted } from 'vue'

// Module-level ref shared between AppLayout (provider) and pages (consumers)
export const pageAddAction = ref(null)

/**
 * Called by page views to register their "add" action for the mobile + button.
 */
export function useRegisterAddAction(fn) {
  onMounted(() => { pageAddAction.value = fn })
  onUnmounted(() => { pageAddAction.value = null })
}
