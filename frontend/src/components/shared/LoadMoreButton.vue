<script setup>
import UiButton from '@/components/ui/Button.vue'

defineProps({
  isLoading: {
    type: Boolean,
    default: false
  },
  hasMore: {
    type: Boolean,
    default: false
  }
})

defineEmits(['load-more'])
</script>

<template>
  <div v-if="hasMore" class="mt-4 pt-4 border-t border-border flex justify-center w-full">
    <UiButton
      variant="outline"
      size="sm"
      class="rounded-xl h-9 px-6 font-semibold text-xs"
      :disabled="isLoading"
      @click="$emit('load-more')"
    >
      <span v-if="isLoading" class="animate-spin h-3 w-3 border-2 border-foreground border-t-transparent rounded-full mr-1.5" />
      {{ isLoading ? 'Loading…' : 'Load More' }}
    </UiButton>
  </div>
</template>
