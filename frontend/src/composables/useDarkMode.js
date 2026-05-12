import { ref } from 'vue'

// Module-level singleton so all components share the same state
const isDark = ref(document.documentElement.classList.contains('dark'))

export function useDarkMode() {
  function toggle() {
    isDark.value = !isDark.value
    if (isDark.value) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return { isDark, toggle }
}
