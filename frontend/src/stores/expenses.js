import { defineStore } from "pinia";
import { ref } from "vue";
import { expenseService } from "@/services/expenseService.js";
import { useDashboardStore } from "./dashboard.js";
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

export const useExpensesStore = defineStore("expenses", () => {
  const expenses = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const fetched = ref(false);
  const cacheTime = ref(0);
  const pagination = ref({ page: 1, per_page: 10, total: 0, last_page: 1 });
  const lastCacheKey = ref(null);

  // ── Sync event listeners ────────────────────────────────────────────────────
  if (typeof window !== "undefined") {
    window.addEventListener("pamilya:id-remap", (e) => {
      const { entity, tempId, realId, serverData } = e.detail;
      if (entity !== "expenses" || !tempId) return;
      const idx = expenses.value.findIndex((ex) => ex.id === tempId);
      if (idx !== -1 && serverData) {
        expenses.value[idx] = { ...serverData, _pending: false };
      }
    });
    window.addEventListener("pamilya:sync-done", (e) => {
      if (e.detail.entity === "expenses") {
        invalidate();
        useDashboardStore().invalidate();
      }
    });
  }

  // ── fetchAll ────────────────────────────────────────────────────────────────
  async function fetchAll(page = 1, filters = {}) {
    const cacheKey = JSON.stringify({ page, ...filters });
    const isNewRequest = lastCacheKey.value !== cacheKey;
    if (!isNewRequest && fetched.value) return;

    // Hydrate from IndexedDB on first render (no network data yet)
    if (expenses.value.length === 0) {
      try {
        const cached = await cacheGet("expenses");
        if (cached.length > 0) {
          expenses.value = cached.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          );
        }
      } catch { /* ignore */ }
    }

    const isInitialLoad =
      expenses.value.filter((e) => !e._pending).length === 0 && !fetched.value;
    if (isInitialLoad) loading.value = true;

    lastCacheKey.value = cacheKey;

    try {
      const res = await expenseService.getAll({ page, ...filters });
      const pendingItems = expenses.value.filter((e) => e._pending);

      let serverItems = [];
      if (res.data?.data?.data && Array.isArray(res.data.data.data)) {
        serverItems = res.data.data.data;
        pagination.value = {
          page: res.data.data.current_page,
          per_page: res.data.data.per_page,
          total: res.data.data.total,
          last_page: res.data.data.last_page,
        };
      } else if (res.data && Array.isArray(res.data.data)) {
        serverItems = res.data.data;
        pagination.value = {
          page: 1,
          per_page: serverItems.length,
          total: serverItems.length,
          last_page: 1,
        };
      } else {
        expenses.value = pendingItems;
        pagination.value = { page: 1, per_page: 10, total: 0, last_page: 1 };
        fetched.value = true;
        cacheTime.value = Date.now();
        return;
      }

      // Merge: keep unsynced pending items + fresh server items
      const serverIds = new Set(serverItems.map((s) => String(s.id)));
      const unsyncedPending = pendingItems.filter(
        (p) => !serverIds.has(String(p.id))
      );
      expenses.value = [...unsyncedPending, ...serverItems];

      // Persist to IndexedDB (include pending so they survive a refresh)
      await cacheSet("expenses", [...serverItems, ...unsyncedPending]);

      fetched.value = true;
      cacheTime.value = Date.now();
    } catch (e) {
      if (isNetworkError(e) && expenses.value.length > 0) {
        fetched.value = true; // have cached data — suppress spinner
      } else {
        error.value = e.response?.data?.message ?? "Failed to load expenses";
      }
    } finally {
      loading.value = false;
    }
  }

  // ── create ──────────────────────────────────────────────────────────────────
  async function create(data) {
    if (!navigator.onLine) return _createOffline(data);
    loading.value = true;
    try {
      const res = await expenseService.create(data);
      expenses.value.unshift(res.data.data);
      await cacheUpsert("expenses", res.data.data);
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("Expense created");
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
    const optimistic = {
      ...data,
      id: tempId,
      _pending: true,
      created_at: data.date || now,
      updated_at: now,
    };
    expenses.value.unshift(optimistic);
    await cacheUpsert("expenses", optimistic);

    // Deduct from wallet balance immediately for accurate offline totals
    if (data.wallet_id && data.amount) {
      const { useWalletsStore } = await import("./wallets.js");
      const walletsStore = useWalletsStore();
      walletsStore.adjustBalance(data.wallet_id, -Math.abs(parseFloat(data.amount)));
      await cacheSet("wallets", walletsStore.wallets);
    }

    await outboxAdd({ method: "post", url: "/expenses", data, entity: "expenses", tempId });
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
      const res = await expenseService.update(id, data);
      const idx = expenses.value.findIndex((e) => e.id === id);
      if (idx !== -1) expenses.value[idx] = res.data.data;
      await cacheUpsert("expenses", res.data.data);
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("Expense updated");
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
    const existing = expenses.value.find((e) => e.id === id);
    const idx = expenses.value.findIndex((e) => e.id === id);
    const updated = {
      ...(existing || {}),
      ...data,
      id,
      _pending: true,
      updated_at: now,
    };
    if (idx !== -1) expenses.value[idx] = updated;
    await cacheUpsert("expenses", updated);

    // Adjust wallet balance for the amount/wallet change
    if (existing) {
      const { useWalletsStore } = await import("./wallets.js");
      const walletsStore = useWalletsStore();
      const oldWallet = existing.wallet_id;
      const newWallet = data.wallet_id ?? oldWallet;
      const oldAmt = Math.abs(parseFloat(existing.amount || 0));
      const newAmt = Math.abs(parseFloat(data.amount ?? existing.amount ?? 0));

      if (oldWallet) walletsStore.adjustBalance(oldWallet, +oldAmt); // refund old
      if (newWallet) walletsStore.adjustBalance(newWallet, -newAmt); // charge new
      await cacheSet("wallets", walletsStore.wallets);
    }

    const isTemp = String(id).startsWith("tmp_");
    if (isTemp) {
      // Mutate the queued create entry in place
      const pending = await outboxGetPending();
      const createEntry = pending.find((e) => e.tempId === id && e.method === "post");
      if (createEntry) {
        await outboxUpdate(createEntry.id, { data: { ...createEntry.data, ...data } });
      }
    } else {
      await outboxAdd({ method: "put", url: `/expenses/${id}`, data, entity: "expenses", recordId: id });
    }
    await refreshPendingCount();
    useDashboardStore().invalidate();
    useToast().info("Saved offline — will sync when connected");
    return { data: { data: updated } };
  }

  // ── remove ──────────────────────────────────────────────────────────────────
  async function remove(id) {
    if (!navigator.onLine) return _removeOffline(id);
    loading.value = true;
    try {
      await expenseService.delete(id);
      expenses.value = expenses.value.filter((e) => e.id !== id);
      await cacheRemove("expenses", id);
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("Expense deleted");
    } catch (e) {
      if (isNetworkError(e)) return _removeOffline(id);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function _removeOffline(id) {
    const expense = expenses.value.find((e) => e.id === id);
    expenses.value = expenses.value.filter((e) => e.id !== id);
    await cacheRemove("expenses", id);

    const isTemp = String(id).startsWith("tmp_");
    if (isTemp) {
      // Cancel the queued create — no point syncing a delete for a never-persisted record
      const pending = await outboxGetPending();
      const createEntry = pending.find((e) => e.tempId === id && e.method === "post");
      if (createEntry) {
        await outboxDeleteEntry(createEntry.id);
        // Refund the wallet delta that was applied on create
        if (createEntry.data?.wallet_id && createEntry.data?.amount) {
          const { useWalletsStore } = await import("./wallets.js");
          const walletsStore = useWalletsStore();
          walletsStore.adjustBalance(
            createEntry.data.wallet_id,
            +Math.abs(parseFloat(createEntry.data.amount))
          );
          await cacheSet("wallets", walletsStore.wallets);
        }
      }
    } else {
      // Refund wallet balance immediately for accurate offline totals
      if (expense?.wallet_id && expense?.amount) {
        const { useWalletsStore } = await import("./wallets.js");
        const walletsStore = useWalletsStore();
        walletsStore.adjustBalance(expense.wallet_id, +Math.abs(parseFloat(expense.amount)));
        await cacheSet("wallets", walletsStore.wallets);
      }
      await outboxAdd({
        method: "delete",
        url: `/expenses/${id}`,
        entity: "expenses",
        recordId: id,
      });
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
