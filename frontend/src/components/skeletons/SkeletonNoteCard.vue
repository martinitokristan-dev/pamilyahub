<script setup>
/**
 * SkeletonNoteCard — Reusable skeleton for note card grids.
 * Mirrors the Notes page card layout with title, preview text, and date footer.
 *
 * Props:
 *   count — Number of skeleton cards to render (default: 6)
 */
import UiSkeleton from '@/components/ui/Skeleton.vue'
import UiCard from '@/components/ui/Card.vue'

defineProps({
  count: { type: Number, default: 6 },
})
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
    <UiCard
      v-for="i in count"
      :key="i"
      class="flex flex-col h-36 animate-pulse"
    >
      <div class="flex flex-col h-full p-4">
        <!-- Title -->
        <UiSkeleton class="h-4 w-3/4 mb-3" />
        
        <!-- Preview lines -->
        <div class="flex-1 space-y-2 mb-2">
          <UiSkeleton class="h-3 w-full" />
          <UiSkeleton class="h-3 w-4/5" />
        </div>

        <!-- Footer -->
        <div class="mt-auto pt-1.5 border-t border-border/50 flex items-center justify-between">
          <UiSkeleton class="h-2 w-16" />
          <UiSkeleton class="h-2 w-10" />
        </div>
      </div>
    </UiCard>
  </div>
</template>
