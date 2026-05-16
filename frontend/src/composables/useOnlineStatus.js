import { useOnline } from '@vueuse/core'

export function useOnlineStatus() {
  return { isOnline: useOnline() }
}
