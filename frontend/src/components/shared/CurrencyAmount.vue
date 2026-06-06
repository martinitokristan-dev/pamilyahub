<script setup>
import { computed } from 'vue'
import { formatCurrency } from '@/utils/format'

const props = defineProps({
  amount: {
    type: [Number, String],
    required: true
  },
  type: {
    type: String,
    default: 'neutral',
    validator: (val) => ['expense', 'income', 'debt', 'balance', 'muted', 'neutral', 'auto'].includes(val)
  },
  prefix: {
    type: String,
    default: ''
  },
  strikethrough: {
    type: Boolean,
    default: false
  },
    size: {
      type: String,
      default: 'md',
      validator: (val) => ['xs', 'sm', 'md', 'lg', 'xl'].includes(val)
    }
  })

  const colorClass = computed(() => {
    const amt = parseFloat(props.amount)
    const isNeg = !isNaN(amt) && amt < 0

    let resolvedType = props.type
    if (resolvedType === 'auto') {
      resolvedType = isNeg ? 'expense' : 'income'
    }

    switch (resolvedType) {
      case 'expense':
      case 'debt':
        return 'text-destructive'
      case 'income':
        return 'text-emerald-600 dark:text-emerald-500'
      case 'balance':
      case 'neutral':
        return 'text-foreground'
      case 'muted':
        return 'text-muted-foreground'
      default:
        return 'text-foreground'
    }
  })

  const rootSizeClass = computed(() => {
    switch (props.size) {
      case 'xs': return 'text-[13px] font-bold'
      case 'sm': return 'text-sm font-semibold'
      case 'md': return 'text-base font-bold'
      case 'lg': return 'text-xl font-bold'
      case 'xl': return 'text-3xl font-bold'
      default:   return 'text-base font-bold'
    }
  })

  // Number class — only tracking differences
  const numberClass = computed(() => {
    switch (props.size) {
      case 'lg': return 'tracking-tight'
      case 'xl': return 'tracking-tight'
      default:   return ''
    }
  })

const formattedAmount = computed(() => {
  const absVal = Math.abs(parseFloat(props.amount) || 0)
  return formatCurrency(absVal).replace(/^[₱\s\xa0]+/g, '').trim()
})
</script>

<template>
  <span :class="[colorClass, rootSizeClass, { 'line-through opacity-50': strikethrough }]" class="inline-flex items-baseline gap-[1px]">
    <span v-if="prefix" :class="numberClass">{{ prefix }}</span>
    <span>₱</span>
    <span :class="numberClass">{{ formattedAmount }}</span>
  </span>
</template>
