import { defineStore } from "pinia";
import { ref } from "vue";
import dashboardService from "@/services/dashboardService.js";

import { performSilentFetch } from "@/utils/storeHelper.js";
import {
  cacheSingleSet,
  cacheSingleGet,
  cacheSingleRemove,
  isNetworkError,
} from "@/lib/offlineDb.js";

export const useDashboardStore = defineStore("dashboard", () => {
  const stats = ref({
    notes_count: 0,
    expenses_total: 0,
    debts_owed_to_me: 0,
    debts_i_owe: 0,
    files_count: 0,
  });
  const loading = ref(false);
  const fetched = ref(false);
  const error = ref(null);
  const cacheTime = ref(0);
  const currentCacheKey = ref("");

  async function fetchStats(filters = {}, force = false) {
    const m = filters.month ?? new Date().getMonth() + 1;
    const y = filters.year ?? new Date().getFullYear();
    const cacheKey = `dashboard_${y}_${m}`;

    const isFiltersChanged =
      currentCacheKey.value && currentCacheKey.value !== cacheKey;
    if (isFiltersChanged) {
      stats.value = {
        notes_count: 0,
        expenses_total: 0,
        debts_owed_to_me: 0,
        debts_i_owe: 0,
        files_count: 0,
        monthly_expenses: 0,
        monthly_income: 0,
        remaining_salary: 0,
      };
      cacheTime.value = 0;
    }
    currentCacheKey.value = cacheKey;

    // Hydrate from IndexedDB if we have no data yet (offline cold start)
    if (!fetched.value && !stats.value.expenses_total) {
      try {
        const cached = await cacheSingleGet("dashboard", cacheKey);
        if (cached) stats.value = cached;
      } catch {
        /* ignore */
      }
    }

    await performSilentFetch({
      loading,
      fetched,
      cacheTime,
      currentData: stats.value,
      cacheKey,
      force,
      fetchFn: async () => {
        try {
          const res = await dashboardService.getStats(filters);
          stats.value = res.data.data;
          await cacheSingleSet("dashboard", res.data.data, cacheKey);
        } catch (e) {
          if (isNetworkError(e)) return; // keep cached value
          throw e;
        }
      },
    }).catch((e) => {
      if (!isNetworkError(e)) {
        error.value = e.response?.data?.message ?? "Failed to load stats";
      }
    });
  }

  function adjustStat(key, delta) {
    const current = parseFloat(stats.value[key] ?? 0);
    stats.value[key] = current + delta;
    // NOTE: remaining_salary is now calculated from wallet balances by the backend,
    // not derived from monthly_income and monthly_expenses adjustments.
    // The obsolete adjustment logic has been removed as part of the cumulative budget fix.
  }

  function invalidate(filters = {}) {
    const m = filters.month ?? new Date().getMonth() + 1;
    const y = filters.year ?? new Date().getFullYear();
    const cacheKey = `dashboard_${y}_${m}`;

    fetched.value = false;
    cacheSingleRemove("dashboard", cacheKey);
  }

  return {
    stats,
    loading,
    fetched,
    error,
    cacheTime,
    fetchStats,
    adjustStat,
    invalidate,
  };
});
