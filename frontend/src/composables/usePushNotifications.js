import { ref } from 'vue'
import api from '@/lib/axios.js'
import { useToast } from './useToast.js'

export function usePushNotifications() {
  const toast = useToast()
  const isSupported = ref('serviceWorker' in navigator && 'PushManager' in window)
  const isSubscribed = ref(false)
  const isUpdating = ref(false)
  let vapidPublicKey = null

  // Utility to convert Base64 URL to Uint8Array
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  const checkStatus = async () => {
    if (!isSupported.value) return

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      const endpoint = subscription ? subscription.endpoint : null

      const response = await api.get('/push/status', {
        params: { endpoint }
      })
      
      isSubscribed.value = response.data.data.subscribed
      vapidPublicKey = response.data.data.vapid_public
      
      // If we have a local subscription but backend says no, clear it locally
      if (subscription && !isSubscribed.value) {
        await subscription.unsubscribe()
      }
    } catch (e) {
      console.error('Failed to check push status', e)
    }
  }

  const subscribe = async () => {
    if (!isSupported.value) {
      toast.error('Push notifications are not supported by your browser')
      return
    }

    isUpdating.value = true
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error('Permission denied for notifications')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })

      const subData = JSON.parse(JSON.stringify(subscription))

      await api.post('/push/subscribe', {
        endpoint: subData.endpoint,
        p256dh_key: subData.keys.p256dh,
        auth_key: subData.keys.auth
      })

      isSubscribed.value = true
      toast.success('Successfully subscribed to reminders')
    } catch (e) {
      console.error('Failed to subscribe to push', e)
      toast.error('Failed to enable notifications')
    } finally {
      isUpdating.value = false
    }
  }

  const unsubscribe = async () => {
    isUpdating.value = true
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      if (subscription) {
        await api.post('/push/unsubscribe', { endpoint: subscription.endpoint })
        await subscription.unsubscribe()
      }
      
      isSubscribed.value = false
      toast.success('Unsubscribed from reminders')
    } catch (e) {
      console.error('Failed to unsubscribe', e)
      toast.error('Failed to disable notifications')
    } finally {
      isUpdating.value = false
    }
  }

  return {
    isSupported,
    isSubscribed,
    isUpdating,
    checkStatus,
    subscribe,
    unsubscribe
  }
}
