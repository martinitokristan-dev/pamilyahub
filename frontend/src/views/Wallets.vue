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
import { SkeletonGrid } from '@/components/skeletons'
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
  { id: 'metrobank',   label: 'Metrobank',   bg: 'from-blue-700 to-blue-900', icon: '/icons/wallets/metrobank.jpg' },
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
    <div class="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-[32px] sm:text-[40px] font-black tracking-tight text-foreground leading-none">Wallets</h1>
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

    <div v-if="store.loading && store.wallets.length === 0">
      <SkeletonGrid :count="4" variant="wallet" cols="grid-cols-2" />
    </div>

    <div v-else-if="store.wallets.length === 0" class="flex flex-col items-center justify-center py-24 text-center border rounded-2xl border-dashed bg-muted/20">
      <Wallet class="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p class="text-sm text-muted-foreground">No wallets yet. Add your first one!</p>
    </div>

    <div v-else class="grid grid-cols-2 gap-3">
      <div
        v-for="wallet in store.wallets"
        :key="wallet.id"
        class="relative rounded-2xl p-4 text-white shadow-md overflow-hidden bg-gradient-to-br sm:cursor-default cursor-pointer"
        @click="openEdit(wallet)"
        :class="typeInfo(wallet.type).bg"
      >
        <div class="flex items-center gap-2.5 mb-3">
          <img 
            :src="wallet.icon_url || typeInfo(wallet.type).icon" 
            :alt="wallet.name" 
            class="h-8 w-8 rounded-lg object-contain bg-white/20 p-1 shadow-sm shrink-0" 
          />
          <div class="min-w-0">
            <p class="text-[11px] text-white font-bold truncate leading-tight">{{ wallet.name }}</p>
            <p v-if="wallet.name.toLowerCase() !== typeInfo(wallet.type).label.toLowerCase()" class="text-[7px] text-white/60 uppercase tracking-widest font-black mt-0.5 truncate">
              {{ typeInfo(wallet.type).label }}
            </p>
          </div>
          
          <!-- Actions tucked in top right -->
          <div class="hidden sm:flex gap-1 absolute top-2 right-2" @click.stop>
            <button @click="openEdit(wallet)" class="rounded-lg bg-white/10 p-1 hover:bg-white/20 transition-colors">
              <Pencil class="h-2.5 w-2.5 text-white" />
            </button>
            <button @click="store.remove(wallet.id)" class="rounded-lg bg-white/10 p-1 hover:bg-white/20 transition-colors">
              <Trash2 class="h-2.5 w-2.5 text-white" />
            </button>
          </div>
        </div>
        
        <div class="mt-auto">
          <p class="text-[8px] uppercase tracking-[0.15em] text-white/50 font-black leading-none mb-1.5">Balance</p>
          <p class="text-base font-black leading-none tabular-nums tracking-tight">
            ₱{{ Number(wallet.balance).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
          </p>
        </div>
        
        <div class="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
        <div class="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/5" />
      </div>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showForm" class="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 backdrop-blur-sm p-0 sm:items-center sm:p-4" @mousedown.self="showForm = false">
        <UiCard class="flex w-full max-w-none flex-col overflow-hidden bg-card shadow-2xl animate-in fade-in zoom-in duration-200
          max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:min-h-0 max-sm:rounded-none max-sm:pt-[env(safe-area-inset-top)]
          sm:max-h-[90vh] sm:min-h-0 sm:max-w-md sm:rounded-2xl" @mousedown.stop>
          
          <div class="shrink-0 p-6 border-b border-border bg-gradient-to-r from-primary/10 to-transparent flex items-center justify-between">
            <h2 class="text-xl font-bold tracking-tight">{{ editingId ? 'Edit Wallet' : 'New Wallet' }}</h2>
            <UiButton variant="ghost" size="icon" @click="showForm = false" class="rounded-full h-8 w-8">
              <X class="h-4 w-4" />
            </UiButton>
          </div>

          <div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            <UiCardContent class="p-6">
              <form id="wallet-form" @submit.prevent="submit" class="space-y-6">
                <div class="space-y-1.5">
                  <UiLabel>Wallet Name</UiLabel>
                  <UiInput v-model="form.name" placeholder="e.g. My GCash, BDO Savings" required />
                </div>

                <div class="space-y-2">
                  <UiLabel>Type</UiLabel>
                  <div class="max-h-[180px] overflow-y-auto pr-1 py-1 -mr-1">
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
                        :class="form.type === wt.id ? 'border-primary bg-primary/5 scale-105' : 'border-border hover:border-muted-foreground/30'"
                      >
                        <div class="h-6 w-6 shrink-0 flex items-center justify-center rounded overflow-hidden">
                          <img 
                            :src="wt.icon" 
                            class="w-full h-full object-contain" 
                            @error="$event.target.style.display='none'"
                          />
                        </div>
                        <span class="text-[10px] font-medium text-center leading-none">{{ wt.label }}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="space-y-1.5">
                  <UiLabel class="font-semibold">Current Balance</UiLabel>
                  <UiInput
                    v-model="form.balance"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="How much do you have in this wallet right now?"
                    required
                  />
                  <p class="text-xs text-muted-foreground leading-relaxed">
                    Enter your actual current balance. You can always update this later.
                  </p>
                </div>
              </form>
            </UiCardContent>
          </div>

          <div class="shrink-0 border-t border-border bg-muted/20 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-3 sm:flex-row-reverse">
            <UiButton type="submit" form="wallet-form" :disabled="store.loading" class="rounded-xl h-11 px-8 bg-primary text-primary-foreground font-bold">
              {{ store.loading ? (editingId ? 'Saving…' : 'Adding…') : (editingId ? 'Save changes' : 'Add wallet') }}
            </UiButton>
            <UiButton variant="outline" @click="showForm = false" class="rounded-xl h-11 px-6">
              Cancel
            </UiButton>
            <UiButton v-if="editingId" type="button" variant="destructive" @click="store.remove(editingId); showForm = false" class="rounded-xl h-11 px-4 sm:mr-auto">
              <Trash2 class="h-4 w-4 mr-2" /> Delete
            </UiButton>
          </div>
        </UiCard>
      </div>
    </Teleport>
  </div>
</template>
