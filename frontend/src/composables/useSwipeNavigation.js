import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useModalsStore } from '@/stores/modals.js'

const EDGE_THRESHOLD = 36
const SWIPE_MIN = 72
const SWIPE_MAX_VERTICAL = 80

const SUB_PAGE_PATHS = ['/guide', '/faq', '/archives']

function isAnyModalOpen(modals) {
  return modals.isExpenseModalOpen
    || modals.isWalletModalOpen
    || modals.isDebtModalOpen
    || modals.isNoteModalOpen
    || modals.isFileModalOpen
    || modals.isDepositModalOpen
    || modals.isTransferModalOpen
}

function closeTopModal(modals) {
  if (modals.isExpenseModalOpen) { modals.closeExpenseModal(); return true }
  if (modals.isWalletModalOpen) { modals.closeWalletModal(); return true }
  if (modals.isDebtModalOpen) { modals.closeDebtModal(); return true }
  if (modals.isNoteModalOpen) { modals.closeNoteModal(); return true }
  if (modals.isFileModalOpen) { modals.closeFileModal(); return true }
  if (modals.isDepositModalOpen) { modals.closeDepositModal(); return true }
  if (modals.isTransferModalOpen) { modals.closeTransferModal(); return true }
  return false
}

function canSwipeBack(route, modals) {
  return isAnyModalOpen(modals)
    || Boolean(route.query.tab)
    || SUB_PAGE_PATHS.some((p) => route.path.startsWith(p))
}

/**
 * Edge swipe-back and swipe-down-to-close for PWA mobile navigation.
 */
export function useSwipeNavigation(rootRef) {
  const router = useRouter()
  const route = useRoute()
  const modals = useModalsStore()

  let startX = 0
  let startY = 0
  let fromEdge = false
  let tracking = false

  function onTouchStart(event) {
    if (event.touches.length !== 1) return
    const touch = event.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    fromEdge = startX <= EDGE_THRESHOLD
    tracking = fromEdge
  }

  function onTouchEnd(event) {
    if (!tracking || event.changedTouches.length !== 1) {
      tracking = false
      return
    }

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY
    tracking = false

    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY)
    const isBackSwipe = fromEdge && deltaX > SWIPE_MIN && Math.abs(deltaY) < SWIPE_MAX_VERTICAL
    const isDownSwipe = deltaY > SWIPE_MIN && Math.abs(deltaX) < SWIPE_MAX_VERTICAL

    if (isHorizontal && isBackSwipe) {
      handleBack()
      return
    }

    if (isDownSwipe && canSwipeBack(route, modals)) {
      handleBack()
    }
  }

  function handleBack() {
    if (closeTopModal(modals)) return

    if (route.path === '/settings' && route.query.tab) {
      router.push({ path: '/settings' })
      return
    }

    if (SUB_PAGE_PATHS.some((p) => route.path.startsWith(p))) {
      router.push('/settings')
      return
    }

    if (window.history.state?.elefamChatOpen) {
      router.back()
    }
  }

  onMounted(() => {
    const el = rootRef?.value ?? document.documentElement
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
  })

  onBeforeUnmount(() => {
    const el = rootRef?.value ?? document.documentElement
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchend', onTouchEnd)
  })
}
