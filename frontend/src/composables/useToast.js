import { ref } from 'vue'

const toasts = ref([])

export function useToast() {
  function addToast(message, type = 'success') {
    const id = Date.now() + Math.random().toString()
    toasts.value.push({ id, message, type })
    setTimeout(() => removeToast(id), 3000)
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
  }
}
