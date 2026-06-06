<script setup>
import { ref } from 'vue'
import { X, Share, ArrowRightLeft, TrendingUp, Receipt, Pencil, Trash2 } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiCard from '@/components/ui/Card.vue'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'
import ConfirmAlert from '@/components/shared/ConfirmAlert.vue'
import { formatDateTime } from '@/utils/format'

const props = defineProps({
  show: Boolean,
  transaction: Object,
  readOnly: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'edit', 'delete'])

const showDeleteConfirm = ref(false)

function requestDelete() {
  showDeleteConfirm.value = true
}

function confirmDelete() {
  showDeleteConfirm.value = false
  emit('delete')
}

const handleShare = async () => {
  if (navigator.share && props.transaction) {
    try {
      const isExpense = !props.transaction.type || props.transaction.type === 'expense'
      const typeLabel = props.transaction.type === 'transfer' ? 'Transfer' : (props.transaction.type === 'deposit' ? 'Deposit' : 'Expense')
      const amountStr = `₱${parseFloat(props.transaction.amount).toFixed(2)}`
      await navigator.share({
        title: `${typeLabel} Receipt`,
        text: `${typeLabel} of ${amountStr} on ${formatDateTime(props.transaction.date, props.transaction.created_at)}`,
      })
    } catch (err) {
      console.log('Sharing failed or was cancelled', err)
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show && transaction" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4 animate-in fade-in duration-200" @mousedown.self="emit('close')">
      <UiCard class="flex w-full max-w-none flex-col overflow-hidden bg-background shadow-2xl border-0
        max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300
        sm:animate-in sm:zoom-in-95 sm:duration-200
        max-sm:h-[85dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-t-3xl max-sm:rounded-b-none
        sm:max-h-[90vh] sm:min-h-0 sm:max-w-md sm:rounded-3xl" @mousedown.stop>
        
        <!-- Header -->
        <div class="relative shrink-0 pt-8 pb-4 flex flex-col items-center">
          <UiButton variant="ghost" size="icon" @click="emit('close')" class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80">
            <X class="h-5 w-5 text-muted-foreground" />
          </UiButton>
          
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm mb-3">
            <ArrowRightLeft v-if="transaction.type === 'transfer'" class="h-6 w-6 text-primary" />
            <TrendingUp v-else-if="transaction.type === 'deposit'" class="h-6 w-6 text-emerald-600" />
            <Receipt v-else class="h-6 w-6 text-rose-500" />
          </div>

          <p class="text-sm font-medium text-muted-foreground">
            {{ transaction.type === 'transfer' ? 'Transferred' : (transaction.type === 'deposit' ? 'Deposited' : 'Spent') }}
          </p>
          <CurrencyAmount 
            :amount="parseFloat(transaction.amount)" 
            size="xl" 
            class="text-4xl font-bold tracking-tight mt-1" 
          />

          <button @click="handleShare" class="mt-6 flex flex-col items-center gap-1.5 group">
            <div class="h-10 w-10 flex items-center justify-center rounded-full bg-muted/50 group-hover:bg-muted transition-colors">
              <Share class="h-4 w-4 text-foreground" />
            </div>
            <span class="text-xs font-medium text-foreground">Share</span>
          </button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-8 sm:px-6">
          <div class="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <!-- Deposit Title (If deposit) -->
            <div v-if="transaction.type === 'deposit'" class="p-4 border-b border-border/50 border-dashed flex justify-between items-center">
              <span class="text-sm text-muted-foreground">Title</span>
              <span class="font-semibold text-sm">{{ transaction.title }}</span>
            </div>

            <!-- To/From Wallets -->
            <div v-if="transaction.type === 'transfer' || transaction.type === 'deposit'" class="p-4 border-b border-border/50 border-dashed space-y-4">
              <div class="flex justify-between items-start gap-4">
                <span class="text-sm text-muted-foreground shrink-0">To</span>
                <div class="text-right">
                  <p class="font-semibold text-sm">
                    {{ transaction.type === 'transfer' ? transaction.to_wallet?.name : transaction.wallet?.name }}
                  </p>
                  <p class="text-[11px] text-muted-foreground mt-0.5">Wallet</p>
                </div>
              </div>

              <div v-if="transaction.type === 'transfer'" class="flex justify-between items-start gap-4 pt-4 border-t border-border/30">
                <span class="text-sm text-muted-foreground shrink-0">From</span>
                <div class="text-right">
                  <p class="font-semibold text-sm">{{ transaction.wallet?.name }}</p>
                  <p class="text-[11px] text-muted-foreground mt-0.5">Wallet</p>
                </div>
              </div>
            </div>

            <!-- Expense Category/Title and Wallet -->
            <div v-if="transaction.type === 'expense' || !transaction.type" class="p-4 border-b border-border/50 border-dashed space-y-4">
              <div class="flex justify-between items-start gap-4">
                <span class="text-sm text-muted-foreground shrink-0">Category</span>
                <div class="text-right">
                  <p class="font-semibold text-sm">{{ transaction.title }}</p>
                  <p v-if="transaction.description" class="text-[11px] text-muted-foreground mt-0.5">{{ transaction.description }}</p>
                </div>
              </div>
              <div class="flex justify-between items-start gap-4 pt-4 border-t border-border/30">
                <span class="text-sm text-muted-foreground shrink-0">Paid from</span>
                <div class="text-right">
                  <p class="font-semibold text-sm">{{ transaction.wallet?.name }}</p>
                  <p class="text-[11px] text-muted-foreground mt-0.5">Wallet</p>
                </div>
              </div>
            </div>

            <!-- Amount -->
            <div class="p-4 border-b border-border/50 border-dashed">
              <div class="flex justify-between items-center">
                <span class="text-sm text-muted-foreground">Amount</span>
                <span class="font-semibold text-[15px]">₱{{ parseFloat(transaction.amount).toFixed(2) }}</span>
              </div>
            </div>

            <!-- Meta info -->
            <div class="p-4 space-y-3 bg-muted/10">
              <div class="flex justify-between items-center">
                <span class="text-sm text-muted-foreground">Date</span>
                <span class="text-[13px] font-medium">{{ formatDateTime(transaction.date, transaction.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div v-if="!readOnly && !transaction.is_archived" class="p-4 bg-background border-t border-border flex gap-3 shrink-0 flex-wrap">
          <UiButton v-if="!transaction.type || transaction.type === 'expense'" variant="secondary" class="flex-1 min-w-[80px]" @click="emit('edit')">
            <Pencil class="w-4 h-4 mr-2" /> Edit
          </UiButton>
          <UiButton variant="destructive" class="flex-1 min-w-[80px]" @click="requestDelete">
            <Trash2 class="w-4 h-4 mr-2" /> Delete
          </UiButton>
        </div>
      </UiCard>
    </div>

    <ConfirmAlert
      :show="showDeleteConfirm"
      title="Delete transaction?"
      message="This will permanently remove this record. This action cannot be undone."
      confirm-label="Delete"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirm = false"
    />
  </Teleport>
</template>

