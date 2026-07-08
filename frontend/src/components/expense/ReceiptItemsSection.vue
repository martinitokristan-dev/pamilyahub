<script setup>
import { ref } from 'vue'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'

const props = defineProps({
  receiptItems: {
    type: Object,
    required: true
    // Expected: { items: [], fees: [], itemsSubtotal, feesSubtotal, total, ... }
  }
})

const isExpanded = ref(true) // Default: show items

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div class="mt-4 bg-card rounded-2xl shadow-sm border border-border p-4 shrink-0">
    <!-- Header with toggle -->
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Receipt Items</h3>
      <UiButton
        type="button"
        variant="ghost"
        size="sm"
        @click="toggleExpanded"
        class="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
      >
        {{ isExpanded ? 'Hide Items' : 'Show Items' }}
        <ChevronUp v-if="isExpanded" class="h-3 w-3" />
        <ChevronDown v-else class="h-3 w-3" />
      </UiButton>
    </div>

    <!-- Expandable content -->
    <div v-if="isExpanded" class="space-y-4">
      <!-- Items Section -->
      <div v-if="receiptItems.items && receiptItems.items.length > 0">
        <div class="flex items-center justify-between mb-2 pb-1 border-b border-border/50">
          <span class="text-xs font-semibold text-muted-foreground uppercase">Items ({{ receiptItems.itemCount }})</span>
        </div>
        
        <div class="space-y-2">
          <div
            v-for="(item, index) in receiptItems.items"
            :key="'item-' + index"
            class="flex items-start justify-between gap-3 text-sm"
          >
            <div class="flex-1">
              <div class="font-medium text-foreground">{{ item.itemName }}</div>
              <div class="text-xs text-muted-foreground">{{ item.quantity }}x @ ₱{{ item.unitPrice.toFixed(2) }}</div>
            </div>
            <span class="font-semibold text-foreground tabular-nums">₱{{ item.subtotal.toFixed(2) }}</span>
          </div>
        </div>

        <!-- Items Subtotal (if fees exist) -->
        <div v-if="receiptItems.fees && receiptItems.fees.length > 0" class="mt-3 pt-2 border-t border-dashed border-border/50 flex items-center justify-between text-sm">
          <span class="text-muted-foreground font-medium">Subtotal</span>
          <span class="font-semibold text-foreground tabular-nums">₱{{ receiptItems.itemsSubtotal.toFixed(2) }}</span>
        </div>
      </div>

      <!-- Fees Section -->
      <div v-if="receiptItems.fees && receiptItems.fees.length > 0" class="pt-3 border-t border-border">
        <div class="flex items-center justify-between mb-2 pb-1 border-b border-border/50">
          <span class="text-xs font-semibold text-muted-foreground uppercase">Other Charges ({{ receiptItems.feeCount }})</span>
          <span class="text-xs text-amber-600">Tax, Service, Fees</span>
        </div>
        
        <div class="space-y-2">
          <div
            v-for="(fee, index) in receiptItems.fees"
            :key="'fee-' + index"
            class="p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800/30"
          >
            <div class="flex items-center justify-between gap-3 text-sm">
              <span class="font-medium text-foreground">{{ fee.itemName }}</span>
              <span class="font-semibold text-foreground tabular-nums">₱{{ fee.subtotal.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Total -->
      <div class="pt-3 border-t-2 border-foreground/20">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold text-foreground uppercase">Total</span>
          <span class="text-lg font-black text-foreground tabular-nums">₱{{ receiptItems.total.toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
