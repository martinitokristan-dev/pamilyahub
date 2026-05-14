import { defineStore } from "pinia";
import { ref } from "vue";
import { expenseService } from "@/services/expenseService.js";
import { useDashboardStore } from "./dashboard.js";
import { useToast } from "@/composables/useToast.js";
import { performSilentFetch } from "@/utils/storeHelper.js";

export const useExpensesStore = defineStore("expenses", () => {
  const expenses = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const fetched = ref(false);
  const cacheTime = ref(0);
  const pagination = ref({ page: 1, per_page: 20, total: 0, last_page: 1 });
  const lastFilters = ref(null);

  async function fetchAll(page = 1, filters = {}) {
    const filtersStr = JSON.stringify(filters);
    const filtersChanged = lastFilters.value !== filtersStr;

    if (filtersChanged) {
      fetched.value = false;
    }
    
    lastFilters.value = filtersStr;
    
    await performSilentFetch({
      loading,
      fetched,
      cacheTime,
      currentData: expenses.value,
      force: filtersChanged,
      backgroundTtl: 60000,
      fetchFn: async () => {
        const res = await expenseService.getAll({ page, ...filters });
        if (res.data && res.data.data && Array.isArray(res.data.data.data)) {
          expenses.value = res.data.data.data;
          pagination.value = {
            page: res.data.data.current_page,
            per_page: res.data.data.per_page,
            total: res.data.data.total,
            last_page: res.data.data.last_page,
          };
        } else if (res.data && Array.isArray(res.data.data)) {
          expenses.value = res.data.data;
          pagination.value = { page: 1, per_page: expenses.value.length, total: expenses.value.length, last_page: 1 };
        } else {
          expenses.value = [];
          pagination.value = { page: 1, per_page: 20, total: 0, last_page: 1 };
        }
      }
    }).catch(e => {
      error.value = e.response?.data?.message ?? "Failed to load expenses";
    });
  }

  async function create(data) {
    loading.value = true;
    try {
      const res = await expenseService.create(data);
      expenses.value.unshift(res.data.data);
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("Expense created");
      return res.data.data;
    } finally {
      loading.value = false;
    }
  }

  async function update(id, data) {
    loading.value = true;
    try {
      const res = await expenseService.update(id, data);
      const idx = expenses.value.findIndex((e) => e.id === id);
      if (idx !== -1) expenses.value[idx] = res.data.data;
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("Expense updated");
      return res.data.data;
    } finally {
      loading.value = false;
    }
  }

  async function remove(id) {
    loading.value = true;
    try {
      await expenseService.delete(id);
      expenses.value = expenses.value.filter((e) => e.id !== id);
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("Expense deleted");
    } finally {
      loading.value = false;
    }
  }

  function invalidate() {
    fetched.value = false;
  }

  return {
    expenses,
    loading,
    error,
    fetched,
    cacheTime,
    pagination,
    fetchAll,
    create,
    update,
    remove,
    invalidate,
  };
});
