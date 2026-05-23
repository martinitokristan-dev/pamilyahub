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
import { refreshPendingCount, isSyncing } from "@/lib/syncEngine.js";

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
    window.addEventListener("pamilya:id-remap", async (e) => {
      const { entity, tempId, realId } = e.detail;
      if (entity === "expenses" && tempId) {
        const idx = expenses.value.findIndex((ex) => ex.id === tempId);
        if (idx !== -1) {
          expenses.value[idx].id = realId;
          expenses.value[idx]._pending = false;
        }
      } else if (entity === "debts" && tempId) {
        expenses.value = expenses.value.filter((ex) => ex._debt_temp_id !== tempId);
        try {
          const cached = await cacheGet("expenses");
          if (cached && cached.length > 0) {
            const filtered = cached.filter((ex) => ex._debt_temp_id !== tempId);
            await cacheSet("expenses", filtered);
          }
        } catch { }
      }
    });
    window.addEventListener("pamilya:sync-done", (e) => {
      if (e.detail.entity === "expenses" || e.detail.entity === "debts") {
        useDashboardStore().invalidate();
      }
    });
    window.addEventListener("pamilya:drain-complete", async (e) => {
      const entities = e.detail?.entities || [];
      if (entities.some((en) => ["expenses", "debts", "salary"].includes(en))) {
        expenses.value = expenses.value.filter((ex) => !String(ex.id).startsWith("tmp_debt"));
        try {
          const cached = await cacheGet("expenses");
          if (cached && cached.length > 0) {
            const filtered = cached.filter((ex) => !String(ex.id).startsWith("tmp_debt"));
            await cacheSet("expenses", filtered);
          }
        } catch { }
        
        fetched.value = false;
        lastCacheKey.value = null;
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

    // Block network fetch during outbox drain to prevent stale server data overwriting optimistic values
    if (isSyncing.value) return;

    try {
      const res = await expenseService.getAll({ page, ...filters });
      // Exclude _debt_payment items — backend creates the real expense on debt sync
      const pendingItems = expenses.value.filter((e) => e._pending && !e._debt_payment);

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
      const date = new Date(data.date || new Date())
      const m = date.getMonth() + 1
      const y = date.getFullYear()
      useDashboardStore().invalidate({ month: m, year: y });
      invalidate();
      if (data.wallet_id) {
        const { useWalletsStore } = await import("./wallets.js");
        const walletsStore = useWalletsStore();
        await walletsStore.adjustBalance(data.wallet_id, -parseFloat(data.amount || 0));
        await cacheSet("wallets", JSON.parse(JSON.stringify(walletsStore.wallets)));
      }
      useDashboardStore().adjustStat('monthly_expenses', parseFloat(data.amount || 0));
      useToast().expense('Expense created', data.title);
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
      const { useWalletsStore } = await import("./wallets.js");
      const walletsStore = useWalletsStore();
      if (walletsStore.wallets.length === 0) {
        try {
          const cached = await cacheGet("wallets");
          if (cached && cached.length > 0) {
            walletsStore.wallets = cached;
          }
        } catch { }
      }
      const walletRaw = walletsStore.wallets.find((w) => String(w.id) === String(data.wallet_id)) || null;
      const wallet = walletRaw ? JSON.parse(JSON.stringify(walletRaw)) : null;
      const optimistic = {
        ...data,
        id: tempId,
        _clientKey: crypto.randomUUID(),
        _pending: true,
        wallet,
        created_at: data.date || now,
        updated_at: now,
      };
      expenses.value.unshift(optimistic);
      await cacheUpsert("expenses", optimistic);
      await outboxAdd({ method: "post", url: "/expenses", data, entity: "expenses", tempId });
      await refreshPendingCount();
      if (data.wallet_id) {
        await walletsStore.adjustBalance(data.wallet_id, -parseFloat(data.amount || 0));
        await cacheSet("wallets", JSON.parse(JSON.stringify(walletsStore.wallets)));
      }
      useDashboardStore().adjustStat('monthly_expenses', parseFloat(data.amount || 0));
      useToast().offline('Saved offline', 'Expense logging queued');
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
      const existing = expenses.value.find((e) => e.id === id);
      const res = await expenseService.update(id, data);
      const idx = expenses.value.findIndex((e) => e.id === id);
      if (idx !== -1) expenses.value[idx] = res.data.data;
      await cacheUpsert("expenses", res.data.data);
      const date = new Date(data.date || existing?.date || new Date())
      const m = date.getMonth() + 1
      const y = date.getFullYear()
      useDashboardStore().invalidate({ month: m, year: y });
      invalidate();

      // Adjust wallet balances online
      if (existing) {
        const { useWalletsStore } = await import("./wallets.js");
        const walletsStore = useWalletsStore();
        if (existing.wallet_id) {
          await walletsStore.adjustBalance(existing.wallet_id, parseFloat(existing.amount || 0));
        }
        if (data.wallet_id) {
          await walletsStore.adjustBalance(data.wallet_id, -parseFloat(data.amount || 0));
        }
        await cacheSet("wallets", JSON.parse(JSON.stringify(walletsStore.wallets)));
      }

      const amtDelta = parseFloat(data.amount ?? existing?.amount ?? 0) - parseFloat(existing?.amount || 0);
      if (amtDelta !== 0) useDashboardStore().adjustStat('monthly_expenses', amtDelta);
      useToast().expense('Expense updated', data.title);
      return res.data.data;
    } catch (e) {
      if (isNetworkError(e)) return _updateOffline(id, data);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function _updateOffline(id, data) {
    loading.value = true;
    try {
      const now = new Date().toISOString();
      const existing = expenses.value.find((e) => e.id === id);
      const idx = expenses.value.findIndex((e) => e.id === id);

      const { useWalletsStore } = await import("./wallets.js");
      const walletsStore = useWalletsStore();
      if (walletsStore.wallets.length === 0) {
        try {
          const cached = await cacheGet("wallets");
          if (cached && cached.length > 0) {
            walletsStore.wallets = cached;
          }
        } catch { }
      }
      const walletRaw = walletsStore.wallets.find((w) => String(w.id) === String(data.wallet_id)) || null;
      const wallet = walletRaw ? JSON.parse(JSON.stringify(walletRaw)) : null;

      const updated = {
        ...(existing || {}),
        ...data,
        id,
        wallet,
        _pending: true,
        updated_at: now,
      };
      if (idx !== -1) expenses.value[idx] = updated;
      await cacheUpsert("expenses", updated);
      const amtDelta = parseFloat(data.amount ?? existing?.amount ?? 0) - parseFloat(existing?.amount || 0);
      const isTemp = String(id).startsWith("tmp_");
      if (isTemp) {
        const pending = await outboxGetPending();
        const createEntry = pending.find((e) => e.tempId === id && e.method === "post");
        if (createEntry) {
          await outboxUpdate(createEntry.id, { data: { ...createEntry.data, ...data } });
        }
      } else {
        await outboxAdd({ method: "put", url: `/expenses/${id}`, data, entity: "expenses", recordId: id });
      }
      await refreshPendingCount();

      // Adjust wallet balances offline
      if (existing) {
        if (existing.wallet_id) {
          await walletsStore.adjustBalance(existing.wallet_id, parseFloat(existing.amount || 0));
        }
        if (data.wallet_id) {
          await walletsStore.adjustBalance(data.wallet_id, -parseFloat(data.amount || 0));
        }
        await cacheSet("wallets", JSON.parse(JSON.stringify(walletsStore.wallets)));
      }

      if (amtDelta !== 0) useDashboardStore().adjustStat('monthly_expenses', amtDelta);
      useToast().offline('Saved offline', 'Expense update queued');
      return { data: { data: updated } };
    } finally {
      loading.value = false;
    }
  }

  // ── remove ──────────────────────────────────────────────────────────────────
  async function remove(id) {
    if (!navigator.onLine) return _removeOffline(id);
    loading.value = true;
    try {
      const existing = expenses.value.find((e) => e.id === id);
      await expenseService.delete(id);
      expenses.value = expenses.value.filter((e) => e.id !== id);
      await cacheRemove("expenses", id);

      const date = new Date(existing?.date || new Date())
      const m = date.getMonth() + 1
      const y = date.getFullYear()
      useDashboardStore().invalidate({ month: m, year: y });
      invalidate();

      // Refund the wallet online
      if (existing && existing.wallet_id) {
        const { useWalletsStore } = await import("./wallets.js");
        const walletsStore = useWalletsStore();
        await walletsStore.adjustBalance(existing.wallet_id, parseFloat(existing.amount || 0));
        await cacheSet("wallets", JSON.parse(JSON.stringify(walletsStore.wallets)));
      }

      if (existing?.amount) {
        useDashboardStore().adjustStat('monthly_expenses', -parseFloat(existing.amount));
      }
      useToast().delete('Expense deleted', 'Removed successfully');
    } catch (e) {
      if (isNetworkError(e)) return _removeOffline(id);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function _removeOffline(id) {
    loading.value = true;
    try {
      const toRemove = expenses.value.find((e) => e.id === id);
      expenses.value = expenses.value.filter((e) => e.id !== id);
      await cacheRemove("expenses", id);
      const isTemp = String(id).startsWith("tmp_");
      if (isTemp) {
        const pending = await outboxGetPending();
        const createEntry = pending.find((e) => e.tempId === id && e.method === "post");
        if (createEntry) await outboxDeleteEntry(createEntry.id);
      } else {
        await outboxAdd({
          method: "delete",
          url: `/expenses/${id}`,
          entity: "expenses",
          recordId: id,
        });
      }
      await refreshPendingCount();

      // Refund the wallet offline
      if (toRemove && toRemove.wallet_id) {
        const { useWalletsStore } = await import("./wallets.js");
        const walletsStore = useWalletsStore();
        await walletsStore.adjustBalance(toRemove.wallet_id, parseFloat(toRemove.amount || 0));
        await cacheSet("wallets", JSON.parse(JSON.stringify(walletsStore.wallets)));
      }

      if (toRemove?.amount) {
        useDashboardStore().adjustStat('monthly_expenses', -parseFloat(toRemove.amount));
      }
      useToast().offline('Saved offline', 'Expense deletion queued');
    } finally {
      loading.value = false;
    }
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
