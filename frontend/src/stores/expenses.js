import { defineStore } from "pinia";
import { ref } from "vue";
import { expenseService } from "@/services/expenseService.js";
import { useDashboardStore } from "./dashboard.js";
import { useToast } from "@/composables/useToast.js";

export const useExpensesStore = defineStore("expenses", () => {
  const expenses = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const fetched = ref(false);

  async function fetchAll(page = 1, filters = {}) {
    loading.value = true;
    try {
      const res = await expenseService.getAll({ page, ...filters });
      if (res.data && res.data.data && Array.isArray(res.data.data.data)) {
        expenses.value = res.data.data.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        expenses.value = res.data.data;
      } else {
        expenses.value = [];
      }
      fetched.value = true;
    } catch (e) {
      error.value = e.response?.data?.message ?? "Failed to load expenses";
    } finally {
      loading.value = false;
    }
  }

  async function create(data) {
    loading.value = true;
    try {
      const res = await expenseService.create(data);
      expenses.value.unshift(res.data.data);
      useDashboardStore().invalidate();
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
      useToast().success("Expense deleted");
    } finally {
      loading.value = false;
    }
  }

  return {
    expenses,
    loading,
    error,
    fetched,
    fetchAll,
    create,
    update,
    remove,
  };
});
