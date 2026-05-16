<script setup>
import { computed } from 'vue'

const props = defineProps({
  message: { type: Object, required: true },
})

const isUser = computed(() => props.message.role === 'user')

// iPhone-style bubble logic
const bubbleClass = computed(() => {
  const base = 'px-4 py-2.5 text-[15px] leading-snug shadow-sm transition-all duration-200'
  
  if (isUser.value) {
    return `${base} bg-primary text-primary-foreground rounded-[20px] rounded-br-[5px]`
  }
  
  if (props.message.kind === 'guard') {
    return `${base} bg-destructive/10 text-destructive border border-destructive/20 rounded-[20px] rounded-bl-[5px]`
  }
  
  if (props.message.kind === 'tip' || props.message.kind === 'action') {
    return `${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 rounded-[20px] rounded-bl-[5px]`
  }
  
  return `${base} bg-muted/80 text-foreground rounded-[20px] rounded-bl-[5px] backdrop-blur-sm`
})

function getWalletIcon(type) {
  if (!type) return ''
  const t = String(type).toLowerCase()
  if (t === 'metrobank') return '/icons/wallets/metrobank.jpg'
  return `/icons/wallets/${t}.png`
}
</script>

<template>
  <div class="group flex items-start gap-2" :class="isUser ? 'flex-row-reverse' : 'justify-start'">
    <!-- Avatar for AI (Reverted to original size) -->
    <div v-if="!isUser" class="w-14 h-14 shrink-0 flex items-center justify-center">
      <img src="/icons/wallets/EF-profile.png" alt="EleFam" class="w-full h-full object-contain">
    </div>

    <!-- Message Bubble -->
    <div class="relative max-w-[75%]" :class="bubbleClass">
      <div class="flex items-start gap-2.5">
        <div v-if="message.walletType" class="shrink-0 mt-0.5">
          <img :src="getWalletIcon(message.walletType)" class="w-6 h-6 object-contain rounded-md shadow-sm border border-white/20" />
        </div>
        <div v-else-if="message.kind === 'action'" class="shrink-0 mt-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <span class="whitespace-pre-line">{{ message.text }}</span>
      </div>
    </div>

    <!-- Spacer for user side to balance -->
    <div v-if="isUser" class="w-14 shrink-0"></div>
  </div>
</template>
