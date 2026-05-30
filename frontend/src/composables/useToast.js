import { ref } from 'vue'

const toasts = ref([])

// Shared flag — toggled by AiChat.vue so toasts are suppressed while chatbot is open
export const chatOpen = ref(false)

export function useToast() {
  function addToast(title, subtitle = '', type = 'success') {
    // Don't show toasts when the chatbot is active; the chatbot already
    // displays its own inline success messages for every action.
    if (chatOpen.value) return

    const id = Date.now() + Math.random().toString()
    toasts.value.push({ id, title, subtitle, type })
    setTimeout(() => removeToast(id), 3000)
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    success: (title, subtitle = '') => addToast(title, subtitle, 'success'),
    wallet: (title, subtitle = '') => addToast(title, subtitle, 'wallet'),
    salary: (title, subtitle = '') => addToast(title, subtitle, 'salary'),
    expense: (title, subtitle = '') => addToast(title, subtitle, 'expense'),
    debt: (title, subtitle = '') => addToast(title, subtitle, 'debt'),
    offline: (title, subtitle = '') => addToast(title, subtitle, 'offline'),
    delete: (title, subtitle = '') => addToast(title, subtitle, 'delete'),
    session: (title, subtitle = '') => addToast(title, subtitle, 'session'),
    avatar: (title, subtitle = '') => addToast(title, subtitle, 'avatar'),
    error: (title, subtitle = '') => addToast(title, subtitle, 'error'),
    info: (title, subtitle = '') => addToast(title, subtitle, 'info'),
    removeToast,
  }
}
