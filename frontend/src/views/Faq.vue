<script setup>
import { ref } from 'vue'
import AppBackButton from '@/components/AppBackButton.vue'
import { faqs } from '@/data/faqs.js'
import { HelpCircle, ChevronDown } from 'lucide-vue-next'

defineOptions({ name: 'Faq' })

const openFaq = ref(null)

function toggleFaq(idx) {
  openFaq.value = openFaq.value === idx ? null : idx
}
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-8 sm:px-6 animate-fade-in">
    <div class="mb-6 flex items-center gap-2">
      <AppBackButton to="/settings" title="Back to Settings" />
      <span class="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Back to Settings</span>
    </div>

    <div class="mb-8">
      <h1 class="text-2xl font-medium tracking-tight text-foreground">Frequently Asked Questions</h1>
      <p class="mt-1 text-xs text-muted-foreground">
        Tap a question to read the answer.
      </p>
    </div>

    <div class="space-y-3">
      <div
        v-for="(faq, idx) in faqs"
        :key="idx"
        class="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
      >
        <button
          type="button"
          class="w-full flex items-center justify-between gap-3 p-4 sm:p-5 hover:bg-muted/30 transition-colors text-left"
          @click="toggleFaq(idx)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/30">
              <HelpCircle class="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <h2 class="text-sm font-bold text-foreground leading-snug">{{ faq.q }}</h2>
          </div>
          <ChevronDown
            class="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200"
            :class="openFaq === idx ? 'rotate-180' : ''"
          />
        </button>
        <div
          v-if="openFaq === idx"
          class="px-5 pb-4 pt-0 pl-[68px] text-sm text-muted-foreground leading-relaxed animate-fade-in"
        >
          {{ faq.a }}
        </div>
      </div>
    </div>
  </section>
</template>
