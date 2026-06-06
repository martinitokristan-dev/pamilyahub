<script setup>
import { ref, watch, computed } from 'vue'
import { refDebounced } from '@vueuse/core'
import { useWalletsStore } from '@/stores/wallets.js'
import { Plus, Pencil, Trash2, X, Wallet, Settings, Search, Filter } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import DatePicker from '@/components/ui/DatePicker.vue'
import { formatCurrency, parseCurrency } from '@/utils/format'
import { WALLET_ICON_DEFINITIONS, getWalletIconUrl, normalizeWalletType } from '@/lib/walletIcons.js'
import LoadMoreButton from '@/components/shared/LoadMoreButton.vue'
import EmptyFeedState from '@/components/shared/EmptyFeedState.vue'
import TransactionFilterSheet from '@/components/shared/TransactionFilterSheet.vue'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'
import UnsavedChangesAlert from '@/components/shared/UnsavedChangesAlert.vue'
import ExpenseIcon from '@/components/shared/ExpenseIcon.vue'
const props = defineProps({
  show: Boolean,
  walletId: { type: [String, Number], default: null }
})

const emit = defineEmits(['close'])

const store = useWalletsStore()
const form = ref({ name: '', type: 'cash', balance: '', color: '', icon_url: '' })
const isAdjustingBalance = ref(false)
const isEditing = ref(false)
const showUnsavedAlert = ref(false)

const showFilterSheet = ref(false)
const filterFrom = ref('')
const filterTo = ref('')
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, 400)

const WALLET_TYPE_BG = {
  cash: 'from-green-500 to-emerald-600',
  gcash: 'from-blue-500 to-blue-700',
  maya: 'from-gray-900 to-black',
  bpi: 'from-red-600 to-red-800',
  bdo: 'from-blue-900 to-blue-950',
  unionbank: 'from-orange-500 to-orange-700',
  metrobank: 'from-blue-700 to-blue-900',
  credit_card: 'from-purple-600 to-purple-800',
  debit_card: 'from-indigo-500 to-indigo-700',
  shopeepay: 'from-orange-500 to-red-500',
  coins_ph: 'from-teal-500 to-teal-700',
  gotyme: 'from-cyan-500 to-cyan-700',
  maribank: 'from-pink-500 to-rose-600',
}

const walletTypes = WALLET_ICON_DEFINITIONS.map((w) => ({
  ...w,
  bg: WALLET_TYPE_BG[w.id] || 'from-green-500 to-emerald-600',
}))

const walletIconUrl = computed(() => getWalletIconUrl({ type: form.value.type, name: form.value.name, icon_url: form.value.icon_url }))
const hasActiveFilter = computed(() => !!store.filters.dateFrom || !!store.filters.dateTo)

const displayFeedItems = computed(() => {
  if (!hasActiveFilter.value) return store.feedItems

  return store.feedItems.slice().sort((a, b) => {
    const dA = (a.date || '').slice(0, 10)
    const dB = (b.date || '').slice(0, 10)
    if (dA !== dB) return dA.localeCompare(dB)
    return String(a.id).localeCompare(String(b.id))
  })
})

watch(() => props.show, (val) => {
  if (val) {
    isAdjustingBalance.value = false
    isEditing.value = false
    // Reset filter state whenever modal opens
    store.clearFilters()
    filterFrom.value = ''
    filterTo.value = ''
    searchQuery.value = ''

    if (props.walletId) {
      const wallet = store.wallets.find(w => w.id === props.walletId)
      if (wallet) {
        form.value = {
          name: wallet.name,
          type: normalizeWalletType(wallet.type) || wallet.type,
          balance: wallet.balance,
          color: wallet.color ?? '',
          icon_url: wallet.icon_url ?? '',
        }
        // Load initial feed for this wallet
        store.fetchFeed(props.walletId, { refresh: true })
      }
    } else {
      form.value = { name: '', type: 'cash', balance: '0', color: '', icon_url: '' }
    }
  }
})

// Re-fetch when search changes (only when in view mode)
watch(debouncedSearch, () => {
  if (!props.show || !props.walletId || isEditing.value) return
  store.fetchFeed(props.walletId, {
    refresh: true,
    startDate: store.filters.dateFrom,
    endDate: store.filters.dateTo,
    search: debouncedSearch.value.trim() || undefined,
  })
})

async function submit() {
  const data = {
    ...form.value,
    balance: parseCurrency(form.value.balance)
  }
  if (props.walletId) {
    await store.update(props.walletId, data)
    isAdjustingBalance.value = false
  } else {
    await store.create(data)
    emit('close')
  }
}

async function handleDelete() {
  if (props.walletId) {
    await store.remove(props.walletId)
    emit('close')
  }
}

const hasUnsavedChanges = computed(() => {
  if (!props.show) return false
  
  if (props.walletId) {
    const wallet = store.wallets.find(w => w.id === props.walletId)
    if (!wallet) return false
    
    if (isAdjustingBalance.value && String(form.value.balance) !== String(wallet.balance)) {
      return true
    }
    
    const originalType = normalizeWalletType(wallet.type) || wallet.type
    if (isEditing.value && (form.value.name !== wallet.name || form.value.type !== originalType)) {
      return true
    }
  } else {
    if (form.value.name !== '' || (form.value.balance !== '0' && form.value.balance !== '') || form.value.type !== 'cash') {
      return true
    }
  }
  
  return false
})

function attemptClose() {
  if (hasUnsavedChanges.value) {
    showUnsavedAlert.value = true
  } else {
    emit('close')
  }
}

async function handleSaveAndClose() {
  showUnsavedAlert.value = false
  await submit()
  emit('close')
}

function handleDiscardAndClose() {
  showUnsavedAlert.value = false
  emit('close')
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateStr))
}

function openFilterSheet() {
  filterFrom.value = store.filters.dateFrom || ''
  filterTo.value = store.filters.dateTo || ''
  showFilterSheet.value = true
}

function applyFilters() {
  store.applyFilters(filterFrom.value, filterTo.value)
  showFilterSheet.value = false
  if (!props.walletId) return
  store.fetchFeed(props.walletId, {
    refresh: true,
    startDate: store.filters.dateFrom,
    endDate: store.filters.dateTo,
    search: debouncedSearch.value.trim() || undefined,
  })
}

function clearFilters() {
  filterFrom.value = ''
  filterTo.value = ''
  store.clearFilters()
  showFilterSheet.value = false
  if (!props.walletId) return
  store.fetchFeed(props.walletId, {
    refresh: true,
    search: debouncedSearch.value.trim() || undefined,
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4 animate-in fade-in duration-200" @mousedown.self="attemptClose">
      <UiCard
        class="flex w-full max-w-none flex-col overflow-hidden bg-background shadow-2xl border-0
          max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300
          sm:animate-in sm:zoom-in-95 sm:duration-200
          max-sm:h-[85dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-t-3xl max-sm:rounded-b-none
          sm:max-h-[90vh] sm:min-h-0 sm:max-w-md sm:rounded-3xl"
        @mousedown.stop
      >
        <div class="flex flex-col h-full overflow-hidden">
          
          <!-- ── Header: Create / Edit Mode ── -->
          <div v-if="!walletId || isEditing" class="relative shrink-0 pt-8 pb-4 flex flex-col items-center">
            <UiButton type="button" variant="ghost" size="icon" @click="attemptClose" class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors">
              <X class="h-5 w-5 text-muted-foreground" />
            </UiButton>
            
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-card shadow-sm mb-3 border border-border">
              <img :src="walletIconUrl" class="w-8 h-8 object-contain" @error="$event.target.style.display='none'" />
            </div>

            <p class="text-sm font-medium text-muted-foreground">
              {{ walletId ? 'Edit Wallet' : 'New Wallet' }}
            </p>
            
            <div class="mt-4 flex flex-col items-center justify-center w-full px-8 relative overflow-hidden">
              <UiLabel class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Current Balance</UiLabel>
              <div class="flex items-center justify-center gap-1 border-b-2 border-muted-foreground/30 focus-within:border-primary pb-2 transition-colors min-w-[140px] max-w-full">
                <span class="text-3xl font-semibold text-muted-foreground shrink-0 leading-none mt-1">₱</span>
                <input 
                  v-model="form.balance" 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  placeholder="0.00" 
                  required
                  :style="{ width: Math.max(String(form.balance || '').length, 3) + 'ch' }"
                  class="bg-transparent text-center text-5xl font-bold tracking-tight outline-none focus:ring-0 p-0 leading-none placeholder:text-muted-foreground/30 text-foreground"
                  @focus="$event.target.select()"
                />
              </div>
            </div>
          </div>

          <!-- ── Header: View Mode ── -->
          <div v-if="walletId && !isEditing" class="relative shrink-0 pt-8 pb-4 flex flex-col items-center border-b border-border shadow-sm bg-card z-10">
            <UiButton type="button" variant="ghost" size="icon" @click="attemptClose" class="absolute right-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors">
              <X class="h-5 w-5 text-muted-foreground" />
            </UiButton>
            <UiButton type="button" variant="ghost" size="icon" @click="isEditing = true" class="absolute left-4 top-4 rounded-full h-8 w-8 bg-muted hover:bg-muted/80 transition-colors" title="Edit Wallet">
              <Settings class="h-4 w-4 text-muted-foreground" />
            </UiButton>
            
            <div class="h-14 w-14 mb-3 flex items-center justify-center rounded-2xl bg-background overflow-hidden ring-4 ring-background shadow-sm border border-border">
              <img :src="walletIconUrl" class="w-full h-full object-contain rounded" @error="$event.target.style.display='none'" />
            </div>

            <p class="text-sm font-bold text-foreground">
              {{ form.name }}
            </p>
            
            <div class="mt-2 flex flex-col items-center">
                <div class="text-3xl font-black tracking-tight transition-all">
                  <CurrencyAmount :amount="form.balance" type="balance" size="lg" />
                </div>
                <UiButton v-if="!isAdjustingBalance" variant="secondary" size="sm" class="mt-3 rounded-full text-xs h-8 px-4 font-semibold" @click="isAdjustingBalance = true">
                  <Pencil class="h-3 w-3 mr-1.5" /> Adjust Balance
                </UiButton>
            </div>

            <!-- Inline Balance Editor -->
            <div v-if="isAdjustingBalance" class="mt-3 w-full max-w-[240px] animate-in slide-in-from-top-2 fade-in duration-200 px-4">
                <form @submit.prevent="submit" class="flex flex-col gap-2">
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₱</span>
                    <UiInput 
                      v-model="form.balance" 
                      type="number" step="0.01" required 
                      class="pl-7 pr-3 text-center font-bold text-lg h-10 border-muted-foreground/30 focus-visible:ring-primary/50"
                      autofocus
                    />
                  </div>
                  <div class="flex gap-2">
                    <UiButton type="button" variant="secondary" class="flex-1 font-semibold h-9" @click="isAdjustingBalance = false">Cancel</UiButton>
                    <UiButton type="submit" class="flex-1 font-bold h-9" :disabled="store.loading">
                      Save
                    </UiButton>
                  </div>
                </form>
            </div>
          </div>

          <!-- ── Main Content Area ── -->
          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 sm:px-6 overscroll-contain" :class="{ 'pt-4': walletId && !isEditing }">
            
            <!-- CREATE / EDIT FORM -->
            <form v-if="!walletId || isEditing" id="wallet-form" @submit.prevent="submit" class="space-y-4 pt-2">
              <div class="bg-card rounded-2xl shadow-sm border border-border overflow-hidden p-1 space-y-1">
                <div class="p-3">
                  <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2 block">Wallet Name</UiLabel>
                  <UiInput v-model="form.name" placeholder="e.g. My GCash, BDO Savings" class="border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30 h-11" required />
                </div>
              </div>

              <div class="space-y-2 pt-2">
                <UiLabel class="text-xs text-muted-foreground uppercase tracking-wider font-semibold px-2">Type</UiLabel>
                <div class="max-h-[180px] overflow-y-auto px-1 py-1 -mx-1">
                  <div class="grid grid-cols-4 gap-2">
                    <button
                      v-for="wt in walletTypes"
                      :key="wt.id"
                      type="button"
                      @click="() => {
                        const oldTypeLabel = walletTypes.find(w => w.id === form.type)?.label
                        if (!form.name || form.name === oldTypeLabel) {
                          form.name = wt.label
                        }
                        form.type = wt.id
                      }"
                      class="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-2 transition-all duration-150"
                      :class="form.type === wt.id ? 'border-primary bg-primary/5 scale-105 shadow-sm' : 'border-border bg-card hover:border-muted-foreground/30'"
                    >
                      <div class="h-6 w-6 shrink-0 flex items-center justify-center rounded overflow-hidden">
                        <img 
                          :src="wt.icon" 
                          class="w-full h-full object-contain" 
                          @error="$event.target.style.display='none'"
                        />
                      </div>
                      <span class="text-[10px] font-bold text-center leading-none text-muted-foreground" :class="{ '!text-primary': form.type === wt.id }">{{ wt.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <!-- VIEW FEED -->
            <div v-else class="flex flex-col min-h-0 flex-1 space-y-4">
              <!-- Sticky header with filters -->
              <div class="sticky top-0 z-10 bg-background/95 backdrop-blur-md border border-border/50 rounded-2xl p-2 flex flex-col gap-2 shadow-sm">
                <div class="flex items-center justify-between px-2">
                  <h4 class="text-sm font-bold text-foreground">Transaction History</h4>
                </div>
                <div class="flex items-center gap-2">
                  <div class="relative flex-1 min-w-0">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <UiInput v-model="searchQuery" placeholder="Search transactions…" class="pl-9 bg-muted/50 border-0 h-10 focus-visible:ring-1 focus-visible:ring-primary/50" />
                  </div>
                  <button
                    type="button"
                    class="relative h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center transition-colors hover:bg-muted shrink-0"
                    @click="openFilterSheet"
                    aria-label="Filter transaction history by date"
                  >
                    <Filter
                      class="h-4 w-4"
                      :class="hasActiveFilter ? 'text-primary' : 'text-muted-foreground'"
                    />
                    <span
                      v-if="hasActiveFilter"
                      class="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary"
                    ></span>
                  </button>
                </div>
              </div>

              <!-- Loading skeletons -->
              <div v-if="store.feedLoading && store.feedItems.length === 0" class="space-y-4 pt-2">
                <div v-for="i in 5" :key="i" class="flex items-center gap-4 animate-pulse px-2">
                  <div class="h-10 w-10 rounded-xl bg-muted shrink-0"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-3 bg-muted rounded w-3/4"></div>
                    <div class="h-2.5 bg-muted rounded w-1/4"></div>
                  </div>
                  <div class="h-4 bg-muted rounded w-16 shrink-0"></div>
                </div>
              </div>

              <!-- Empty state -->
              <EmptyFeedState 
                v-else-if="!store.feedLoading && displayFeedItems.length === 0" 
                :icon="Wallet" 
                title="No transactions found." 
                description="Try adjusting the date range or search term." 
              />

              <!-- Feed items -->
              <div v-else class="space-y-2.5 pt-2">
                <div
                  v-for="item in displayFeedItems"
                  :key="item.type + item.id"
                  class="flex items-center justify-between p-3 rounded-2xl border border-border bg-card shadow-sm hover:bg-muted/30 transition-colors gap-3"
                >
                  <!-- Icon -->
                  <div class="shrink-0">
                    <ExpenseIcon :title="item.description" size="md" />
                  </div>
                  <!-- Description + date -->
                  <div class="flex flex-col flex-1 min-w-0">
                    <span class="text-sm font-bold text-foreground line-clamp-1">{{ item.description }}</span>
                    <span class="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-0.5">{{ formatDate(item.date) }}</span>
                  </div>
                  <!-- Amount -->
                  <div class="text-right shrink-0 pl-2 tabular-nums">
                    <CurrencyAmount
                      :amount="item.amount"
                      :type="item.type === 'income' ? 'income' : 'expense'"
                      :prefix="item.type === 'income' ? '+' : '-'"
                      size="sm"
                      class="font-black"
                    />
                  </div>
                </div>
              </div>

              <!-- Load More -->
              <LoadMoreButton :is-loading="store.isLoadingMore" :has-more="store.hasMore" @load-more="store.loadMore()" />
            </div>

          </div>

          <!-- ── Footer ── -->
          <div v-if="!walletId || isEditing" class="p-4 bg-background border-t border-border flex items-center gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <UiButton v-if="walletId" type="button" variant="destructive" size="icon" @click="handleDelete" class="shrink-0 font-semibold h-11 w-11 rounded-xl" title="Delete Wallet">
              <Trash2 class="h-5 w-5" />
            </UiButton>
            
            <UiButton type="button" variant="secondary" class="flex-1 font-semibold h-11 rounded-xl" @click="walletId ? (isEditing = false) : attemptClose()">
              Cancel
            </UiButton>

            <UiButton type="submit" form="wallet-form" :disabled="store.loading" class="flex-1 font-bold h-11 rounded-xl">
              {{ store.loading ? (walletId ? 'Saving…' : 'Adding…') : (walletId ? 'Save Wallet' : 'Add Wallet') }}
            </UiButton>
          </div>
        </div>
      </UiCard>

      <TransactionFilterSheet 
        v-model:show="showFilterSheet" 
        v-model:date-from="filterFrom" 
        v-model:date-to="filterTo"
        title="Filter log"
        description="Date range applies to this wallet's transaction history only. The wallet balance above is not affected."
        info-text="Log entries show oldest → newest within this range."
        :z-index="90"
        @apply="applyFilters"
        @clear="clearFilters"
      />
      
      <!-- Unsaved Changes Alert -->
      <UnsavedChangesAlert
        :show="showUnsavedAlert"
        @save="handleSaveAndClose"
        @discard="handleDiscardAndClose"
        @cancel="showUnsavedAlert = false"
      />
    </div>
  </Teleport>
</template>
