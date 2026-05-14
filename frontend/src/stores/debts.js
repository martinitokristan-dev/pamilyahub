import { defineStore } from "pinia";
import { ref } from "vue";
import { debtService } from "@/services/debtService.js";
import { useDashboardStore } from "./dashboard.js";
import { useToast } from "@/composables/useToast.js";
import { performSilentFetch } from "@/utils/storeHelper.js";

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export const useDebtsStore = defineStore("debts", () => {
  const debts = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const fetched = ref(false);
  const cacheTime = ref(null);
  const pagination = ref({
    page: 1,
    per_page: 20,
    total: 0,
    last_page: 1,
  });
  const lastFilters = ref(null);

  async function fetchAll(force = false, page = 1, perPage = 20, filters = {}) {
    const filtersStr = JSON.stringify(filters);
    const filtersChanged = lastFilters.value !== filtersStr;
    
    if (filtersChanged) {
      fetched.value = false;
      force = true; // Force refresh if filters changed
    }
    
    lastFilters.value = filtersStr;

    await performSilentFetch({
      loading,
      fetched,
      cacheTime,
      currentData: debts.value,
      force,
      backgroundTtl: 60000, // Check every 60s if not forced
      fetchFn: async () => {
        const res = await debtService.getAll(page, perPage, filters);

        // Process data
        if (res.data.data && res.data.data.data) {
          debts.value = res.data.data.data;
          pagination.value = {
            page: res.data.data.page,
            per_page: res.data.data.per_page,
            total: res.data.data.total,
            last_page: res.data.data.last_page,
          };
        } else {
          debts.value = res.data.data;
          pagination.value = {
            page: 1,
            per_page: debts.value.length,
            total: debts.value.length,
            last_page: 1,
          };
        }
      }
    }).catch(e => {
      error.value = e.response?.data?.message ?? "Failed to load debts";
    });
  }

  async function loadMore(page) {
    try {
      const res = await debtService.getAll(page, pagination.value.per_page);
      if (res.data.data && res.data.data.data) {
        debts.value.push(...res.data.data.data);
        pagination.value.page = page;
      }
    } catch (e) {
      error.value = e.response?.data?.message ?? "Failed to load more debts";
    }
  }

  async function create(data) {
    loading.value = true;
    try {
      const res = await debtService.create(data);
      debts.value.unshift(res.data.data);
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("Debt created");
      return res.data.data;
    } finally {
      loading.value = false;
    }
  }

  async function update(id, data) {
    loading.value = true;
    try {
      const res = await debtService.update(id, data);
      const idx = debts.value.findIndex((d) => d.id === id);
      if (idx !== -1) debts.value[idx] = res.data.data;
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("Debt updated");
      return res.data.data;
    } finally {
      loading.value = false;
    }
  }

  async function markPaid(id, walletId = null) {
    loading.value = true;
    try {
      const res = await debtService.markPaid(id, walletId);
      const idx = debts.value.findIndex((d) => d.id === id);
      if (idx !== -1) debts.value[idx] = res.data.data;
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("Debt marked as paid");
      return res.data.data;
    } finally {
      loading.value = false;
    }
  }

  async function partialPay(id, amount, walletId = null) {
    loading.value = true;
    try {
      const res = await debtService.partialPay(id, amount, walletId);
      const idx = debts.value.findIndex((d) => d.id === id);
      if (idx !== -1) debts.value[idx] = res.data.data;
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("Partial payment recorded");
      return res.data.data;
    } finally {
      loading.value = false;
    }
  }

  async function remove(id) {
    loading.value = true;
    try {
      await debtService.delete(id);
      debts.value = debts.value.filter((d) => d.id !== id);
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("Debt deleted");
    } finally {
      loading.value = false;
    }
  }

  function invalidate() {
    fetched.value = false;
  }

  return {
    debts,
    loading,
    error,
    fetched,
    pagination,
    fetchAll,
    loadMore,
    create,
    update,
    markPaid,
    partialPay,
    remove,
    invalidate,
  };
});
