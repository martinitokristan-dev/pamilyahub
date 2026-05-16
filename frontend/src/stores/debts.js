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
import { refreshPendingCount } from "@/lib/syncEngine.js";

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
        invalidate();
        useDashboardStore().invalidate();
      }
    });
  }

  // ── fetchAll ────────────────────────────────────────────────────────────────
  async function fetchAll(force = false, page = 1, perPage = 20, filters = {}) {
    const cacheKey = JSON.stringify({ page, perPage, ...filters });
    const isNewRequest = lastCacheKey.value !== cacheKey;
    if (!isNewRequest && fetched.value && !force) return;

    // Hydrate from IndexedDB on first render
    if (debts.value.length === 0) {
      try {
        const cached = await cacheGet("debts");
        if (cached.length > 0) {
          debts.value = cached.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
      } catch { /* ignore */ }
    }

    const isInitialLoad = debts.value.filter((d) => !d._pending).length === 0 && !fetched.value;
    if (isInitialLoad) loading.value = true;

    lastCacheKey.value = cacheKey;

    try {
      const res = await debtService.getAll(page, perPage, filters);
      const pendingItems = debts.value.filter((d) => d._pending);
      let serverItems = [];

      if (res.data.data && res.data.data.data) {
        serverItems = res.data.data.data;
        pagination.value = {
          page: res.data.data.page,
          per_page: res.data.data.per_page,
          total: res.data.data.total,
          last_page: res.data.data.last_page,
        };
      } else {
        serverItems = res.data.data || [];
        pagination.value = {
          page: 1,
          per_page: serverItems.length,
          total: serverItems.length,
          last_page: 1,
        };
      }

      const serverIds = new Set(serverItems.map((s) => String(s.id)));
      const unsyncedPending = pendingItems.filter((p) => !serverIds.has(String(p.id)));
      debts.value = [...unsyncedPending, ...serverItems];
      await cacheSet("debts", [...serverItems, ...unsyncedPending]);

      fetched.value = true;
      cacheTime.value = Date.now();
    } catch (e) {
      if (isNetworkError(e) && debts.value.length > 0) {
        fetched.value = true;
      } else {
        error.value = e.response?.data?.message ?? "Failed to load debts";
      }
    } finally {
      loading.value = false;
    }
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
      useDashboardStore().invalidate();
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
    const tempId = `tmp_${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimistic = { ...data, id: tempId, _pending: true, created_at: now, updated_at: now };
    debts.value.unshift(optimistic);
    await cacheUpsert("debts", optimistic);
    await outboxAdd({ method: "post", url: "/debts", data, entity: "debts", tempId });
    await refreshPendingCount();
    useDashboardStore().invalidate();
    useToast().info("Saved offline — will sync when connected");
    return { data: { data: optimistic } };
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
      useDashboardStore().invalidate();
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
    const updated = { ...(debts.value[idx] || {}), ...data, id, _pending: true, updated_at: now };
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
    useDashboardStore().invalidate();
    useToast().info("Saved offline — will sync when connected");
    return { data: { data: updated } };
  }

  // ── markPaid ────────────────────────────────────────────────────────────────
  async function markPaid(id, walletId = null) {
    if (!navigator.onLine) return _markPaidOffline(id, walletId);
    loading.value = true;
    try {
      const res = await debtService.markPaid(id, walletId);
      const idx = debts.value.findIndex((d) => d.id === id);
      if (idx !== -1) debts.value[idx] = res.data.data;
      await cacheUpsert("debts", res.data.data);
      useDashboardStore().invalidate();
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
      debts.value[idx] = { ...debts.value[idx], status: "paid", _pending: true };
      await cacheUpsert("debts", debts.value[idx]);
    }
    if (walletId && debt?.amount) {
      const walletsStore = useWalletsStore();
      // owed_to_me → I receive → wallet increases; i_owe → I pay → wallet decreases
      const delta = debt.type === "owed_to_me"
        ? +Math.abs(parseFloat(debt.amount))
        : -Math.abs(parseFloat(debt.amount));
      walletsStore.adjustBalance(walletId, delta);
      await cacheSet("wallets", walletsStore.wallets);
    }
    await outboxAdd({
      method: "patch",
      url: `/debts/${id}/mark-paid`,
      data: { wallet_id: walletId },
      entity: "debts",
      recordId: id,
    });
    await refreshPendingCount();
    useDashboardStore().invalidate();
    useToast().info("Marked paid offline — will sync when connected");
  }

  // ── partialPay ──────────────────────────────────────────────────────────────
  async function partialPay(id, amount, walletId = null) {
    if (!navigator.onLine) return _partialPayOffline(id, amount, walletId);
    loading.value = true;
    try {
      const res = await debtService.partialPay(id, amount, walletId);
      const idx = debts.value.findIndex((d) => d.id === id);
      if (idx !== -1) debts.value[idx] = res.data.data;
      await cacheUpsert("debts", res.data.data);
      useDashboardStore().invalidate();
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
      await cacheSet("wallets", walletsStore.wallets);
    }
    await outboxAdd({
      method: "patch",
      url: `/debts/${id}/partial-pay`,
      data: { amount, wallet_id: walletId },
      entity: "debts",
      recordId: id,
    });
    await refreshPendingCount();
    useDashboardStore().invalidate();
    useToast().info("Payment recorded offline — will sync when connected");
  }

  // ── remove ──────────────────────────────────────────────────────────────────
  async function remove(id) {
    if (!navigator.onLine) return _removeOffline(id);
    loading.value = true;
    try {
      await debtService.delete(id);
      debts.value = debts.value.filter((d) => d.id !== id);
      await cacheRemove("debts", id);
      useDashboardStore().invalidate();
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
    useDashboardStore().invalidate();
    useToast().info("Deleted offline — will sync when connected");
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
