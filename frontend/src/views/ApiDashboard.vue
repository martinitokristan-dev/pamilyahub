<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20 p-4">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <AppBackButton />
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">API Usage</h1>
      </div>
      
      <div class="flex items-center gap-3">
        <!-- Period Selector -->
        <select 
          v-model="selectedPeriod" 
          @change="fetchData" 
          class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-auto min-w-[140px] p-2 outline-none shadow-sm transition-colors"
          :disabled="loading"
        >
          <option value="30m">Last 30 Minutes</option>
          <option value="1h">Last 1 Hour</option>
          <option value="10h">Last 10 Hours</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>

        <button @click="fetchData" class="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex-shrink-0" :class="{'opacity-50 cursor-not-allowed': loading}" :disabled="loading">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-600 dark:text-slate-400" :class="{'animate-spin': loading}"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl flex flex-col items-center justify-center space-y-3 shadow-sm border border-red-100 dark:border-red-900/30">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p class="font-medium text-center">{{ error }}</p>
      <button @click="fetchData" class="px-4 py-2 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded-xl transition-colors font-medium">Try Again</button>
    </div>

    <!-- Skeleton Loading State -->
    <div v-else-if="loading && !data.usage_stats.length" class="space-y-6">
      <div class="bg-white dark:bg-slate-800 rounded-[10px] p-5 border border-slate-100 dark:border-slate-700 h-64 animate-pulse"></div>
      <div class="bg-white dark:bg-slate-800 rounded-[10px] p-5 border border-slate-100 dark:border-slate-700 h-64 animate-pulse"></div>
    </div>

    <!-- Data State -->
    <div v-else class="space-y-6">
      
      <!-- Unified Usage Table -->
      <div class="bg-white dark:bg-[#151515] rounded-[10px] border border-slate-100 dark:border-[#222] shadow-sm overflow-hidden">
        <div class="p-5 border-b border-slate-100 dark:border-[#222]">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">API Usage Limits & Consumptions</h2>
        </div>
        
        <div v-if="!data.usage_stats.length" class="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">
          No API usage logged in the selected period.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr class="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#1a1a1a]">
                <th class="py-4 px-5 font-semibold">Provider / Key</th>
                <th class="py-4 px-5 font-semibold">Total Requests ({{ periodLabel }})</th>
                <th class="py-4 px-5 font-semibold text-indigo-600 dark:text-indigo-400">Current RPM (Last 60s)</th>
                <th class="py-4 px-5 font-semibold">Tokens Used</th>
                <th class="py-4 px-5 font-semibold">Avg Response Time</th>
                <th class="py-4 px-5 font-semibold">Errors</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-[#222]">
              <tr v-for="(stat, idx) in allKeyStats" :key="idx" class="text-slate-700 dark:text-[#d4d4d4] hover:bg-slate-50/50 dark:hover:bg-[#1c1c1c] transition-colors">
                <td class="py-4 px-5">
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full animate-pulse-subtle" :class="getProviderInfo(stat.provider).colorClass"></span>
                    <span class="font-medium text-slate-900 dark:text-white">{{ getProviderInfo(stat.provider).name }}</span>
                    <span class="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#252525] px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#333]">{{ stat.key_prefix }}...</span>
                    <span v-if="stat.is_standby" class="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-1.5 py-0.5 rounded-full">Standby</span>
                  </div>
                </td>
                <td class="py-4 px-5">
                  <div class="font-medium">{{ stat.total_requests.toLocaleString() }}</div>
                  <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Limit: {{ getProviderInfo(stat.provider).reqLimit }}
                  </div>
                </td>
                <td class="py-4 px-5">
                  <div class="flex items-center gap-2">
                    <span class="relative flex h-2 w-2">
                      <span v-if="stat.current_rpm > 0" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2" :class="stat.current_rpm > 0 ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'"></span>
                    </span>
                    <span class="font-bold text-indigo-600 dark:text-indigo-400">{{ stat.current_rpm || 0 }}</span>
                  </div>
                </td>
                <td class="py-4 px-5 font-mono text-xs">
                  <div v-if="stat.total_tokens">
                    <span>{{ (stat.total_tokens / 1000).toFixed(1) }}K</span>
                    <div class="text-[10px] font-sans text-slate-400 dark:text-slate-500 mt-0.5">
                      Limit: {{ getProviderInfo(stat.provider).tpmLimit }}
                    </div>
                  </div>
                  <span v-else class="text-slate-400 dark:text-slate-600 italic">Not tracked</span>
                </td>
                <td class="py-4 px-5 font-mono text-xs">
                  {{ stat.avg_response_time ? Math.round(stat.avg_response_time) + 'ms' : '-' }}
                </td>
                <td class="py-4 px-5">
                  <span v-if="stat.error_count > 0" class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                    {{ stat.error_count }} failed
                  </span>
                  <span v-else class="text-slate-400 dark:text-slate-600">-</span>
                </td>
              </tr>
            </tbody>
            <!-- Total Row -->
            <tfoot class="bg-slate-50 dark:bg-[#1a1a1a] border-t border-slate-100 dark:border-[#222]">
              <tr class="font-bold text-slate-900 dark:text-white">
                <td class="py-4 px-5">Total</td>
                <td class="py-4 px-5">{{ totalRequests.toLocaleString() }}</td>
                <td class="py-4 px-5 font-bold text-indigo-600 dark:text-indigo-400">{{ currentRpmTotal }}</td>
                <td class="py-4 px-5 font-mono text-xs">{{ (totalTokens / 1000).toFixed(1) }}K</td>
                <td class="py-4 px-5"></td>
                <td class="py-4 px-5">
                  <span v-if="totalErrors > 0" class="text-red-500">{{ totalErrors }}</span>
                  <span v-else class="text-slate-400 dark:text-slate-600">-</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Activity Chart (CSS Based) -->
      <div class="bg-white dark:bg-[#151515] rounded-[10px] p-5 border border-slate-100 dark:border-[#222] shadow-sm">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-6">Activity Timeline ({{ periodLabel }})</h2>
        
        <div v-if="chartDataNormalized.every(c => c.count === 0)" class="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
          No activity in this period.
        </div>
        
        <div v-else class="overflow-x-auto pb-6 pt-8 thin-scrollbar">
          <div class="relative h-[240px]" :style="{ minWidth: chartMinWidth }">
            
            <!-- Border line for X axis -->
            <div class="absolute bottom-6 left-0 right-0 border-b border-slate-200 dark:border-[#333]"></div>

            <!-- SVG Line Chart -->
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute left-0 right-0 bottom-6 w-full h-[150px] pointer-events-none overflow-visible">
              <polyline 
                fill="none" 
                stroke="#6366f1" 
                stroke-width="2.5" 
                vector-effect="non-scaling-stroke"
                :points="polylinePoints" 
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

            <!-- Interaction Layer & Labels -->
            <div class="absolute left-0 right-0 bottom-0 h-full flex items-end justify-between">
              <div v-for="(col, idx) in chartDataNormalized" :key="idx" class="flex flex-col items-center flex-1 group h-full relative">
                
                <!-- Hover Area -->
                <div class="w-full absolute bottom-6 h-[150px] cursor-crosshair">
                  <!-- Vertical Hover Line -->
                  <div class="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-slate-200 dark:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <!-- Data Point (Dot) -->
                  <div class="absolute w-2.5 h-2.5 bg-white dark:bg-[#151515] rounded-full border-2 border-indigo-500 left-1/2 -translate-x-1/2 transform transition-transform duration-200 group-hover:scale-150 group-hover:bg-indigo-500 z-10" 
                       :style="{ bottom: `calc(${col.percentage}% - 5px)` }"></div>
                       
                  <!-- Tooltip -->
                  <div class="opacity-0 group-hover:opacity-100 absolute bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs py-1.5 px-3 rounded-lg pointer-events-none whitespace-nowrap z-20 transition-opacity shadow-xl flex flex-col items-center" 
                       :class="[
                         idx === 0 ? 'left-[50%] -translate-x-2' : 
                         idx === chartDataNormalized.length - 1 ? 'right-[50%] translate-x-2' : 
                         'left-[50%] -translate-x-1/2'
                       ]"
                       :style="{ bottom: `calc(${col.percentage}% + 12px)` }">
                    <span class="font-bold">{{ col.count }} <span class="font-normal opacity-80">requests</span></span>
                    <span class="text-[10px] opacity-70 mt-0.5">{{ col.tooltipLabel || col.label }}</span>
                  </div>
                </div>

                <!-- Labels -->
                <div v-if="col.showLabel !== false" class="text-[10px] text-slate-400 dark:text-slate-500 absolute bottom-0 font-medium whitespace-nowrap">
                  {{ col.label }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Errors -->
      <div class="bg-white dark:bg-[#151515] rounded-[10px] p-5 border border-slate-100 dark:border-[#222] shadow-sm">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Errors (4xx/5xx)</h2>
        
        <div v-if="!data.recent_errors.length" class="text-center py-8 flex flex-col items-center text-emerald-600 dark:text-emerald-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mb-2 opacity-50"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          <span class="text-sm font-medium">No recent API errors!</span>
        </div>
        
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr class="text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-[#222]">
                <th class="pb-3 font-medium px-2">Time</th>
                <th class="pb-3 font-medium px-2">Provider</th>
                <th class="pb-3 font-medium px-2">Status</th>
                <th class="pb-3 font-medium px-2">Endpoint</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-[#222]">
              <tr v-for="err in data.recent_errors" :key="err.id" class="text-slate-700 dark:text-slate-300">
                <td class="py-3 px-2">{{ formatTime(err.created_at) }}</td>
                <td class="py-3 px-2">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full" :class="getProviderInfo(err.provider).colorClass"></span>
                    <span class="capitalize">{{ getProviderInfo(err.provider).name }}</span>
                    <span class="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-[#252525] px-1 rounded">{{ err.key_prefix }}...</span>
                  </div>
                </td>
                <td class="py-3 px-2">
                  <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                    {{ err.status_code }}
                  </span>
                </td>
                <td class="py-3 px-2 font-mono text-xs">{{ err.endpoint }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';

// Global state outside the component lifecycle so it persists across page navigation
const globalData = ref({
  usage_stats: [],
  recent_errors: [],
  chart_data: [],
  configured_keys: []
});
const globalPeriod = ref('24h');
const globalHasLoaded = ref(false);
</script>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue';
import api from '@/lib/axios.js';
import AppBackButton from '@/components/AppBackButton.vue';

const providerConfig = {
  gemini: {
    name: 'Gemini',
    colorClass: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
    reqLimit: '15 RPM / 500 RPD',
    tpmLimit: '250k TPM'
  },
  qwen: {
    name: 'Qwen',
    colorClass: 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]',
    reqLimit: '60 RPM / 1k RPD / 500k TPD',
    tpmLimit: '6k TPM'
  },
  llama: {
    name: 'Llama',
    colorClass: 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]',
    reqLimit: '30 RPM / 14.4k RPD / 500k TPD',
    tpmLimit: '6k TPM'
  }
};

const getProviderInfo = (provider) => {
  return providerConfig[provider?.toLowerCase()] || {
    name: provider || 'Unknown',
    colorClass: 'bg-slate-500',
    reqLimit: 'N/A',
    tpmLimit: 'N/A'
  };
};

const selectedPeriod = globalPeriod;
const data = globalData;
const loading = ref(!globalHasLoaded.value);
const error = ref(null);
let pollInterval = null;

const chartMinWidth = computed(() => {
  if (selectedPeriod.value === '30d') return '1200px';
  if (selectedPeriod.value === '24h') return '800px';
  if (selectedPeriod.value === '10h') return '800px';
  if (selectedPeriod.value === '1h')  return '600px';
  if (selectedPeriod.value === '30m') return '500px';
  return '600px';
});

const periodLabel = computed(() => {
  const map = {
    '30m': 'Last 30 Minutes',
    '1h':  'Last 1 Hour',
    '10h': 'Last 10 Hours',
    '7d':  'Last 7 Days',
    '30d': 'Last 30 Days',
  };
  return map[selectedPeriod.value] || 'Last 24 Hours';
});

const fetchData = async (showLoading = true) => {
  // Only show loading spinner if we don't have cached data to show
  if (showLoading && !globalHasLoaded.value) loading.value = true;
  error.value = null;
  
  try {
    const response = await api.get('/admin/api-usage', {
      params: { 
        period: selectedPeriod.value,
        _t: Date.now() 
      }
    });
    data.value = response.data;
    globalHasLoaded.value = true;
  } catch (err) {
    if (err.response?.status === 403) {
      error.value = "You are not authorized to view this dashboard.";
    } else {
      error.value = "Failed to load API usage data. Please try again.";
    }
    console.error("API Dashboard Error:", err);
  } finally {
    loading.value = false;
  }
};

// Merge configured_keys (all env keys) with actual usage_stats.
// Keys that have never been used appear with 0 requests — they are
// standby backup keys that simply haven't been needed yet.
const allKeyStats = computed(() => {
  const configured = data.value.configured_keys || [];
  const stats = data.value.usage_stats || [];

  // Build a lookup: "provider_keyprefix" -> stat row
  const statMap = {};
  for (const s of stats) {
    statMap[s.provider + '_' + s.key_prefix] = s;
  }

  return configured.map(cfg => {
    const mapKey = cfg.provider + '_' + cfg.key_prefix;
    const existing = statMap[mapKey];
    if (existing) return existing;
    // Return a zero-usage row for uncalled backup keys
    return {
      provider: cfg.provider,
      key_prefix: cfg.key_prefix,
      total_requests: 0,
      total_tokens: null,
      avg_response_time: null,
      error_count: 0,
      current_rpm: 0,
      is_standby: true,
    };
  });
});

const totalRequests = computed(() => {
  return allKeyStats.value.reduce((acc, curr) => acc + curr.total_requests, 0);
});

const currentRpmTotal = computed(() => {
  return allKeyStats.value.reduce((acc, curr) => acc + (curr.current_rpm || 0), 0);
});

const totalTokens = computed(() => {
  return allKeyStats.value.reduce((acc, curr) => acc + Number(curr.total_tokens || 0), 0);
});

const totalErrors = computed(() => {
  return allKeyStats.value.reduce((acc, curr) => acc + Number(curr.error_count || 0), 0);
});


// Build dynamic chart data based on period
const chartDataNormalized = computed(() => {
  if (!data.value || !data.value.chart_data) return [];
  
  const timeBuckets = [];
  const now = new Date();
  
  // Helper: format HH:MM (24h zero-padded) to match PHP H:i format
  const fmt = (d) => {
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };
  const label12 = (d, showSec = false) => {
    const h = d.getHours() % 12 || 12;
    const m = d.getMinutes().toString().padStart(2, '0');
    const ap = d.getHours() >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${ap}`;
  };

  if (selectedPeriod.value === '30m') {
    // 30 buckets — one per minute
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setMinutes(d.getMinutes() - i, 0, 0);
      timeBuckets.push({
        id: fmt(d),
        label: label12(d),
        showLabel: d.getMinutes() % 5 === 0, // label every 5 min
        count: 0
      });
    }
  } else if (selectedPeriod.value === '1h') {
    // 12 buckets — one per 5 minutes
    const flooredMin = Math.floor(now.getMinutes() / 5) * 5;
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMinutes(flooredMin - i * 5, 0, 0);
      timeBuckets.push({
        id: fmt(d),
        label: label12(d),
        count: 0
      });
    }
  } else if (selectedPeriod.value === '10h') {
    // 20 buckets — one per 30 minutes
    const flooredMin = Math.floor(now.getMinutes() / 30) * 30;
    for (let i = 19; i >= 0; i--) {
      const d = new Date(now);
      d.setMinutes(flooredMin - i * 30, 0, 0);
      timeBuckets.push({
        id: fmt(d),
        label: label12(d),
        count: 0
      });
    }
  } else if (selectedPeriod.value === '24h') {
    // 24 buckets — one per hour
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(d.getHours() - i, 0, 0, 0);
      const hour = d.getHours();
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      const is4HourMark = (hour % 4 === 0);
      timeBuckets.push({
        id: d.getHours().toString().padStart(2, '0'),
        label: `${hour12}:00 ${ampm}`,
        tooltipLabel: `${hour12}:00 ${ampm}`,
        showLabel: is4HourMark,
        count: 0
      });
    }
  } else {
    // 7d or 30d — one per day
    const daysCount = selectedPeriod.value === '7d' ? 6 : 29;
    for (let i = daysCount; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      timeBuckets.push({ id: dateStr, label, count: 0 });
    }
  }

  // Map backend data to buckets
  data.value.chart_data.forEach(item => {
    const targetBucket = timeBuckets.find(b => b.id === item.time_group);
    
    if (targetBucket) {
      targetBucket.count += item.count;
    }
  });

  // Calculate max for percentage heights
  const max = Math.max(...timeBuckets.map(b => b.count), 1);
  
  return timeBuckets.map(b => ({
    ...b,
    percentage: (b.count / max) * 100
  }));
});

const formatTime = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const polylinePoints = computed(() => {
  const n = chartDataNormalized.value.length;
  if (n === 0) return '';
  if (n === 1) return `50,${100 - chartDataNormalized.value[0].percentage}`;
  
  return chartDataNormalized.value.map((col, idx) => {
    const x = ((idx + 0.5) / n) * 100;
    const y = 100 - col.percentage;
    return `${x},${y}`;
  }).join(' ');
});

onMounted(() => {
  fetchData();
  // Poll every 5 seconds without showing loading spinner
  pollInterval = setInterval(() => {
    fetchData(false);
  }, 5000);
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
});
</script>

<style scoped>
@keyframes pulse-subtle {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.93); }
}
.animate-pulse-subtle {
  animation: pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
