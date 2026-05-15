<script setup>
/**
 * SkeletonListItem — Reusable skeleton for a card-style list row.
 * Used by Expenses, Debts, Dashboard recent items, etc.
 * 
 * Props:
 *   showIcon    — Show a square icon placeholder on the left (default: true)
 *   showAmount  — Show a right-aligned amount placeholder (default: true)
 *   showBadge   — Show a small badge/tag under the title line (default: false)
 */
import UiSkeleton from '@/components/ui/Skeleton.vue'

defineProps({
  showIcon: { type: Boolean, default: true },
  showAmount: { type: Boolean, default: true },
  showBadge: { type: Boolean, default: false },
})
</script>

<template>
  <div class="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 animate-pulse">
    <!-- Icon placeholder -->
    <UiSkeleton v-if="showIcon" class="h-12 w-12 rounded-xl shrink-0" />
    
    <!-- Text lines -->
    <div class="flex-1 space-y-2 min-w-0">
      <UiSkeleton class="h-4 w-2/5" />
      <UiSkeleton class="h-3 w-3/5" />
      <UiSkeleton v-if="showBadge" class="h-3 w-1/4" />
    </div>

    <!-- Amount placeholder -->
    <UiSkeleton v-if="showAmount" class="h-4 w-16 shrink-0" />
  </div>
</template>
