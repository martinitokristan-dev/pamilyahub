<script setup>
/**
 * SkeletonGrid — Reusable skeleton for grid-card layouts.
 * Used by Dashboard stat cards and Wallets grid.
 * 
 * Props:
 *   count   — Number of skeleton cards to render (default: 6)
 *   cols    — Tailwind grid column classes (default: 'grid-cols-2 sm:grid-cols-3')
 *   variant — 'stat' (icon + value + label) or 'wallet' (icon + name + balance)
 */
import UiSkeleton from '@/components/ui/Skeleton.vue'

defineProps({
  count: { type: Number, default: 6 },
  cols: { type: String, default: 'grid-cols-2 sm:grid-cols-3' },
  variant: { type: String, default: 'stat', validator: v => ['stat', 'wallet'].includes(v) },
})
</script>

<template>
  <div :class="['grid gap-3', cols]">
    <!-- Stat variant: colored card with icon + value + label -->
    <template v-if="variant === 'stat'">
      <div
        v-for="i in count"
        :key="i"
        class="h-24 rounded-2xl bg-card border border-border p-4 flex flex-col justify-between animate-pulse"
      >
        <UiSkeleton class="h-6 w-6 rounded-lg" />
        <div class="space-y-1.5">
          <UiSkeleton class="h-5 w-2/3" />
          <UiSkeleton class="h-3 w-1/2" />
        </div>
      </div>
    </template>

    <!-- Wallet variant: gradient card with icon + name + balance -->
    <template v-else>
      <div
        v-for="i in count"
        :key="i"
        class="rounded-2xl bg-muted/40 border border-border p-4 flex flex-col gap-3 animate-pulse"
      >
        <div class="flex items-center gap-2.5">
          <UiSkeleton class="h-8 w-8 rounded-lg shrink-0" />
          <div class="space-y-1.5 flex-1">
            <UiSkeleton class="h-3 w-3/4" />
            <UiSkeleton class="h-2 w-1/2" />
          </div>
        </div>
        <div class="mt-auto space-y-1.5">
          <UiSkeleton class="h-2 w-1/3" />
          <UiSkeleton class="h-5 w-2/3" />
        </div>
      </div>
    </template>
  </div>
</template>
