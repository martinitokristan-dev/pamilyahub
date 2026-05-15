<script setup>
/**
 * SkeletonTable — Reusable skeleton for desktop table layouts.
 * Used by Expenses desktop view and any future table-based pages.
 * 
 * Props:
 *   rows    — Number of skeleton rows (default: 5)
 *   columns — Number of columns per row (default: 5)
 */
import UiSkeleton from '@/components/ui/Skeleton.vue'
import UiCard from '@/components/ui/Card.vue'

defineProps({
  rows: { type: Number, default: 5 },
  columns: { type: Number, default: 5 },
})
</script>

<template>
  <UiCard class="overflow-hidden">
    <div class="p-4 space-y-4">
      <!-- Header row -->
      <div class="flex items-center gap-4 pb-3 border-b border-border/50">
        <UiSkeleton v-for="i in columns" :key="'h'+i" class="h-3 flex-1 rounded" />
      </div>
      <!-- Data rows -->
      <div v-for="r in rows" :key="r" class="flex items-center gap-4 animate-pulse">
        <UiSkeleton v-for="c in columns" :key="c" class="h-10 flex-1 rounded" />
      </div>
    </div>
  </UiCard>
</template>
