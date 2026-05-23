<script setup>
import { ChevronLeft, Wallet, Banknote, HandCoins, Receipt, Sparkles } from 'lucide-vue-next'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'

defineOptions({ name: 'Guide' })

const steps = [
  {
    number: 1,
    title: 'Add your first Wallet',
    description: 'Create at least one wallet (GCash, Cash, Bank) so your money has a place to be tracked.',
    icon: Wallet,
    color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-900/50'
  },
  {
    number: 2,
    title: 'Set your Monthly Salary',
    description: 'Set your monthly salary baseline in Settings. It powers Budget Left and spending pressure insights.',
    icon: Banknote,
    color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
  },
  {
    number: 3,
    title: 'Deposit your Salary',
    description: 'Deposit loads real money into a selected wallet so you can spend from actual balances.',
    icon: HandCoins,
    color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
  },
  {
    number: 4,
    title: 'Track your first Expense',
    description: 'Log daily spending to update wallet balances and budget tracking in real time.',
    icon: Receipt,
    color: 'text-rose-600 bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
  }
]
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-8 sm:px-6 animate-fade-in">
    <!-- Back to Settings Link -->
    <div class="mb-6 flex items-center gap-2">
      <RouterLink 
        to="/settings" 
        class="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        title="Back to Settings"
      >
        <ChevronLeft class="h-5 w-5" />
      </RouterLink>
      <span class="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Back to Settings</span>
    </div>

    <!-- Page Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-medium tracking-tight text-foreground">Quick Start Guidelines</h1>
      <p class="mt-1 text-xs text-muted-foreground">
        Reference these baseline setup principles to ensure your financial dashboards, wallets, and automated tracking are configured correctly.
      </p>
    </div>

    <!-- Guidelines Grid -->
    <div class="space-y-4 mb-8">
      <div 
        v-for="step in steps" 
        :key="step.number"
        class="flex flex-col sm:flex-row items-start gap-4 p-5 rounded-2xl border border-border bg-card shadow-sm select-none"
      >
        <div :class="`h-12 w-12 rounded-2xl flex items-center justify-center border ${step.color} shrink-0`">
          <component :is="step.icon" class="h-6 w-6" />
        </div>
        <div class="space-y-1">
          <div class="flex items-center gap-2.5">
            <span class="text-[10px] font-black uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
              Step 0{{ step.number }}
            </span>
            <h2 class="text-base font-bold text-foreground leading-none">{{ step.title }}</h2>
          </div>
          <p class="text-sm text-muted-foreground leading-relaxed mt-2">{{ step.description }}</p>
        </div>
      </div>
    </div>

    <!-- AI Mascot Pro Tips -->
    <UiCard class="border-emerald-500/20 bg-emerald-500/5 select-none">
      <UiCardContent class="p-5 sm:p-6 space-y-4">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Sparkles class="h-4.5 w-4.5" />
          </div>
          <p class="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            AI Assistant Quick Commands
          </p>
        </div>
        <p class="text-sm text-emerald-900 dark:text-emerald-100 leading-relaxed">
          You can also talk to EleFam AI using natural language or commands to manage your wallet setups, salary configuration, and daily log inputs:
        </p>
        <div class="grid gap-2 text-xs font-mono">
          <div class="rounded-xl bg-emerald-100/50 dark:bg-emerald-900/30 px-3.5 py-2.5 text-emerald-900 dark:text-emerald-200 border border-emerald-200/30">
            new wallet GCash
          </div>
          <div class="rounded-xl bg-emerald-100/50 dark:bg-emerald-900/30 px-3.5 py-2.5 text-emerald-900 dark:text-emerald-200 border border-emerald-200/30">
            set salary 25000
          </div>
          <div class="rounded-xl bg-emerald-100/50 dark:bg-emerald-900/30 px-3.5 py-2.5 text-emerald-900 dark:text-emerald-200 border border-emerald-200/30">
            deposit 25000 to GCash
          </div>
          <div class="rounded-xl bg-emerald-100/50 dark:bg-emerald-900/30 px-3.5 py-2.5 text-emerald-900 dark:text-emerald-200 border border-emerald-200/30">
            spent 500 on food from GCash
          </div>
          <div class="rounded-xl bg-emerald-100/50 dark:bg-emerald-900/30 px-3.5 py-2.5 text-emerald-900 dark:text-emerald-200 border border-emerald-200/30">
            set my budget to 15000
          </div>
          <div class="rounded-xl bg-emerald-100/50 dark:bg-emerald-900/30 px-3.5 py-2.5 text-emerald-900 dark:text-emerald-200 border border-emerald-200/30">
            transfer 1000 from GCash to Maya
          </div>
        </div>
      </UiCardContent>
    </UiCard>
  </section>
</template>
