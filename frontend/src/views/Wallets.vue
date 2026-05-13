<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWalletsStore } from '@/stores/wallets.js'
import { useRegisterAddAction } from '@/composables/usePageAction.js'
import { Plus, Pencil, Trash2, X, Wallet } from 'lucide-vue-next'
import UiButton from '@/components/ui/Button.vue'
import UiInput from '@/components/ui/Input.vue'
import UiLabel from '@/components/ui/Label.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'
import { formatCurrency, parseCurrency } from '@/utils/format'

const store = useWalletsStore()
useRegisterAddAction(openCreate)

onMounted(() => store.fetchAll())

const showForm = ref(false)
const editingId = ref(null)
const form = ref({ name: '', type: 'cash', balance: '', color: '', icon_url: '' })

const walletTypes = [
  { id: 'cash',        label: 'Cash',        bg: 'from-green-500 to-emerald-600', icon: '/icons/wallets/cash.png' },
  { id: 'gcash',       label: 'GCash',       bg: 'from-blue-500 to-blue-700', icon: '/icons/wallets/gcash.png' },
  { id: 'maya',        label: 'Maya',        bg: 'from-gray-900 to-black', icon: '/icons/wallets/maya.png' },
  { id: 'bpi',         label: 'BPI',         bg: 'from-red-600 to-red-800', icon: '/icons/wallets/bpi.png' },
  { id: 'bdo',         label: 'BDO',         bg: 'from-blue-900 to-blue-950', icon: '/icons/wallets/bdo.png' },
  { id: 'unionbank',   label: 'UnionBank',   bg: 'from-orange-500 to-orange-700', icon: '/icons/wallets/unionbank.png' },
  { id: 'metrobank',   label: 'Metrobank',   bg: 'from-red-800 to-red-950', icon: '/icons/wallets/metrobank.png' },
  { id: 'credit_card', label: 'Credit Card', bg: 'from-purple-600 to-purple-800', icon: '/icons/wallets/credit_card.png' },
  { id: 'debit_card',  label: 'Debit Card',  bg: 'from-indigo-500 to-indigo-700', icon: '/icons/wallets/debit_card.png' },
  { id: 'shopeepay',   label: 'ShopeePay',   bg: 'from-orange-500 to-red-500', icon: '/icons/wallets/shopeepay.png' },
  { id: 'coins_ph',    label: 'Coins.ph',    bg: 'from-teal-500 to-teal-700', icon: '/icons/wallets/coins_ph.png' },
]

function typeInfo(type) {
  return walletTypes.find(w => w.id === type) ?? walletTypes[0]
}

function openCreate() {
  editingId.value = null
  form.value = { name: '', type: 'cash', balance: '0', color: '', icon_url: '' }
  showForm.value = true
}

function openEdit(wallet) {
  editingId.value = wallet.id
  form.value = { name: wallet.name, type: wallet.type, balance: wallet.balance, color: wallet.color ?? '', icon_url: wallet.icon_url ?? '' }
  // Format balance for display
  if (form.value.balance) {
    form.value.balance = formatCurrency(wallet.balance)
  }
  showForm.value = true
}

async function submit() {
  const data = {
    ...form.value,
    balance: parseCurrency(form.value.balance)
  }
  if (editingId.value) {
    await store.update(editingId.value, data)
  } else {
    await store.create(data)
  }
  showForm.value = false
}

const netWorth = computed(() =>
  store.wallets.reduce((s, w) => s + parseFloat(w.balance), 0).toFixed(2)
)
</script>

<template>
  <div class="p-4 md:p-6 max-w-2xl mx-auto animate-fade-in">
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Wallets</h1>
        <p class="text-sm text-muted-foreground mt-0.5 hidden sm:block">Manage your accounts and balances</p>
      </div>
      <div class="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
        <div class="bg-card border border-border shadow-sm px-4 py-2 rounded-2xl flex flex-col items-start sm:items-end min-w-[140px] transition-all hover:shadow-md">
          <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Net Worth</span>
          <span class="text-xl font-black text-foreground tabular-nums">{{ formatCurrency(netWorth) }}</span>
        </div>
        <UiButton @click="openCreate" class="hidden sm:flex h-12 px-6 rounded-2xl">
          <Plus class="h-5 w-5 mr-1" /> Add
        </UiButton>
      </div>
    </div>

    <div v-if="store.loading && store.wallets.length === 0" class="text-sm text-muted-foreground">Loading…</div>

    <div v-else-if="store.wallets.length === 0" class="flex flex-col items-center justify-center py-24 text-center border rounded-2xl border-dashed bg-muted/20">
      <Wallet class="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p class="text-sm text-muted-foreground">No wallets yet. Add your first one!</p>
    </div>

    <div v-else class="grid grid-cols-2 gap-3">
      <div
        v-for="wallet in store.wallets"
        :key="wallet.id"
        class="relative rounded-2xl p-5 text-white shadow-md overflow-hidden bg-gradient-to-br sm:cursor-default cursor-pointer"
        @click="openEdit(wallet)"
        :class="typeInfo(wallet.type).bg"
      >
        <div class="flex items-start justify-between mb-4">
          <img 
            :src="wallet.icon_url || typeInfo(wallet.type).icon" 
            :alt="wallet.name" 
            class="h-10 w-10 rounded-lg object-contain bg-white/20 p-1" 
          />
          <div class="hidden sm:flex gap-1" @click.stop>
            <button @click="openEdit(wallet)" class="rounded-lg bg-white/20 p-2 hover:bg-white/30 transition-colors">
              <Pencil class="h-4 w-4 text-white" />
            </button>
            <button @click="store.remove(wallet.id)" class="rounded-lg bg-white/20 p-2 hover:bg-white/30 transition-colors">
              <Trash2 class="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
        <p class="text-2xl font-bold leading-none mb-1">{{ formatCurrency(wallet.balance) }}</p>
        <p class="text-sm text-white/80 font-medium">{{ wallet.name }}</p>
        <p v-if="wallet.name.toLowerCase() !== typeInfo(wallet.type).label.toLowerCase()" class="text-[11px] text-white/60 mt-0.5">{{ typeInfo(wallet.type).label }}</p>
        <div class="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
        <div class="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/5" />
      </div>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" @mousedown.self="showForm = false">
        <UiCard class="w-full sm:max-w-md shadow-xl animate-fade-in rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between p-5 pb-4 sticky top-0 bg-card border-b border-border">
            <h2 class="text-lg font-semibold">{{ editingId ? 'Edit Wallet' : 'New Wallet' }}</h2>
            <UiButton variant="ghost" size="icon" @click="showForm = false"><X class="h-4 w-4" /></UiButton>
          </div>
          <UiCardContent class="p-5">
            <form @submit.prevent="submit" class="space-y-5">

              <div class="space-y-1.5">
                <UiLabel>Wallet Name</UiLabel>
                <UiInput v-model="form.name" placeholder="e.g. My GCash, BDO Savings" required />
              </div>

              <div class="space-y-2">
                <UiLabel>Type</UiLabel>
                <div class="grid grid-cols-4 gap-2">
                  <button
                    v-for="wt in walletTypes"
                    :key="wt.id"
                    type="button"
                    @click="form.type = wt.id"
                    class="flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 transition-all duration-150"
                    :class="form.type === wt.id ? 'border-primary bg-primary/5 scale-105' : 'border-border hover:border-muted-foreground/30'"
                  >
                    <span class="text-[10px] font-medium text-center leading-none">{{ wt.label }}</span>
                  </button>
                </div>
              </div>

              <div class="space-y-1.5">
                <UiLabel>Current Balance (₱)</UiLabel>
                <UiInput v-model="form.balance" type="number" min="0" step="0.01" placeholder="0.00" required />
              </div>

              <div class="flex justify-between items-center pt-1">
                <UiButton v-if="editingId" type="button" variant="destructive" size="icon" class="h-9 w-9" @click="store.remove(editingId); showForm = false">
                  <Trash2 class="h-4 w-4" />
                </UiButton>
                <div v-else></div>
                <div class="flex gap-2">
                  <UiButton type="button" variant="outline" @click="showForm = false">Cancel</UiButton>
                  <UiButton type="submit" :disabled="store.loading">
                    {{ store.loading ? 'Saving…' : (editingId ? 'Save changes' : 'Add wallet') }}
                  </UiButton>
                </div>
              </div>
            </form>
          </UiCardContent>
        </UiCard>
      </div>
    </Teleport>
  </div>
</template>
