<template>
  <!-- Brand icon: Brandfetch CDN image with neutral background and standardized border shape -->
  <div
    v-if="icon.type === 'brand' && !imageError"
    :class="['flex items-center justify-center shrink-0', sizeClasses.brandContainer]"
  >
    <img 
      :src="icon.url" 
      :alt="icon.title"
      :class="['object-contain rounded-md', sizeClasses.img]"
      @error="imageError = true"
    />
  </div>

  <!-- Category icon: soft tinted background with Lucide icon -->
  <div
    v-else-if="fallbackIcon.type === 'category'"
    :class="['flex items-center justify-center shrink-0', sizeClasses.container]"
    :style="{ backgroundColor: fallbackIcon.color + '22' }"
  >
    <component :is="lucideIcon" :class="sizeClasses.lucide" :style="{ color: fallbackIcon.color }" />
  </div>

  <!-- Letter avatar fallback: SVG text -->
  <div
    v-else-if="fallbackIcon.type === 'letter'"
    :class="['flex items-center justify-center shrink-0', sizeClasses.container]"
    :style="{ backgroundColor: fallbackIcon.color }"
  >
    <svg viewBox="0 0 24 24" class="w-full h-full text-white fill-current">
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="bold" :font-size="size === 'sm' ? 14 : (size === 'lg' ? 12 : 14)">
        {{ fallbackIcon.letter }}
      </text>
    </svg>
  </div>

  <!-- Fallback: muted receipt icon -->
  <div v-else :class="['bg-muted flex items-center justify-center shrink-0', sizeClasses.container]">
    <Receipt :class="['text-muted-foreground', sizeClasses.lucide]" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import * as LucideIcons from 'lucide-vue-next'
import { Receipt } from 'lucide-vue-next'
import { useExpenseIcon, stripWalletWords } from '@/composables/useExpenseIcon'
import { getSemanticIcon, getHashedLucideIcon } from '@/lib/expenseIconSemantics.js'

const props = defineProps({
  title: { type: String, required: true },
  size: { type: String, default: 'md' } // sm, md, lg
})

const imageError = ref(false)

watch(() => props.title, () => {
  imageError.value = false
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return { 
        container: 'w-8 h-8 rounded-lg', 
        brandContainer: 'w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden',
        img: 'w-full h-full object-contain', 
        lucide: 'w-4 h-4' 
      }
    case 'lg':
      return { 
        container: 'w-12 h-12 rounded-xl', 
        brandContainer: 'w-12 h-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden',
        img: 'w-full h-full object-contain', 
        lucide: 'w-6 h-6' 
      }
    case 'md':
    default:
      return { 
        container: 'w-9 h-9 rounded-xl', 
        brandContainer: 'w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden',
        img: 'w-full h-full object-contain', 
        lucide: 'w-5 h-5' 
      }
  }
})

const icon = computed(() => useExpenseIcon(props.title))

// If the brand image fails, or it's not a brand, we use this fallback logic.
const fallbackIcon = computed(() => {
  if (icon.value.type === 'brand' && imageError.value) {
    const cleaned = stripWalletWords(props.title)
    return getSemanticIcon(cleaned) ?? getHashedLucideIcon(cleaned) ?? { type: 'fallback', icon: 'Receipt', color: '#8A9BAA' }
  }
  return icon.value
})

const lucideIcon = computed(() => LucideIcons[fallbackIcon.value.icon] ?? Receipt)
</script>
