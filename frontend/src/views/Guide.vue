<script setup>
import AppBackButton from '@/components/AppBackButton.vue'
import UiCard from '@/components/ui/Card.vue'
import UiCardContent from '@/components/ui/CardContent.vue'

defineOptions({ name: 'Guide' })

const steps = [
  {
    number: 1,
    title: 'Add your first Wallet',
    description: 'Create at least one wallet (GCash, Cash, Bank) so your money has a place to be tracked. You can set a starting balance when creating it.'
  },
  {
    number: 2,
    title: 'Set your Monthly Salary',
    description: 'Set your monthly salary baseline in Settings. It powers Budget Left, spending pressure indicators, and helps Marti AI give accurate budget insights.'
  },
  {
    number: 3,
    title: 'Deposit your Salary',
    description: 'Deposit loads real money into a selected wallet so you can spend from actual balances and track your income month by month.'
  },
  {
    number: 4,
    title: 'Track your first Expense',
    description: 'Log daily spending to update wallet balances and budget tracking in real time. Use categories like food, transport, bills, and shopping.'
  },
  {
    number: 5,
    title: 'Add Upcoming Plans',
    description: 'Create Plans for recurring bills like rent, electricity, subscriptions, and loans. Plans track due dates and remind you 7 and 2 days before payment is due.'
  },
  {
    number: 6,
    title: 'Enable Payment Reminders',
    description: 'Go to Settings and toggle on Payment Reminders. Allow notification permissions so Elefam can alert you before bills are due — even on iOS when added to Home Screen.'
  }
]

const commandGroups = [
  {
    label: 'Wallets',
    color: 'emerald',
    commands: [
      { text: 'new wallet GCash 5000', desc: 'Create a new wallet' },
      { text: 'deposit 25000 to GCash', desc: 'Add money to a wallet' },
      { text: 'transfer 1000 from GCash to Maya', desc: 'Move money between wallets' },
      { text: 'show my wallets', desc: 'View all wallets and balances' },
    ]
  },
  {
    label: 'Expenses',
    color: 'violet',
    commands: [
      { text: 'spent 500 on food from GCash', desc: 'Log an expense' },
      { text: 'how much did I spend', desc: 'Check monthly expenses' },
    ]
  },
  {
    label: 'Plans & Bills',
    color: 'amber',
    commands: [
      { text: 'show my plans', desc: 'View upcoming payments' },
      { text: 'add plan Globe 999 due June 30', desc: 'Create a new plan' },
      { text: 'pay plan Netflix 299 from GCash', desc: 'Pay an upcoming plan' },
      { text: 'what are my upcoming payments', desc: 'List all unpaid plans' },
    ]
  },
  {
    label: 'Debts',
    color: 'rose',
    commands: [
      { text: 'i owe Ana 800', desc: 'Record money you owe' },
      { text: 'Mark owes me 400', desc: 'Record money owed to you' },
      { text: 'pay Ana 300 from GCash', desc: 'Pay off a debt' },
      { text: 'who owes me', desc: 'View outstanding debts' },
    ]
  },
]

const colorMap = {
  emerald: 'bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 border-emerald-200/30',
  violet:  'bg-violet-100/50 dark:bg-violet-900/30 text-violet-900 dark:text-violet-200 border-violet-200/30',
  amber:   'bg-amber-100/50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border-amber-200/30',
  rose:    'bg-rose-100/50 dark:bg-rose-900/30 text-rose-900 dark:text-rose-200 border-rose-200/30',
}

const labelColorMap = {
  emerald: 'text-emerald-700 dark:text-emerald-300',
  violet:  'text-violet-700 dark:text-violet-300',
  amber:   'text-amber-700 dark:text-amber-300',
  rose:    'text-rose-700 dark:text-rose-300',
}
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-8 sm:px-6 animate-fade-in">
    <div class="mb-6 flex items-center gap-2">
      <AppBackButton 
        to="/settings" 
        title="Back to Settings"
      />
      <span class="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Back to Settings</span>
    </div>

    <!-- Page Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-medium tracking-tight text-foreground">Quick Start Guide</h1>
      <p class="mt-1 text-xs text-muted-foreground">
        Follow these steps to get Elefam fully configured and start tracking your family finances with confidence.
      </p>
    </div>

    <!-- Guidelines Grid -->
    <div class="space-y-4 mb-8">
      <div 
        v-for="step in steps" 
        :key="step.number"
        class="p-5 rounded-2xl border border-border bg-card shadow-sm select-none"
      >
        <div class="space-y-1">
          <h2 class="text-base font-bold text-foreground">
            Step {{ step.number }}: {{ step.title }}
          </h2>
          <p class="text-sm text-muted-foreground leading-relaxed mt-2">{{ step.description }}</p>
        </div>
      </div>
    </div>

    <!-- AI Mascot Command Groups -->
    <div class="space-y-4">
      <div
        v-for="group in commandGroups"
        :key="group.label"
      >
        <UiCard :class="`border-${group.color}-500/20 bg-${group.color}-500/5 select-none`">
          <UiCardContent class="p-5 sm:p-6 space-y-3">
            <p :class="['text-xs font-bold uppercase tracking-wider', labelColorMap[group.color]]">
              Marti AI — {{ group.label }} Commands
            </p>
            <div class="grid gap-2">
              <div
                v-for="cmd in group.commands"
                :key="cmd.text"
                class="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5"
                :class="colorMap[group.color]"
              >
                <code class="text-xs font-mono">{{ cmd.text }}</code>
                <span class="text-[10px] opacity-60 shrink-0 hidden sm:block">{{ cmd.desc }}</span>
              </div>
            </div>
          </UiCardContent>
        </UiCard>
      </div>
    </div>
  </section>
</template>
