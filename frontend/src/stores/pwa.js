import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePwaStore = defineStore('pwa', () => {
  const needRefresh = ref(false)
  const isUpdating = ref(false)
  
  // This will be overridden by AppLayout to hold the actual update function
  const updateServiceWorker = ref(null)
  
  function setNeedRefresh(value) {
    needRefresh.value = value
  }
  
  async function triggerUpdate() {
    isUpdating.value = true
    if (updateServiceWorker.value) {
      await updateServiceWorker.value(true)
    }
  }

  return { 
    needRefresh, 
    isUpdating, 
    updateServiceWorker, 
    setNeedRefresh, 
    triggerUpdate 
  }
})
