<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWalletsStore } from '@/stores/wallets.js'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Pencil, Trash2, X, Wallet } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import { SkeletonGrid } from '@/components/skeletons'
import { formatCurrency, parseCurrency } from '@/utils/format'
import { useModalsStore } from '@/stores/modals.js'
import { WALLET_ICON_DEFINITIONS, WALLET_PAGE_GROUPS, getWalletPageGroupId, normalizeWalletType, getWalletIconUrl } from '@/lib/walletIcons.js'
import CurrencyAmount from '@/components/shared/CurrencyAmount.vue'

const store = useWalletsStore()
const modals = useModalsStore()
const route = useRoute()
const router = useRouter()

onMounted(() => {
  if (!store.fetched && !store.loading) store.fetchAll()
  if (route.query.action === 'add') {
    modals.openWalletModal()
    router.replace({ query: { ...route.query, action: undefined } })
  }
})

// Determine responsive size for wallet balance based on amount
function getBalanceSize(balance) {
  const absAmount = Math.abs(parseFloat(balance) || 0)
  const formatted = formatCurrency(absAmount).replace(/[^0-9]/g, '')
  const digits = formatted.length
  
  if (digits >= 7) return 'md' // 1,000,000+ (7+ digits)
  if (digits >= 6) return 'lg' // 100,000+ (6 digits)
  return 'lg' // default
}



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

function typeInfo(type) {
  const id = normalizeWalletType(type) || 'cash'
  return walletTypes.find(w => w.id === id) ?? walletTypes[0]
}

function openCreate() {
  modals.openWalletModal()
}

function openEdit(wallet) {
  modals.openWalletModal(wallet.id)
}

const netWorth = computed(() =>
  store.wallets.reduce((s, w) => s + parseFloat(w.balance), 0).toFixed(2)
)

const groupedWallets = computed(() => {
  const buckets = { ewallet: [], bank: [], card: [], cash: [], other: [] }
  for (const wallet of store.wallets) {
    const key = getWalletPageGroupId(wallet.type)
    buckets[key].push(wallet)
  }
  const sections = WALLET_PAGE_GROUPS
    .filter((g) => buckets[g.id].length > 0)
    .map((g) => ({ ...g, wallets: buckets[g.id] }))
  if (buckets.other.length > 0) {
    sections.push({ id: 'other', label: 'Other', wallets: buckets.other })
  }
  return sections
})
</script>

<template>
  <div class="p-4 md:p-6 max-w-2xl mx-auto animate-fade-in">
    <div class="mb-3 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-[16px] font-medium tracking-tight text-foreground">Wallets</h1>
      </div>
      <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <div class="bg-card border border-border shadow-sm px-4 py-2 rounded-2xl flex flex-col items-start sm:items-end min-w-[140px] transition-all hover:shadow-md">
          <span class="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Net Worth</span>
          <CurrencyAmount :amount="netWorth" type="balance" size="lg" class="tabular-nums sensitive-balance" />
        </div>
        <UiButton @click="openCreate" class="hidden sm:flex shrink-0 h-10 px-5 rounded-[50px] font-semibold bg-primary text-white hover:bg-primary/90 shadow-sm" size="sm">
          Add Wallet
        </UiButton>
      </div>
    </div>

    <div v-if="store.loading && store.wallets.length === 0">
      <SkeletonGrid :count="4" variant="wallet" cols="grid-cols-2" />
    </div>

    <div v-else-if="store.wallets.length === 0" class="flex flex-col items-center justify-center py-24 text-center border rounded-2xl border-dashed bg-muted/20">
      <Wallet class="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p class="text-[13px] text-muted-foreground">No wallets yet. Add your first one!</p>
    </div>

    <div v-else class="space-y-4">
      <section v-for="group in groupedWallets" :key="group.id">
        <h2 class="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-1">{{ group.label }}</h2>
        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="wallet in group.wallets"
            :key="wallet._clientKey || wallet.id"
            class="relative rounded-2xl p-3 text-white shadow-md overflow-hidden bg-gradient-to-br sm:cursor-default cursor-pointer"
            @click="openEdit(wallet)"
            :class="typeInfo(wallet.type).bg"
          >
            <div class="flex items-center gap-2 mb-2">
              <img 
                :src="getWalletIconUrl(wallet)" 
                :alt="wallet.name" 
                class="h-7 w-7 rounded-lg object-contain bg-white/20 p-1 shadow-sm shrink-0" 
              />
              <div class="min-w-0">
                <p class="text-[11px] text-white font-bold truncate leading-tight">{{ wallet.name }}</p>
                <p v-if="wallet.name.toLowerCase() !== typeInfo(wallet.type).label.toLowerCase()" class="text-[7px] text-white/60 uppercase tracking-widest font-black mt-0.5 truncate">
                  {{ typeInfo(wallet.type).label }}
                </p>
              </div>
              
              <div class="hidden xl:flex gap-1 absolute top-2 right-2" @click.stop>
                <button @click="openEdit(wallet)" class="rounded-lg bg-white/10 p-1 hover:bg-white/20 transition-colors">
                  <Pencil class="h-2.5 w-2.5 text-white" />
                </button>
                <button @click="store.remove(wallet.id)" class="rounded-lg bg-white/10 p-1 hover:bg-white/20 transition-colors">
                  <Trash2 class="h-2.5 w-2.5 text-white" />
                </button>
              </div>
            </div>
            
            <div class="mt-auto">
              <p class="text-[7px] uppercase tracking-[0.15em] text-white/50 font-black leading-none mb-1">Balance</p>
              <CurrencyAmount :amount="wallet.balance" type="balance" :size="getBalanceSize(wallet.balance)" class="leading-none tabular-nums tracking-tight sensitive-balance !text-white" />
            </div>
            
            <div class="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
            <div class="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/5" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
