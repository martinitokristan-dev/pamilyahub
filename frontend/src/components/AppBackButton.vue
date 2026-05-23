<script setup>
import { useRouter } from 'vue-router'
import { ChevronLeft } from 'lucide-vue-next'
import { useAttrs, computed } from 'vue'

defineOptions({
  name: 'AppBackButton',
  inheritAttrs: false
})

const props = defineProps({
  to: {
    type: String,
    default: null
  }
})

const router = useRouter()
const attrs = useAttrs()

// Filter out the onClick listener so it is not double-triggered when bound to the button
const buttonAttrs = computed(() => {
  const { onClick, ...rest } = attrs
  return rest
})

function handleClick(event) {
  if (attrs.onClick) {
    if (typeof attrs.onClick === 'function') {
      attrs.onClick(event)
    } else if (Array.isArray(attrs.onClick)) {
      attrs.onClick.forEach(fn => fn(event))
    }
  } else {
    if (props.to) {
      router.push(props.to)
    } else {
      router.back()
    }
  }
}
</script>

<template>
  <button
    v-bind="buttonAttrs"
    @click="handleClick"
    class="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center text-foreground hover:bg-muted transition-all active:scale-90"
  >
    <ChevronLeft class="h-5 w-5" />
  </button>
</template>
