import { ref } from 'vue'

const toasts = ref([])

// Shared flag — toggled by AiChat.vue so toasts are suppressed while chatbot is open
export const chatOpen = ref(false)

export function useToast() {
  function addToast(title, subtitle = '', type = 'success', options = {}) {
    // Don't show toasts when the chatbot is active; the chatbot already
    // displays its own inline success messages for every action.
    if (chatOpen.value) return

    const id = Date.now() + Math.random().toString()
    toasts.value.push({ id, title, subtitle, type, ...options })
    
    const duration = options.duration !== undefined ? options.duration : 3000
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    success: (title, subtitle = '', options = {}) => addToast(title, subtitle, 'success', options),
    wallet: (title, subtitle = '', options = {}) => addToast(title, subtitle, 'wallet', options),
    salary: (title, subtitle = '', options = {}) => addToast(title, subtitle, 'salary', options),
    expense: (title, subtitle = '', options = {}) => addToast(title, subtitle, 'expense', options),
    debt: (title, subtitle = '', options = {}) => addToast(title, subtitle, 'debt', options),
    offline: (title, subtitle = '', options = {}) => addToast(title, subtitle, 'offline', options),
    delete: (title, subtitle = '', options = {}) => addToast(title, subtitle, 'delete', options),
    session: (title, subtitle = '', options = {}) => addToast(title, subtitle, 'session', options),
    avatar: (title, subtitle = '', options = {}) => addToast(title, subtitle, 'avatar', options),
    error: (title, subtitle = '', options = {}) => addToast(title, subtitle, 'error', options),
    info: (title, subtitle = '', options = {}) => addToast(title, subtitle, 'info', options),
    removeToast,
  }
}
