<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 p-4">

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <AppBackButton />
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">AI Training Logs</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Phrases the local engine missed — review to expand <code class="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1 rounded">chatRules.json</code></p>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <button @click="fetchLogs" :disabled="loading" class="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'animate-spin': loading }" class="text-slate-600 dark:text-slate-400"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <button @click="confirmClearReviewed" :disabled="clearing" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Clear Reviewed Logs
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="bg-white dark:bg-[#151515] border border-slate-100 dark:border-[#222] rounded-xl p-4 h-16 animate-pulse"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!logs.length" class="bg-white dark:bg-[#151515] rounded-xl border border-slate-100 dark:border-[#222] shadow-sm p-12 text-center">
      <div class="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-600 dark:text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h3 class="font-semibold text-slate-900 dark:text-white text-lg">All caught up!</h3>
      <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">No unreviewed missed phrases found. The local engine is handling everything.</p>
    </div>

    <!-- Log Table -->
    <div v-else class="bg-white dark:bg-[#151515] rounded-xl border border-slate-100 dark:border-[#222] shadow-sm overflow-hidden">
      <div class="p-4 border-b border-slate-100 dark:border-[#222] flex items-center justify-between">
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ logs.length }} keyword group{{ logs.length !== 1 ? 's' : '' }} pending review</span>
        <div class="flex items-center gap-2">
          <button @click="selectAll" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Select All</button>
          <span class="text-slate-300 dark:text-slate-700">|</span>
          <button @click="deselectAll" class="text-xs text-slate-500 dark:text-slate-400 hover:underline">Deselect All</button>
        </div>
      </div>

      <div class="divide-y divide-slate-100 dark:divide-[#222]">
        <div v-for="group in logs" :key="group.keyword" class="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors cursor-pointer" @click="toggleSelect(group.keyword)">
          <!-- Checkbox -->
          <div class="pt-0.5 flex-shrink-0">
            <div class="w-5 h-5 rounded-md border-2 transition-colors flex items-center justify-center"
              :class="selected.has(group.keyword) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 dark:border-slate-600'">
              <svg v-if="selected.has(group.keyword)" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-4">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono font-semibold text-slate-900 dark:text-white text-sm">"{{ group.keyword }}"</span>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="intentColor(group.intent)">
                  {{ group.intent?.replace(/_/g, ' ') }}
                </span>
                <span class="text-xs text-slate-400 dark:text-slate-500">
                  {{ group.count }}× seen
                </span>
              </div>
              <button 
                v-if="group.reasoning"
                @click.stop="toggleReasoning(group.keyword)" 
                class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 flex-shrink-0"
              >
                {{ expandedReasoning.has(group.keyword) ? 'Hide reasoning' : 'View reasoning' }}
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{'rotate-180': expandedReasoning.has(group.keyword)}" class="transition-transform duration-200"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">e.g. "{{ group.example_input }}"</p>
            
            <!-- Collapsible Reasoning Block -->
            <div 
              v-if="expandedReasoning.has(group.keyword)" 
              class="mt-2.5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200"
              @click.stop
            >
              <div class="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-1.5 font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                <span>AI Reasoning Chain</span>
              </div>
              {{ group.reasoning }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions Row -->
    <div v-if="selected.size > 0" class="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl p-4">
      <span class="text-sm text-indigo-700 dark:text-indigo-300 font-medium">{{ selected.size }} group{{ selected.size !== 1 ? 's' : '' }} selected</span>
      <button @click="markDone" :disabled="marking" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        {{ marking ? 'Saving to chatRules.json...' : 'Approve & Save to chatRules.json' }}
      </button>
    </div>

    <!-- Generated JSON Preview -->
    <div v-if="logs.length" class="bg-white dark:bg-[#151515] rounded-xl border border-slate-100 dark:border-[#222] shadow-sm overflow-hidden">
      <div class="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#222]">
        <div>
          <h2 class="text-base font-bold text-slate-900 dark:text-white">Generated JSON</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Clicking "Approve & Save" automatically updates <code class="text-indigo-600 dark:text-indigo-400">chatRules.json</code>. Copy manually below if needed.</p>
        </div>
        <button @click="copyJson" class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-medium hover:opacity-90 transition-opacity">
          <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          {{ copied ? 'Copied!' : 'Copy JSON' }}
        </button>
      </div>
      <pre class="p-4 text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto thin-scrollbar bg-slate-50 dark:bg-[#111] leading-relaxed">{{ generatedJson }}</pre>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import api from '@/lib/axios.js';
import AppBackButton from '@/components/AppBackButton.vue';
import { loadRemoteChatRules } from '@/lib/chatEngine.js';

const logs = ref([]);
const loading = ref(false);
const marking = ref(false);
const clearing = ref(false);
const copied = ref(false);
const selected = ref(new Set());
const expandedReasoning = ref(new Set());

function toggleReasoning(keyword) {
  const next = new Set(expandedReasoning.value);
  if (next.has(keyword)) {
    next.delete(keyword);
  } else {
    next.add(keyword);
  }
  expandedReasoning.value = next;
}

async function fetchLogs() {
  loading.value = true;
  try {
    const res = await api.get('/admin/ai-logs');
    logs.value = res.data.data || [];
    selected.value = new Set();
  } catch (e) {
    console.error('Failed to fetch AI logs:', e);
  } finally {
    loading.value = false;
  }
}

function toggleSelect(keyword) {
  const s = new Set(selected.value);
  if (s.has(keyword)) {
    s.delete(keyword);
  } else {
    s.add(keyword);
  }
  selected.value = s;
}

function selectAll() {
  selected.value = new Set(logs.value.map((g) => g.keyword));
}

function deselectAll() {
  selected.value = new Set();
}

async function markDone() {
  if (!selected.value.size) return;
  marking.value = true;

  // Gather all IDs from selected keyword groups
  const ids = logs.value
    .filter((g) => selected.value.has(g.keyword))
    .flatMap((g) => g.ids);

  try {
    await api.post('/admin/ai-logs/mark-reviewed', { ids });
    // Remove the reviewed groups from the list
    logs.value = logs.value.filter((g) => !selected.value.has(g.keyword));
    selected.value = new Set();
    
    // Refresh chat engine's vocabulary in real time
    await loadRemoteChatRules();
  } catch (e) {
    console.error('Failed to mark as done:', e);
  } finally {
    marking.value = false;
  }
}

async function confirmClearReviewed() {
  if (!confirm('Hard delete ALL reviewed logs from the database? This cannot be undone.')) return;
  clearing.value = true;
  try {
    const res = await api.delete('/admin/ai-logs/clear-reviewed');
    alert(`Cleared ${res.data.deleted} reviewed log(s) from the database.`);
  } catch (e) {
    console.error('Failed to clear reviewed logs:', e);
  } finally {
    clearing.value = false;
  }
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(generatedJson.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch (e) {
    console.error('Clipboard failed:', e);
  }
}

// Map intent names to the correct chatRules.json key
const intentToRuleKey = {
  log_expense:   'expense_verbs',
  deposit:       'deposit_verbs',
  transfer:      'transfer_verbs',
  create_debt:   'debt_owe_verbs',
  pay_debt:      'pay_debt_verbs',
};

const intentTemplates = {
  log_expense: {
    matching_templates: [
      "{verb} <amount> <reason> from <wallet_name>",
      "{verb} <amount> on <reason>"
    ],
    response_templates: [
      "Logged expense of PHP <amount> for <reason> using <wallet_name>."
    ]
  },
  deposit: {
    matching_templates: [
      "{verb} <amount> to <wallet_name>",
      "{verb} <amount> in <wallet_name>"
    ],
    response_templates: [
      "Deposited PHP <amount> to <wallet_name>."
    ]
  },
  transfer: {
    matching_templates: [
      "{verb} <amount> from <from_wallet> to <to_wallet>"
    ],
    response_templates: [
      "Transferred PHP <amount> from <from_wallet> to <to_wallet>."
    ]
  },
  create_debt: {
    matching_templates: [
      "{verb} <person> <amount>",
      "<person> owes me <amount>"
    ],
    response_templates: [
      "Recorded debt: you owe <person> PHP <amount>",
      "Recorded debt: <person> owes you PHP <amount>"
    ]
  },
  pay_debt: {
    matching_templates: [
      "{verb} <person> <amount> from <wallet_name>",
      "settled <amount> with <person>"
    ],
    response_templates: [
      "Recorded payment of PHP <amount> to <person> from <wallet_name>."
    ]
  },
  set_budget: {
    matching_templates: [
      "{verb} my budget to <amount>",
      "set budget <amount>"
    ],
    response_templates: [
      "Monthly budget has been updated to PHP <amount>."
    ]
  },
  create_wallet: {
    matching_templates: [
      "{verb} wallet <wallet_name> <balance>",
      "new wallet <wallet_name>"
    ],
    response_templates: [
      "Created new wallet: <wallet_name> with starting balance of PHP <balance>."
    ]
  }
};

// Live JSON preview based on selected groups
const generatedJson = computed(() => {
  const result = {};
  const distilled = [];

  const activeGroups = selected.value.size > 0
    ? logs.value.filter((g) => selected.value.has(g.keyword))
    : logs.value;

  for (const group of activeGroups) {
    const key = intentToRuleKey[group.intent];
    if (key) {
      if (!result[key]) result[key] = [];
      if (!result[key].includes(group.keyword)) {
        result[key].push(group.keyword);
      }
    }

    const templates = intentTemplates[group.intent] || { matching_templates: [], response_templates: [] };
    const keyword = group.keyword || 'unknown';
    const matching = templates.matching_templates.map(t => t.replace('{verb}', keyword));

    distilled.push({
      matching_templates: matching,
      intent: group.intent,
      verbs: [keyword],
      reasoning: group.reasoning || `Detected phrase with verb '${keyword}' matching the ${group.intent} intent.`,
      response_templates: templates.response_templates,
      examples: [group.example_input]
    });
  }

  const finalOutput = {};
  if (Object.keys(result).length) {
    Object.assign(finalOutput, result);
  }
  if (distilled.length) {
    finalOutput.distilled_patterns = distilled;
  }

  if (!Object.keys(finalOutput).length) return '// Select keyword groups above to preview JSON';
  return JSON.stringify(finalOutput, null, 2);
});

function intentColor(intent) {
  const map = {
    log_expense:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    deposit:       'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    transfer:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    create_debt:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    pay_debt:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    set_budget:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    create_wallet: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  };
  return map[intent] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
}

onMounted(fetchLogs);
</script>
