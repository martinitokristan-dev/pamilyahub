import { defineStore } from "pinia";
import { ref } from "vue";
import { debtService } from "@/services/debtService.js";
import { useDashboardStore } from "./dashboard.js";
import { useWalletsStore } from "./wallets.js";
import { useToast } from "@/composables/useToast.js";
import {
  cacheGet,
  cacheSet,
  cacheUpsert,
  cacheRemove,
  outboxAdd,
  outboxGetPending,
  outboxUpdate,
  outboxRemove as outboxDeleteEntry,
  isNetworkError,
} from "@/lib/offlineDb.js";
import { refreshPendingCount, isSyncing } from "@/lib/syncEngine.js";
import { performSilentFetch } from "@/utils/storeHelper.js";

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
  const lastCacheKey = ref(null);

  // ── Sync event listeners ────────────────────────────────────────────────────
  if (typeof window !== "undefined") {
    window.addEventListener("pamilya:id-remap", (e) => {
      const { entity, tempId, realId, serverData } = e.detail;
      if (entity !== "debts" || !tempId) return;
      const idx = debts.value.findIndex((d) => d.id === tempId);
      if (idx !== -1 && serverData) {
        debts.value[idx] = { ...serverData, _pending: false };
      }
    });
    window.addEventListener("pamilya:sync-done", (e) => {
      if (e.detail.entity === "debts") {
        fetched.value = false;
        fetchAll();
        useDashboardStore().invalidate();
      }
    });
    window.addEventListener("pamilya:drain-complete", (e) => {
      const entities = e.detail?.entities || [];
      if (entities.includes("debts")) {
        fetched.value = false;
        lastCacheKey.value = null;
        fetchAll();
      }
    });
  }

  // ── fetchAll ────────────────────────────────────────────────────────────────
  async function fetchAll(force = false, page = 1, perPage = 20, filters = {}) {
    const cacheKey = `debts_p${page}_${JSON.stringify(filters)}`
    lastCacheKey.value = cacheKey

    return performSilentFetch({
      loading,
      fetched,
      cacheKey,
      backgroundTtl: 60000,
      force,
      fetchFn: async () => {
        // Hydrate from IndexedDB on first render
        if (debts.value.length === 0) {
          try {
            const cached = await cacheGet("debts")
            if (cached.length > 0) {
              debts.value = cached.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            }
          } catch { /* ignore */ }
        }

        // Block network fetch during outbox drain
        if (isSyncing.value) return

        try {
          const res = await debtService.getAll(page, perPage, filters)
          const pendingItems = debts.value.filter((d) => d._pending)
          let serverItems = []

          if (res.data.data && res.data.data.data) {
            serverItems = res.data.data.data
            pagination.value = {
              page: res.data.data.page,
              per_page: res.data.data.per_page,
              total: res.data.data.total,
              last_page: res.data.data.last_page,
            }
          } else {
            serverItems = res.data.data || []
            pagination.value = {
              page: 1,
              per_page: serverItems.length,
              total: serverItems.length,
              last_page: 1,
            }
          }

          const serverIds = new Set(serverItems.map((s) => String(s.id)))
          const unsyncedPending = pendingItems.filter((p) => !serverIds.has(String(p.id)))
          debts.value = [...unsyncedPending, ...serverItems]
          await cacheSet("debts", [...serverItems, ...unsyncedPending])
        } catch (e) {
          if (isNetworkError(e) && debts.value.length > 0) {
            // keep cached
          } else {
            error.value = e.response?.data?.message ?? "Failed to load debts"
          }
        }
      }
    })
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

  // ── create ──────────────────────────────────────────────────────────────────
  async function create(data) {
    if (!navigator.onLine) return _createOffline(data);
    loading.value = true;
    try {
      const res = await debtService.create(data);
      debts.value.unshift(res.data.data);
      await cacheUpsert("debts", res.data.data);
      if (data.type === "owed_to_me" && data.wallet_id) {
        useWalletsStore().adjustBalance(data.wallet_id, -Math.abs(parseFloat(data.amount || 0)));
      }
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().success("Debt created");
      return res.data.data;
    } catch (e) {
      if (isNetworkError(e)) return _createOffline(data);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function _createOffline(data) {
    loading.value = true;
    try {
      const tempId = `tmp_${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const optimistic = { ...data, id: tempId, _pending: true, created_at: now, updated_at: now };
      debts.value.unshift(optimistic);
      await cacheUpsert("debts", optimistic);
      await outboxAdd({ method: "post", url: "/debts", data, entity: "debts", tempId });
      await refreshPendingCount();
      const statKey = data.type === 'owed_to_me' ? 'debts_owed_to_me' : 'debts_i_owe';
      useDashboardStore().adjustStat(statKey, parseFloat(data.amount || 0));
      // When someone owes me (owed_to_me), I lent them money — log as an optimistic expense
      if (data.type === 'owed_to_me' && data.wallet_id) {
        const { useExpensesStore } = await import("./expenses.js");
        const expStore = useExpensesStore();
        const walletsStore = useWalletsStore();
        const walletRaw = walletsStore.wallets.find((w) => w.id === data.wallet_id) || null;
        const wallet = walletRaw ? JSON.parse(JSON.stringify(walletRaw)) : null;
        const amount = Math.abs(parseFloat(data.amount || 0));
        const optimisticExpense = {
          id: `tmp_debt_lent_${crypto.randomUUID()}`,
          title: `Lent to ${data.name}`,
          amount: String(amount),
          category: "Bills/Debt",
          date: now.split("T")[0],
          wallet_id: data.wallet_id,
          wallet,
          description: data.description ?? "Money lent",
          created_at: now,
          updated_at: now,
          _pending: true,
          _debt_lent: true,
        };
        expStore.expenses.unshift(optimisticExpense);
        await cacheUpsert("expenses", optimisticExpense);
        walletsStore.adjustBalance(data.wallet_id, -amount);
        useDashboardStore().adjustStat('monthly_expenses', amount);
      }
      useToast().success("Debt saved");
      return { data: { data: optimistic } };
    } finally {
      loading.value = false;
    }
  }

  // ── update ──────────────────────────────────────────────────────────────────
  async function update(id, data) {
    if (!navigator.onLine) return _updateOffline(id, data);
    loading.value = true;
    try {
      const res = await debtService.update(id, data);
      const idx = debts.value.findIndex((d) => d.id === id);
      if (idx !== -1) debts.value[idx] = res.data.data;
      await cacheUpsert("debts", res.data.data);
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().success("Debt updated");
      return res.data.data;
    } catch (e) {
      if (isNetworkError(e)) return _updateOffline(id, data);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function _updateOffline(id, data) {
    const now = new Date().toISOString();
    const idx = debts.value.findIndex((d) => d.id === id);
    const existing = debts.value[idx] || {};
    const updated = { ...existing, ...data, id, _pending: true, updated_at: now };
    if (idx !== -1) debts.value[idx] = updated;
    await cacheUpsert("debts", updated);
    const isTemp = String(id).startsWith("tmp_");
    if (isTemp) {
      const pending = await outboxGetPending();
      const createEntry = pending.find((e) => e.tempId === id && e.method === "post");
      if (createEntry) await outboxUpdate(createEntry.id, { data: { ...createEntry.data, ...data } });
    } else {
      await outboxAdd({ method: "put", url: `/debts/${id}`, data, entity: "debts", recordId: id });
    }
    await refreshPendingCount();
    const oldAmt = parseFloat(existing.amount || 0);
    const newAmt = parseFloat(data.amount ?? oldAmt);
    const oldKey = existing.type === 'owed_to_me' ? 'debts_owed_to_me' : 'debts_i_owe';
    const newKey = (data.type ?? existing.type) === 'owed_to_me' ? 'debts_owed_to_me' : 'debts_i_owe';
    if (oldKey === newKey) {
      if (newAmt !== oldAmt) useDashboardStore().adjustStat(oldKey, newAmt - oldAmt);
    } else {
      useDashboardStore().adjustStat(oldKey, -oldAmt);
      useDashboardStore().adjustStat(newKey, +newAmt);
    }
    useToast().success("Debt updated");
    return { data: { data: updated } };
  }

  // ── markPaid ────────────────────────────────────────────────────────────────
  async function markPaid(id, walletId = null) {
    if (!navigator.onLine) return _markPaidOffline(id, walletId);
    loading.value = true;
    try {
      const debt = debts.value.find((d) => d.id === id);
      const res = await debtService.markPaid(id, walletId);
      const idx = debts.value.findIndex((d) => d.id === id);
      if (idx !== -1) debts.value[idx] = res.data.data;
      await cacheUpsert("debts", res.data.data);
      if (walletId && debt) {
        const delta = debt.type === "owed_to_me"
          ? +Math.abs(parseFloat(debt.amount || 0))
          : -Math.abs(parseFloat(debt.amount || 0));
        useWalletsStore().adjustBalance(walletId, delta);
      }
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().success("Debt marked as paid");
      return res.data.data;
    } catch (e) {
      if (isNetworkError(e)) return _markPaidOffline(id, walletId);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function _markPaidOffline(id, walletId) {
    const debt = debts.value.find((d) => d.id === id);
    const idx = debts.value.findIndex((d) => d.id === id);
    if (idx !== -1) {
      debts.value[idx] = {
        ...debts.value[idx],
        status: "paid",
        _pending: true,
      };
      await cacheUpsert("debts", debts.value[idx]);
    }
    if (walletId && debt) {
      const walletsStore = useWalletsStore();
      const delta = debt?.type === "owed_to_me"
        ? +Math.abs(parseFloat(debt.amount || 0))
        : -Math.abs(parseFloat(debt.amount || 0));
      walletsStore.adjustBalance(walletId, delta);
      await cacheSet("wallets", JSON.parse(JSON.stringify(walletsStore.wallets)));
    }
    await outboxAdd({
      method: "patch",
      url: `/debts/${id}/mark-paid`,
      data: { wallet_id: walletId },
      entity: "debts",
      recordId: id,
    });
    await refreshPendingCount();
    if (debt) {
      const amount = Math.abs(parseFloat(debt.amount || 0));
      const statKey = debt.type === 'owed_to_me' ? 'debts_owed_to_me' : 'debts_i_owe';
      useDashboardStore().adjustStat(statKey, -amount);
      // For i_owe debts: log optimistic expense so it shows in expenses list offline
      if (debt.type === 'i_owe') {
        const { useExpensesStore } = await import("./expenses.js");
        const expStore = useExpensesStore();
        const walletsStore = useWalletsStore();
        const walletRaw = walletsStore.wallets.find((w) => w.id === walletId) || null;
        const wallet = walletRaw ? JSON.parse(JSON.stringify(walletRaw)) : null;
        const now = new Date().toISOString();
        const optimisticExpense = {
          id: `tmp_debt_${crypto.randomUUID()}`,
          title: `Debt Payment: ${debt.name}`,
          amount: String(amount),
          category: "Bills/Debt",
          date: now.split("T")[0],
          wallet_id: walletId,
          wallet,
          description: debt.description ?? "Paid off debt",
          created_at: now,
          updated_at: now,
          _pending: true,
          _debt_payment: true,
        };
        expStore.expenses.unshift(optimisticExpense);
        await cacheUpsert("expenses", optimisticExpense);
        useDashboardStore().adjustStat('monthly_expenses', amount);
      }
    }
    useToast().success("Marked as paid");
  }

  // ── partialPay ──────────────────────────────────────────────────────────────
  async function partialPay(id, amount, walletId = null) {
    if (!navigator.onLine) return _partialPayOffline(id, amount, walletId);
    loading.value = true;
    try {
      const debt = debts.value.find((d) => d.id === id);
      const res = await debtService.partialPay(id, amount, walletId);
      const idx = debts.value.findIndex((d) => d.id === id);
      if (idx !== -1) debts.value[idx] = res.data.data;
      await cacheUpsert("debts", res.data.data);
      if (walletId && debt) {
        const delta = debt.type === "owed_to_me"
          ? +Math.abs(parseFloat(amount || 0))
          : -Math.abs(parseFloat(amount || 0));
        useWalletsStore().adjustBalance(walletId, delta);
      }
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().success("Partial payment recorded");
      return res.data.data;
    } catch (e) {
      if (isNetworkError(e)) return _partialPayOffline(id, amount, walletId);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function _partialPayOffline(id, amount, walletId) {
    const debt = debts.value.find((d) => d.id === id);
    const idx = debts.value.findIndex((d) => d.id === id);
    if (idx !== -1 && debt) {
      const currentPaid = parseFloat(debt.amount_paid || 0);
      const newPaid = currentPaid + parseFloat(amount);
      const totalAmount = parseFloat(debt.amount || 0);
      debts.value[idx] = {
        ...debts.value[idx],
        amount_paid: newPaid.toFixed(2),
        amount_remaining: Math.max(0, totalAmount - newPaid).toFixed(2),
        _pending: true,
      };
      await cacheUpsert("debts", debts.value[idx]);
    }
    if (walletId && amount) {
      const walletsStore = useWalletsStore();
      const delta = debt?.type === "owed_to_me"
        ? +Math.abs(parseFloat(amount))
        : -Math.abs(parseFloat(amount));
      walletsStore.adjustBalance(walletId, delta);
      await cacheSet("wallets", JSON.parse(JSON.stringify(walletsStore.wallets)));
    }
    await outboxAdd({
      method: "patch",
      url: `/debts/${id}/partial-pay`,
      data: { amount, wallet_id: walletId },
      entity: "debts",
      recordId: id,
    });
    await refreshPendingCount();
    if (debt) {
      const paidAmount = Math.abs(parseFloat(amount || 0));
      const statKey = debt.type === 'owed_to_me' ? 'debts_owed_to_me' : 'debts_i_owe';
      useDashboardStore().adjustStat(statKey, -paidAmount);
      // For i_owe debts: log optimistic expense so it shows in expenses list offline
      if (debt.type === 'i_owe') {
        const { useExpensesStore } = await import("./expenses.js");
        const expStore = useExpensesStore();
        const walletsStore = useWalletsStore();
        const walletRaw = walletsStore.wallets.find((w) => w.id === walletId) || null;
        const wallet = walletRaw ? JSON.parse(JSON.stringify(walletRaw)) : null;
        const now = new Date().toISOString();
        const optimisticExpense = {
          id: `tmp_debt_${crypto.randomUUID()}`,
          title: `Partial Debt Payment: ${debt.name}`,
          amount: String(paidAmount),
          category: "Bills/Debt",
          date: now.split("T")[0],
          wallet_id: walletId,
          wallet,
          description: "Partial payment towards debt",
          created_at: now,
          updated_at: now,
          _pending: true,
          _debt_payment: true,
        };
        expStore.expenses.unshift(optimisticExpense);
        await cacheUpsert("expenses", optimisticExpense);
        useDashboardStore().adjustStat('monthly_expenses', paidAmount);
      }
    }
    useToast().success("Payment recorded");
  }

  // ── remove ──────────────────────────────────────────────────────────────────
  async function remove(id) {
    if (!navigator.onLine) return _removeOffline(id);
    loading.value = true;
    try {
      await debtService.delete(id);
      debts.value = debts.value.filter((d) => d.id !== id);
      await cacheRemove("debts", id);
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().success("Debt deleted");
    } catch (e) {
      if (isNetworkError(e)) return _removeOffline(id);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function _removeOffline(id) {
    const toRemove = debts.value.find((d) => d.id === id);
    debts.value = debts.value.filter((d) => d.id !== id);
    await cacheRemove("debts", id);
    const isTemp = String(id).startsWith("tmp_");
    if (isTemp) {
      const pending = await outboxGetPending();
      const createEntry = pending.find((e) => e.tempId === id && e.method === "post");
      if (createEntry) await outboxDeleteEntry(createEntry.id);
    } else {
      await outboxAdd({ method: "delete", url: `/debts/${id}`, entity: "debts", recordId: id });
    }
    await refreshPendingCount();
    if (toRemove) {
      const statKey = toRemove.type === 'owed_to_me' ? 'debts_owed_to_me' : 'debts_i_owe';
      useDashboardStore().adjustStat(statKey, -Math.abs(parseFloat(toRemove.amount || 0)));
    }
    useToast().success("Debt deleted");
  }

  function invalidate() {
    fetched.value = false;
    lastCacheKey.value = null;
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
