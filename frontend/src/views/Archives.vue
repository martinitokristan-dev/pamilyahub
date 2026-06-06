<script setup>
defineOptions({ name: 'Archives' })
import { ref, onMounted, watch } from 'vue'
import { refDebounced } from '@vueuse/core'
import { Search, Archive, Receipt, HandCoins, ArrowRightLeft, ArrowRight, Calendar } from 'lucide-vue-next'
import UiInput from '@/components/ui/Input.vue'
import { SkeletonListItem } from '@/components/skeletons'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { getWalletIconUrl } from '@/lib/walletIcons.js'
import LoadMoreButton from '@/components/shared/LoadMoreButton.vue'
import EmptyFeedState from '@/components/shared/EmptyFeedState.vue'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'
import CustomSelect from '@/components/shared/CustomSelect.vue'
import TransactionDetailsModal from '@/components/modals/TransactionDetailsModal.vue'
import api from '@/lib/axios.js'

const activeFilter = ref('all')

const filterOptions = [
  { value: 'all', label: 'All Archives' },
  { value: 'expense', label: 'Expenses' },
  { value: 'deposit', label: 'Deposits' },
  { value: 'transfer', label: 'Transfers' },
  { value: 'debts', label: 'Debts' },
  { value: 'plans', label: 'Plans' },
]

function selectFilter(val) {
  activeFilter.value = val
  fetchArchives(true)
}

const items = ref([])
const loading = ref(false)
const hasMore = ref(false)
const nextCursor = ref(null)
const search = ref('')
const debouncedSearch = refDebounced(search, 500)

const showTransactionDetails = ref(false)
const selectedTransaction = ref(null)

watch(activeFilter, () => {
  search.value = ''
  fetchArchives(true)
})

function archiveEndpoint() {
  if (activeFilter.value === 'debts') return '/debts/feed'
  if (activeFilter.value === 'plans') return '/upcoming-payments'
  return '/expenses/feed'
}

async function fetchArchives(refresh = false) {
  if (refresh) {
    nextCursor.value = null
    hasMore.value = false
    items.value = []
  }

  loading.value = true
  try {
    const endpoint = archiveEndpoint()
    const params = { limit: 15, only_archives: 1 }

    if (activeFilter.value !== 'debts' && activeFilter.value !== 'all' && activeFilter.value !== 'plans') {
      params.type = activeFilter.value
    }

    if (nextCursor.value && !refresh) params.cursor = nextCursor.value
    if (debouncedSearch.value.trim()) params.search = debouncedSearch.value.trim()

    const res = await api.get(endpoint, { params })
    const newItems = res.data.data || []

    nextCursor.value = res.data.meta?.next_cursor || null
    hasMore.value = !!res.data.meta?.has_more

    if (refresh) {
      items.value = newItems
    } else {
      items.value = [...items.value, ...newItems]
    }
  } catch (e) {
    console.error('Failed to load archives', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchArchives(true)
})

function loadMore() {
  fetchArchives(false)
}

function openTransaction(item) {
  if (activeFilter.value === 'debts' || activeFilter.value === 'plans') return
  selectedTransaction.value = { ...item, is_archived: true }
  showTransactionDetails.value = true
}

function isLendingExpense(expense) {
  if (!expense) return false
  const title = (expense.title || '').toLowerCase()
  const desc = (expense.notes || expense.description || '').toLowerCase()
  return title.includes('lent') || title.includes('lend') || desc.includes('lent') || desc.includes('lend')
}

function formatPlanDueDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-6xl mx-auto animate-fade-in">
    <div class="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-medium tracking-tight text-foreground flex items-center gap-2">
          <Archive class="h-6 w-6 text-primary" />
          Archives
        </h1>
        <p class="text-sm text-muted-foreground">Historical records older than 6 months.</p>
      </div>
    </div>

    <div class="mb-4 space-y-4">
      <div class="relative w-full sm:w-fit z-50">
        <CustomSelect
          :model-value="activeFilter"
          @update:model-value="selectFilter"
          :options="filterOptions"
          trigger-class="flex items-center justify-between appearance-none bg-card border border-border/50 text-foreground text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer shadow-sm font-medium w-full sm:w-48 transition-colors hover:bg-muted/50"
        />
      </div>

      <UiInput
        v-model="search"
        placeholder="Search archives..."
        class="bg-card shadow-sm h-12 rounded-xl border-border/50 focus:border-primary/50 text-base"
        @input="() => fetchArchives(true)"
      >
        <template #icon>
          <Search class="h-5 w-5 text-muted-foreground" />
        </template>
      </UiInput>
    </div>

    <div class="bg-card rounded-2xl shadow-sm border border-border/40 overflow-hidden relative">
      <div v-if="items.length === 0 && !loading" class="p-8">
        <EmptyFeedState :icon="Archive" title="No Archives Found" description="Your archived items will appear here." />
      </div>

      <div v-else class="divide-y divide-border/40">
        <div
          v-for="item in items"
          :key="item.id + '-' + (item.type || activeFilter)"
          @click="openTransaction(item)"
          class="flex items-center justify-between p-4 transition-colors"
          :class="activeFilter === 'debts' || activeFilter === 'plans' ? '' : 'cursor-pointer hover:bg-muted/40'"
        >
          <!-- Plan archive layout -->
          <div v-if="activeFilter === 'plans'" class="flex items-center gap-4 min-w-0 flex-1 pr-4">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm border border-violet-500/20 bg-violet-500/10 text-violet-600">
              <Calendar class="h-5 w-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-[15px] text-foreground">{{ item.title }}</p>
              <div class="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span class="font-medium whitespace-nowrap">Due {{ formatPlanDueDate(item.due_date) }}</span>
                <span v-if="item.is_paid" class="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase">Paid</span>
                <span v-else class="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold uppercase">Archived</span>
              </div>
            </div>
          </div>

          <!-- Transaction Layout -->
          <div v-else-if="activeFilter !== 'debts'" class="flex items-center gap-4 min-w-0 flex-1 pr-4">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm border border-border/50"
              :class="{
                'bg-emerald-500/10 text-emerald-600 border-emerald-500/20': item.type === 'deposit',
                'bg-blue-500/10 text-blue-600 border-blue-500/20': item.type === 'transfer',
                'bg-amber-500/10 text-amber-600 border-amber-500/20': item.type === 'expense' && isLendingExpense(item),
                'bg-destructive/10 text-destructive border-destructive/20': item.type === 'expense' && !isLendingExpense(item),
              }"
            >
              <ArrowRightLeft v-if="item.type === 'transfer'" class="h-5 w-5" />
              <HandCoins v-else-if="item.type === 'deposit'" class="h-5 w-5" />
              <Receipt v-else class="h-5 w-5" />
            </div>
            
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <p class="truncate font-semibold text-[15px] text-foreground">
                  {{ item.title || (item.type === 'transfer' ? 'Transfer' : 'Transaction') }}
                </p>
                <div v-if="item.type === 'transfer' && item.to_wallet" class="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0 border border-border/50 shadow-sm">
                  <img :src="getWalletIconUrl(item.wallet?.icon)" class="w-3 h-3 grayscale opacity-70" v-if="item.wallet?.icon" />
                  <span class="truncate max-w-[80px]">{{ item.wallet?.name || 'Wallet' }}</span>
                  <ArrowRight class="w-3 h-3" />
                  <img :src="getWalletIconUrl(item.to_wallet?.icon)" class="w-3 h-3 grayscale opacity-70" v-if="item.to_wallet?.icon" />
                  <span class="truncate max-w-[80px]">{{ item.to_wallet?.name || 'Wallet' }}</span>
                </div>
              </div>

              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <span class="font-medium whitespace-nowrap">{{ formatDateTime(item.date) }}</span>
                <span class="w-1 h-1 rounded-full bg-border"></span>
                <div v-if="item.type !== 'transfer' && item.wallet" class="flex items-center gap-1.5 shrink-0 max-w-[120px]">
                  <img :src="getWalletIconUrl(item.wallet.icon)" class="w-3 h-3 grayscale opacity-70 shrink-0" v-if="item.wallet.icon" />
                  <span class="truncate">{{ item.wallet.name }}</span>
                </div>
                <div v-if="item.notes" class="flex items-center gap-1.5 min-w-0 hidden sm:flex">
                  <span class="w-1 h-1 rounded-full bg-border shrink-0"></span>
                  <span class="truncate">{{ item.notes }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Debt Layout -->
          <div v-if="activeFilter === 'debts'" class="flex items-center gap-4 min-w-0 flex-1 pr-4">
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm border border-border/50"
              :class="{
                'bg-emerald-500/10 text-emerald-600 border-emerald-500/20': item.type === 'owed_to_me',
                'bg-destructive/10 text-destructive border-destructive/20': item.type === 'i_owe'
              }"
            >
              <HandCoins class="h-5 w-5" />
            </div>
            
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-1">
                <p class="truncate font-semibold text-[15px] text-foreground">
                  {{ item.name }}
                </p>
                <div class="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0 border border-border/50 shadow-sm">
                  <span>{{ item.type === 'owed_to_me' ? 'Owed to Me' : 'I Owe' }}</span>
                </div>
              </div>

              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <span class="font-medium whitespace-nowrap">{{ formatDateTime(item.date) }}</span>
                <div v-if="item.notes" class="flex items-center gap-1.5 min-w-0 hidden sm:flex">
                  <span class="w-1 h-1 rounded-full bg-border shrink-0"></span>
                  <span class="truncate">{{ item.notes }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="text-right shrink-0">
            <p v-if="activeFilter === 'plans'" class="font-bold text-[15px] text-foreground">
              <CurrencyAmount :amount="item.amount" type="muted" size="sm" class="font-black tabular-nums" />
            </p>
            <p v-else-if="activeFilter !== 'debts'" class="font-bold text-[15px]" :class="{
              'text-emerald-600': item.type === 'deposit',
              'text-blue-600': item.type === 'transfer',
              'text-amber-600': item.type === 'expense' && isLendingExpense(item),
              'text-foreground': item.type === 'expense' && !isLendingExpense(item)
            }">
              <span v-if="item.type === 'deposit'">+</span>
              <span v-else-if="item.type === 'expense' && !isLendingExpense(item)">-</span>
              <CurrencyAmount :amount="item.amount" :type="item.type === 'deposit' ? 'income' : (item.type === 'transfer' ? 'muted' : 'expense')" size="sm" class="font-black tabular-nums" />
            </p>
            <p v-if="activeFilter === 'debts'" class="font-bold text-[15px]" :class="{
              'text-emerald-600': item.type === 'owed_to_me',
              'text-destructive': item.type === 'i_owe'
            }">
              <CurrencyAmount :amount="item.amount" :type="item.type === 'owed_to_me' ? 'income' : 'expense'" size="sm" class="font-black tabular-nums" />
            </p>
          </div>
        </div>
      </div>

      <div v-if="loading && items.length === 0" class="p-4 space-y-4">
        <SkeletonListItem v-for="i in 5" :key="i" />
      </div>

      <LoadMoreButton
        v-if="hasMore"
        :loading="loading"
        @load-more="loadMore"
        class="border-t border-border/40"
      />
    </div>

    <TransactionDetailsModal
      v-if="activeFilter !== 'debts' && activeFilter !== 'plans'"
      :show="showTransactionDetails"
      :transaction="selectedTransaction"
      @close="showTransactionDetails = false; selectedTransaction = null"
    />
  </div>
</template>
