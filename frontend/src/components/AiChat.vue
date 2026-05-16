<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MessageCircle, ArrowUp, X } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import AiChatMessage from '@/components/AiChatMessage.vue'
import { cacheSingleGet, cacheSingleSet } from '@/lib/offlineDb.js'
import { processEleFamMessage, eleFamProfile } from '@/lib/chatEngine.js'
import { detectIntent, getIntentType } from '@/lib/chatIntents.js'

const isOpen = ref(false)
const input = ref('')
const isThinking = ref(false)
const currentIntentType = ref('query')
const listEl = ref(null)
const messages = ref([])

const dragStartY = ref(0)
const dragStartX = ref(0)
const dragDeltaY = ref(0)

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

  pushMessage('user', text)
  input.value = ''
  isThinking.value = true

  // Detect intent type synchronously before API call for correct loading message
  const intent = detectIntent(text)
  currentIntentType.value = getIntentType(intent.name)

  await scrollToBottom()

  try {
    const result = await processEleFamMessage(text)
    await new Promise((resolve) => setTimeout(resolve, 250))
    pushMessage('assistant', result.message, result.kind || 'text', result.walletType)
  } catch (_err) {
    pushMessage('assistant', 'I encountered an error while processing that command. Please try again.', 'guard')
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
  isOpen.value = true
  scrollToBottom()
}

function closeChat() {
  isOpen.value = false
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

onMounted(async () => {
  window.addEventListener('popstate', handlePopState)
  
  // Re-verify with IndexedDB in background just in case localStorage was cleared
  const cached = await cacheSingleGet('chat_history').catch(() => null)
  if (cached?.messages?.length && !localStorage.getItem('elefam_chat_history')) {
    messages.value = cached.messages
    localStorage.setItem('elefam_chat_history', JSON.stringify(cached.messages))
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState)
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
        <div class="flex items-center justify-center border-b border-border/50 px-4 py-3 backdrop-blur-md bg-background/80 sticky top-0 z-10">
          <div class="text-center">
            <p class="text-[17px] font-bold text-foreground tracking-tight">EleFam</p>
          </div>
        </div>

        <div ref="listEl" class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div class="flex flex-col justify-end min-h-full space-y-4">
            <AiChatMessage v-for="message in messages" :key="message.id" :message="message" />
            
            <!-- Thinking Indicator -->
            <div v-if="isThinking" class="flex items-start gap-2 pt-1">
              <div class="w-14 h-14 shrink-0 flex items-center justify-center">
                <img src="/icons/wallets/EF-profile.png" alt="EleFam" class="w-full h-full object-contain">
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
              v-model="input"
              placeholder="Message EleFam..."
              class="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none py-2 px-4 text-[15px] resize-none max-h-32 min-h-[40px] leading-[1.2] text-foreground placeholder:text-muted-foreground/60"
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

  <div class="fixed bottom-28 right-4 z-20 sm:right-6 sm:bottom-24">
    <UiButton
      v-if="!isOpen"
      size="icon"
      class="h-14 w-14 rounded-full shadow-[0_8px_25px_rgba(var(--primary-rgb),0.35)]"
      @click="openChat"
      aria-label="Open EleFam chat"
    >
      <MessageCircle class="h-6 w-6" />
    </UiButton>
  </div>
</template>
