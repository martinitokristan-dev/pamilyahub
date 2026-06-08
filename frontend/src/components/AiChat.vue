<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowUp, X } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import AiChatMessage from '@/components/AiChatMessage.vue'
import { cacheSingleGet, cacheSingleSet } from '@/lib/offlineDb.js'
import { processEleFamMessage, eleFamProfile, clearPendingContext, loadRemoteChatRules } from '@/lib/chatEngine.js'
import { detectIntent, getIntentType } from '@/lib/chatIntents.js'
import { useAuthStore } from '@/stores/auth.js'
import { useDarkMode } from '@/composables/useDarkMode.js'
import { chatOpen } from '@/composables/useToast.js'

const isOpen = ref(false)
const input = ref('')
const isThinking = ref(false)
const currentIntentType = ref('query')
const listEl = ref(null)
const textareaRef = ref(null)
const messages = ref([])

const dragStartY = ref(0)
const dragStartX = ref(0)
const dragDeltaY = ref(0)

const adjustTextareaHeight = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px'
  }
}

watch(input, () => {
  nextTick(adjustTextareaHeight)
})

const isUserCollapsed = ref(false) // Removed localStorage persistence - now purely based on inactivity

const { isDark } = useDarkMode()

let fabStartX = 0
let fabStartY = 0
let suppressFabClick = false
const FAB_SWIPE_THRESHOLD = 30
const FAB_VERTICAL_TOLERANCE = 70

// Inactivity tracking for button collapse
const isInactive = ref(false)
let inactivityTimer = null
const INACTIVITY_THRESHOLD = 3000 // 3 seconds

function resetInactivityTimer() {
  if (isInactive.value) {
    isInactive.value = false
  }
  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(() => {
    if (!isOpen.value) {
      isInactive.value = true
    }
  }, INACTIVITY_THRESHOLD)
}

// Throttle activity handler for better performance
let lastActivityTime = 0
const ACTIVITY_THROTTLE = 150 // ms

function handleUserActivity() {
  const now = Date.now()
  if (now - lastActivityTime < ACTIVITY_THROTTLE) return
  lastActivityTime = now
  resetInactivityTimer()
}

function beginFabGesture(clientX, clientY) {
  fabStartX = clientX
  fabStartY = clientY
}

function endFabGesture(clientX, clientY) {
  // Removed swipe-to-collapse logic - now auto-collapses based on inactivity
  return
}

let wasCollapsedOnStart = false
let chatOpenedOnPointerUp = false

function onFabPointerDown(event) {
  suppressFabClick = false
  wasCollapsedOnStart = isInactive.value
  beginFabGesture(event.clientX, event.clientY)
}

function onFabPointerUp(event) {
  endFabGesture(event.clientX, event.clientY)
  if (!suppressFabClick && wasCollapsedOnStart) {
    chatOpenedOnPointerUp = true
    openChat()
  }
}

function onFabClick() {
  if (chatOpenedOnPointerUp) {
    chatOpenedOnPointerUp = false
    return
  }
  if (suppressFabClick) {
    suppressFabClick = false
    return
  }
  openChat()
}

function makeMessage(role, text, kind = 'text', walletType = null) {
  return {
    id: `${role}_${Date.now()}_${crypto.randomUUID()}`,
    role,
    text,
    kind,
    walletType,
    createdAt: new Date().toISOString(),
  }
}

function pushMessage(role, text, kind = 'text', walletType = null) {
  messages.value.push(makeMessage(role, text, kind, walletType))
}

// ── Instant Load ─────────────────────────────────────────────────────────────
// We use localStorage for synchronous, instant loading of chat bubbles on page load.
try {
  const localCached = localStorage.getItem('elefam_chat_history')
  if (localCached) {
    messages.value = JSON.parse(localCached)
  } else {
    messages.value = [makeMessage('assistant', eleFamProfile.greeting, 'help')]
  }
} catch (_e) {
  messages.value = [makeMessage('assistant', eleFamProfile.greeting, 'help')]
}

async function persistHistory() {
  try {
    const plainMessages = JSON.parse(JSON.stringify(messages.value.slice(-200)))
    // Sync to both for redundancy and speed
    localStorage.setItem('elefam_chat_history', JSON.stringify(plainMessages))
    await cacheSingleSet('chat_history', { messages: plainMessages })
  } catch (_err) {
    // keep chat usable
  }
}

async function scrollToBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

async function sendMessage(rawText = input.value) {
  const text = String(rawText || '').trim()
  if (!text || isThinking.value) return

  if (text.toLowerCase() === '/clear') {
    input.value = ''
    clearPendingContext()
    messages.value = [makeMessage('assistant', eleFamProfile.greeting, 'help')]
    localStorage.removeItem('elefam_chat_history')
    await cacheSingleSet('chat_history', { messages: messages.value })
    await scrollToBottom()
    return
  }

  pushMessage('user', text)
  input.value = ''
  isThinking.value = true

  // Detect intent type synchronously before API call for correct loading message
  const intent = detectIntent(text)
  currentIntentType.value = getIntentType(intent.name)

  await scrollToBottom()

  try {
    const history = messages.value.map(m => ({ role: m.role, content: m.text || m.content }));
    const result = await processEleFamMessage(text, "default", history)
    await new Promise((resolve) => setTimeout(resolve, 250))
    pushMessage('assistant', result.message, result.kind || 'text', result.walletType)
    // If a reminder exists (query during active multi-turn flow), push it as a separate purple bubble
    if (result.reminder) {
      await scrollToBottom()
      await new Promise((resolve) => setTimeout(resolve, 300))
      pushMessage('assistant', result.reminder, 'question')
    }
  } catch (_err) {
    let errMsg = 'I encountered an error while processing that command. Please try again.'
    if (_err?.response?.status === 422 && _err?.response?.data?.message) {
      errMsg = `I'm sorry, but your transaction could not be processed: ${_err.response.data.message}`
    }
    pushMessage('assistant', errMsg, 'guard')
  } finally {
    isThinking.value = false
    await persistHistory()
    await scrollToBottom()
  }
}

function openChat() {
  if (!isOpen.value) {
    window.history.pushState({ elefamChatOpen: true }, '')
  }
  handleUserActivity()
  isOpen.value = true
  chatOpen.value = true
  scrollToBottom()
}

function closeChat() {
  isOpen.value = false
  chatOpen.value = false
  handleUserActivity()
}

function onChatTouchStart(event) {
  const touch = event.touches?.[0]
  if (!touch) return
  dragStartY.value = touch.clientY
  dragStartX.value = touch.clientX
  dragDeltaY.value = 0
}

function onChatTouchMove(event) {
  const touch = event.touches?.[0]
  if (!touch) return
  dragDeltaY.value = touch.clientY - dragStartY.value
}

function onChatTouchEnd(event) {
  const touch = event.changedTouches?.[0]
  if (!touch) return
  
  // Don't close if user is scrolling the message list
  if (listEl.value && listEl.value.scrollTop > 0) {
    return
  }
  
  const deltaX = touch.clientX - dragStartX.value
  const deltaY = dragDeltaY.value
  const isDownSwipe = deltaY > 90
  const isMostlyVertical = Math.abs(deltaX) < 70
  if (isDownSwipe && isMostlyVertical) {
    closeChat()
  }
}

function handlePopState() {
  if (isOpen.value) {
    closeChat()
  }
}

function handleExternalOpenChat() {
  openChat()
}

onMounted(async () => {
  // Load remote chat rules/vocabulary dynamically
  loadRemoteChatRules().catch(err => console.warn('Failed to load remote chat rules:', err))

  window.addEventListener('popstate', handlePopState)
  window.addEventListener('pamilya:open-chat', handleExternalOpenChat)
  
  // Inactivity tracking event listeners (optimized with passive flag)
  window.addEventListener('mousemove', handleUserActivity, { passive: true })
  window.addEventListener('pointerdown', handleUserActivity, { passive: true })
  window.addEventListener('keydown', handleUserActivity, { passive: true })
  window.addEventListener('wheel', handleUserActivity, { passive: true })
  window.addEventListener('touchstart', handleUserActivity, { passive: true })
  window.addEventListener('touchmove', handleUserActivity, { passive: true })
  document.addEventListener('scroll', handleUserActivity, { passive: true, capture: true })
  
  // Start inactivity timer
  resetInactivityTimer()
  
  // Re-verify with IndexedDB in background just in case localStorage was cleared
  const cached = await cacheSingleGet('chat_history').catch(() => null)
  if (cached?.messages?.length && !localStorage.getItem('elefam_chat_history')) {
    messages.value = cached.messages
    localStorage.setItem('elefam_chat_history', JSON.stringify(cached.messages))
  }

  // Daily Greeting Logic
  try {
    const authStore = useAuthStore()
    if (!authStore.user) {
      await authStore.hydrateUser()
    }
    
    const today = new Date().toDateString()
    const lastGreeting = localStorage.getItem('elefam_last_greeting_date')
    
    if (lastGreeting !== today) {
      const hour = new Date().getHours()
      let timeOfDay = 'Good evening'
      if (hour < 12) timeOfDay = 'Good morning'
      else if (hour < 18) timeOfDay = 'Good afternoon'
      
      const firstName = authStore.user?.name ? authStore.user.name.split(' ')[0] : ''
      const nameStr = firstName ? ` ${firstName}` : ''
      
      const greetingMsg = `Hi, ${timeOfDay}${nameStr}, what can I help you with today?`
      
      pushMessage('assistant', greetingMsg, 'text')
      localStorage.setItem('elefam_last_greeting_date', today)
      await persistHistory()
    }
  } catch (e) {
    console.error('Failed to run daily greeting', e)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState)
  window.removeEventListener('pamilya:open-chat', handleExternalOpenChat)
  
  // Clean up inactivity event listeners
  window.removeEventListener('mousemove', handleUserActivity)
  window.removeEventListener('pointerdown', handleUserActivity)
  window.removeEventListener('keydown', handleUserActivity)
  window.removeEventListener('wheel', handleUserActivity)
  window.removeEventListener('touchstart', handleUserActivity)
  window.removeEventListener('touchmove', handleUserActivity)
  document.removeEventListener('scroll', handleUserActivity, { capture: true })
  
  clearTimeout(inactivityTimer)
})

watch(
  () => messages.value.length,
  async () => {
    if (isOpen.value) await scrollToBottom()
  }
)
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[110] bg-background/95 backdrop-blur-sm"
      @touchstart.passive="onChatTouchStart"
      @touchmove.passive="onChatTouchMove"
      @touchend="onChatTouchEnd"
    >
      <div class="mx-auto flex h-full w-full max-w-4xl flex-col bg-background border-x border-border/40">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-border/50 px-4 py-3.5 backdrop-blur-md bg-background/80 sticky top-0 z-10">
          <div class="w-10"></div>
          <p class="text-lg font-black text-foreground tracking-tight text-center flex-1">Marti</p>
          <button 
            type="button"
            @click="closeChat" 
            class="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground transition-all duration-200 active:scale-95"
            aria-label="Close chat"
          >
            <X class="h-5.5 w-5.5" />
          </button>
        </div>

        <!-- Instruction -->
        <div class="bg-muted/20 border-b border-border/45 py-2 px-4 text-center">
          <p class="text-[11px] text-muted-foreground font-medium tracking-wide">
            Type <span class="font-mono font-bold text-muted-foreground/80">/help</span> for list of commands
          </p>
        </div>

        <div ref="listEl" class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div class="flex flex-col justify-end min-h-full space-y-4">
            <AiChatMessage v-for="message in messages" :key="message.id" :message="message" />
            
            <!-- Thinking Indicator -->
            <div v-if="isThinking" class="flex items-start gap-2 pt-1">
              <div class="w-14 h-14 shrink-0 flex items-center justify-center">
                <img src="/icons/wallets/EF-profile.png" alt="Marti" class="w-full h-full object-contain">
              </div>
              <div class="rounded-[20px] rounded-bl-[5px] bg-muted/80 backdrop-blur-sm px-4 py-2.5 text-[15px] text-muted-foreground w-fit animate-pulse shadow-sm">
                {{ currentIntentType === 'query' ? 'Thinking...' : 'Processing...' }}
              </div>
            </div>
          </div>
        </div>

        <div class="px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] bg-background">
          <form 
            class="flex items-center gap-2 bg-secondary/50 rounded-[26px] p-1.5 border border-transparent focus-within:border-primary/20 focus-within:bg-background transition-all duration-300 shadow-sm" 
            @submit.prevent="sendMessage()"
          >
            <textarea
              ref="textareaRef"
              v-model="input"
              rows="1"
              placeholder="Message Marti..."
              class="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none py-1.5 px-4 text-[15px] resize-none max-h-[120px] overflow-y-auto leading-[1.4] text-foreground placeholder:text-muted-foreground/60"
              :disabled="isThinking"
              @keydown.enter.prevent="sendMessage()"
            ></textarea>
            <UiButton 
              type="submit" 
              size="icon" 
              :disabled="isThinking || !input.trim()" 
              class="h-9 w-9 rounded-full shrink-0 flex items-center justify-center transition-all duration-300 shadow-sm"
              :class="input.trim() ? 'bg-primary text-primary-foreground scale-100 opacity-100' : 'bg-muted-foreground/10 text-muted-foreground/30 scale-90 opacity-50'"
              aria-label="Send message"
            >
              <ArrowUp class="h-5 w-5 stroke-[3px] mt-[-1px]" />
            </UiButton>
          </form>
        </div>
      </div>
    </div>
  </Transition>

  <div v-if="!isOpen" class="fixed bottom-[100px] right-4 z-20 sm:right-6 sm:bottom-[80px]">
    <button
      class="flex items-center border-2 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.08)] hover:shadow-[0_16px_50px_rgba(0,0,0,0.15)] will-change-transform transition-all ease-out hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-black/20 backdrop-blur-md overflow-hidden whitespace-nowrap touch-none"
      :style="{
        width: isInactive ? '164px' : '56px',
        transitionDuration: '400ms',
        transitionProperty: 'width, transform, box-shadow, opacity'
      }"
      :class="[
        isDark 
          ? 'bg-[#181f38]/95 border-white/20 text-slate-200' 
          : 'bg-[#f0f4ff]/95 border-black/20 text-slate-800',
        'h-14 p-1.5 gap-2.5',
        isInactive ? 'pr-5 opacity-100' : 'opacity-90'
      ]"
      @click="onFabClick"
      @pointerdown="onFabPointerDown"
      @pointerup="onFabPointerUp"
      aria-label="Ask Marti AI"
    >
      <div class="relative shrink-0 will-change-transform">
        <img src="/icons/wallets/EF-profile.png" alt="Marti" class="w-11 h-11 object-contain" />
        <div class="absolute inset-0 rounded-full bg-primary/20 blur-md -z-10"></div>
      </div>
      <span 
        class="font-bold text-current text-[13px] sm:text-sm tracking-wide shrink-0 will-change-opacity"
        :style="{
          opacity: isInactive ? '1' : '0',
          transition: 'opacity 300ms ease-out',
          transitionDelay: isInactive ? '100ms' : '0ms'
        }"
      >
        Ask Marti AI
      </span>
    </button>
  </div>
</template>

<style scoped>
.nav-pill::-webkit-scrollbar { display: none; }
.nav-pill { -ms-overflow-style: none; scrollbar-width: none; }
</style>

