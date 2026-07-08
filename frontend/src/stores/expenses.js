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
import { notifyFinanceActivity } from "@/lib/financeEvents.js";
import { parseExpenseAmount } from "@/utils/format.js";

export const useExpensesStore = defineStore("expenses", () => {
  const expenses = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const fetched = ref(false);
  const cacheTime = ref(0);
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
        expenses.value = expenses.value.filter(
          (ex) => ex._debt_temp_id !== tempId,
        );
        try {
          const cached = await cacheGet("expenses");
          if (cached && cached.length > 0) {
            const filtered = cached.filter((ex) => ex._debt_temp_id !== tempId);
            await cacheSet("expenses", filtered);
          }
        } catch {}
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
        expenses.value = expenses.value.filter(
          (ex) => !String(ex.id).startsWith("tmp_debt"),
        );
        try {
          const cached = await cacheGet("expenses");
          if (cached && cached.length > 0) {
            const filtered = cached.filter(
              (ex) => !String(ex.id).startsWith("tmp_debt"),
            );
            await cacheSet("expenses", filtered);
          }
        } catch {}

        fetched.value = false;
        lastCacheKey.value = null;
      }
    });
  }

  // ── fetchAll ────────────────────────────────────────────────────────────────
  async function fetchAll(filters = {}) {
    const cacheKey = JSON.stringify(filters);
    const isNewRequest = lastCacheKey.value !== cacheKey;
    if (!isNewRequest && fetched.value) return;

    // Hydrate from IndexedDB on first render (no network data yet)
    if (expenses.value.length === 0) {
      try {
        const cached = await cacheGet("expenses");
        if (cached.length > 0) {
          expenses.value = cached.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at),
          );
        }
      } catch {
        /* ignore */
      }
    }

    const isInitialLoad =
      expenses.value.filter((e) => !e._pending).length === 0 && !fetched.value;
    if (isInitialLoad) loading.value = true;

    lastCacheKey.value = cacheKey;

    // Block network fetch during outbox drain to prevent stale server data overwriting optimistic values
    if (isSyncing.value) return;

    try {
      const res = await expenseService.getAll(filters);
      // Exclude _debt_payment items — backend creates the real expense on debt sync
      const pendingItems = expenses.value.filter(
        (e) => e._pending && !e._debt_payment,
      );

      let serverItems = [];
      if (res.data?.data && Array.isArray(res.data.data)) {
        serverItems = res.data.data;
      } else {
        expenses.value = pendingItems;
        fetched.value = true;
        cacheTime.value = Date.now();
        return;
      }

      // Merge: keep unsynced pending items + fresh server items
      const serverIds = new Set(serverItems.map((s) => String(s.id)));
      const unsyncedPending = pendingItems.filter(
        (p) => !serverIds.has(String(p.id)),
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
      const newExpense = { ...res.data.data, type: res.data.data.type || 'expense' };
      expenses.value.unshift(newExpense);
      if (
        newExpense &&
        !feedItems.value.some((item) => item.id === newExpense.id)
      ) {
        feedItems.value.unshift(newExpense);
      }
      await cacheUpsert("expenses", newExpense);
      const date = new Date(data.date || new Date());
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      useDashboardStore().invalidate({ month: m, year: y });
      invalidate();
      if (data.wallet_id) {
        const { useWalletsStore } = await import("./wallets.js");
        const walletsStore = useWalletsStore();
        await walletsStore.adjustBalance(
          data.wallet_id,
          -parseFloat(data.amount || 0),
        );
        await cacheSet(
          "wallets",
          JSON.parse(JSON.stringify(walletsStore.wallets)),
        );
      }
      useDashboardStore().adjustStat(
        "monthly_expenses",
        parseFloat(data.amount || 0),
      );
      useToast().expense("Expense created", data.title);
      notifyFinanceActivity({ type: "expense", action: "create" });
      return res.data.data;
    } catch (e) {
      console.error('Expense creation failed:', e.response?.data)
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
        } catch {}
      }
      const walletRaw =
        walletsStore.wallets.find(
          (w) => String(w.id) === String(data.wallet_id),
        ) || null;
      const wallet = walletRaw ? JSON.parse(JSON.stringify(walletRaw)) : null;
      const optimistic = {
        ...data,
        id: tempId,
        _clientKey: crypto.randomUUID(),
        _pending: true,
        wallet,
        type: 'expense',
        created_at: data.date || now,
        updated_at: now,
      };
      expenses.value.unshift(optimistic);
      feedItems.value.unshift(optimistic);
      await cacheUpsert("expenses", optimistic);
      await outboxAdd({
        method: "post",
        url: "/expenses",
        data,
        entity: "expenses",
        tempId,
      });
      await refreshPendingCount();
      if (data.wallet_id) {
        await walletsStore.adjustBalance(
          data.wallet_id,
          -parseFloat(data.amount || 0),
        );
        await cacheSet(
          "wallets",
          JSON.parse(JSON.stringify(walletsStore.wallets)),
        );
      }
      await useDashboardStore().adjustStat(
        "monthly_expenses",
        parseFloat(data.amount || 0),
      );
      useToast().offline("Saved offline", "Expense logging queued");
      notifyFinanceActivity({ type: "expense", action: "create", offline: true });
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
      const existing = expenses.value.find((e) => e.id === id) || feedItems.value.find((e) => e.id === id);
      const res = await expenseService.update(id, data);
      const idx = expenses.value.findIndex((e) => e.id === id);
      if (idx !== -1) expenses.value[idx] = res.data.data;
      const feedIdx = feedItems.value.findIndex((e) => e.id === id);
      if (feedIdx !== -1) feedItems.value[feedIdx] = res.data.data;
      await cacheUpsert("expenses", res.data.data);
      const date = new Date(data.date || existing?.date || new Date());
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      useDashboardStore().invalidate({ month: m, year: y });
      invalidate();

      // Adjust wallet balances online
      if (existing) {
        const { useWalletsStore } = await import("./wallets.js");
        const walletsStore = useWalletsStore();
        if (existing.wallet_id) {
          await walletsStore.adjustBalance(
            existing.wallet_id,
            parseExpenseAmount(existing.amount),
          );
        }
        if (data.wallet_id) {
          await walletsStore.adjustBalance(
            data.wallet_id,
            -parseFloat(data.amount || 0),
          );
        }
        await cacheSet(
          "wallets",
          JSON.parse(JSON.stringify(walletsStore.wallets)),
        );
      }

      const oldAmt = parseExpenseAmount(existing?.amount);
      const newAmt = parseFloat(data.amount ?? oldAmt);
      const amtDelta = newAmt - oldAmt;
      
      if (amtDelta !== 0)
        await useDashboardStore().adjustStat("monthly_expenses", amtDelta);
      useToast().expense("Expense updated", data.title);
      notifyFinanceActivity({ type: "expense", action: "update" });
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
        } catch {}
      }
      const walletRaw =
        walletsStore.wallets.find(
          (w) => String(w.id) === String(data.wallet_id),
        ) || null;
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
      const feedIdx = feedItems.value.findIndex((e) => e.id === id);
      if (feedIdx !== -1) feedItems.value[feedIdx] = updated;
      await cacheUpsert("expenses", updated);
      const amtDelta =
        parseFloat(data.amount ?? existing?.amount ?? 0) -
        parseFloat(existing?.amount || 0);
      const isTemp = String(id).startsWith("tmp_");
      if (isTemp) {
        const pending = await outboxGetPending();
        const createEntry = pending.find(
          (e) => e.tempId === id && e.method === "post",
        );
        if (createEntry) {
          await outboxUpdate(createEntry.id, {
            data: { ...createEntry.data, ...data },
          });
        }
      } else {
        await outboxAdd({
          method: "put",
          url: `/expenses/${id}`,
          data,
          entity: "expenses",
          recordId: id,
        });
      }
      await refreshPendingCount();

      // Adjust wallet balances offline
      if (existing) {
        if (existing.wallet_id) {
          await walletsStore.adjustBalance(
            existing.wallet_id,
            parseFloat(existing.amount || 0),
          );
        }
        if (data.wallet_id) {
          await walletsStore.adjustBalance(
            data.wallet_id,
            -parseFloat(data.amount || 0),
          );
        }
        await cacheSet(
          "wallets",
          JSON.parse(JSON.stringify(walletsStore.wallets)),
        );
      }

      if (amtDelta !== 0)
        await useDashboardStore().adjustStat("monthly_expenses", amtDelta);
      useToast().offline("Saved offline", "Expense update queued");
      notifyFinanceActivity({ type: "expense", action: "update", offline: true });
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
      feedItems.value = feedItems.value.filter((e) => e.id !== id);
      await cacheRemove("expenses", id);

      const date = new Date(existing?.date || new Date());
      const m = date.getMonth() + 1;
      const y = date.getFullYear();
      useDashboardStore().invalidate({ month: m, year: y });
      invalidate();

      // Refund the wallet online
      if (existing && existing.wallet_id) {
        const { useWalletsStore } = await import("./wallets.js");
        const walletsStore = useWalletsStore();
        await walletsStore.adjustBalance(
          existing.wallet_id,
          parseFloat(existing.amount || 0),
        );
        await cacheSet(
          "wallets",
          JSON.parse(JSON.stringify(walletsStore.wallets)),
        );
      }

      if (existing?.amount) {
        await useDashboardStore().adjustStat(
          "monthly_expenses",
          -parseFloat(existing.amount),
        );
      }
      useToast().delete("Expense deleted", "Removed successfully");
      notifyFinanceActivity({ type: "expense", action: "delete" });
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
      feedItems.value = feedItems.value.filter((e) => e.id !== id);
      await cacheRemove("expenses", id);
      const isTemp = String(id).startsWith("tmp_");
      if (isTemp) {
        const pending = await outboxGetPending();
        const createEntry = pending.find(
          (e) => e.tempId === id && e.method === "post",
        );
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
        await walletsStore.adjustBalance(
          toRemove.wallet_id,
          parseFloat(toRemove.amount || 0),
        );
        await cacheSet(
          "wallets",
          JSON.parse(JSON.stringify(walletsStore.wallets)),
        );
      }

      if (toRemove?.amount) {
        await useDashboardStore().adjustStat(
          "monthly_expenses",
          -parseFloat(toRemove.amount),
        );
      }
      useToast().offline("Saved offline", "Expense deletion queued");
      notifyFinanceActivity({ type: "expense", action: "delete", offline: true });
    } finally {
      loading.value = false;
    }
  }

  const feedItems = ref([]);
  const feedLoading = ref(false);
  const feedHasMore = ref(false);
  const feedNextCursor = ref(null);
  const filters = ref({ dateFrom: null, dateTo: null, type: 'all' });

  async function fetchFeed(options = {}) {
    const {
      refresh = false,
      limit = 10,
      startDate = null,
      endDate = null,
      search = "",
      type = filters.value.type,
    } = options;

    if (refresh) {
      feedNextCursor.value = null;
      feedHasMore.value = false;
      // Do not clear feedItems.value here to prevent skeleton flicker during refresh
    }

    feedLoading.value = true;
    try {
      const params = { limit };
      if (feedNextCursor.value && !refresh) {
        params.cursor = feedNextCursor.value;
      }
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (search) params.search = search;
      if (type) params.type = type;
      if (options.onlyArchives) params.only_archives = 1;

      const res = await expenseService.getFeed(params);
      const newItems = res.data.data || [];

      feedNextCursor.value = res.data.meta?.next_cursor || null;
      feedHasMore.value = !!res.data.meta?.has_more;

      if (refresh) {
        feedItems.value = newItems;
      } else {
        const existingIds = new Set(
          feedItems.value.map((item) => String(item.id) + '-' + item.type),
        );
        const filteredNew = newItems.filter(
          (item) => !existingIds.has(String(item.id) + '-' + item.type),
        );
        feedItems.value = [...feedItems.value, ...filteredNew];
      }
    } catch (e) {
      // Handle offline mode: filter cached expenses locally
      if (isNetworkError(e)) {
        return _fetchFeedOffline(options);
      }
      error.value = e.response?.data?.message ?? "Failed to load feed";
    } finally {
      feedLoading.value = false;
    }
  }

  function _fetchFeedOffline(options = {}) {
    const {
      startDate = null,
      endDate = null,
      search = "",
      type = filters.value.type,
    } = options;

    // Get all cached expenses (from expenses array which includes pending items)
    let filtered = [...expenses.value];

    // Filter by type
    if (type && type !== 'all') {
      filtered = filtered.filter(item => item.type === type);
    }

    // Filter by date range
    if (startDate) {
      filtered = filtered.filter(item => {
        const itemDate = (item.date || '').slice(0, 10);
        return itemDate >= startDate;
      });
    }
    if (endDate) {
      filtered = filtered.filter(item => {
        const itemDate = (item.date || '').slice(0, 10);
        return itemDate <= endDate;
      });
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(item => {
        const title = (item.title || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const wallet = (item.wallet?.name || '').toLowerCase();
        return title.includes(searchLower) || desc.includes(searchLower) || wallet.includes(searchLower);
      });
    }

    // Sort by date descending (newest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.created_at || a.date);
      const dateB = new Date(b.created_at || b.date);
      return dateB - dateA;
    });

    feedItems.value = filtered;
    feedHasMore.value = false;
    feedNextCursor.value = null;
  }

  async function archiveTransaction(type, id) {
    if (!navigator.onLine) {
      useToast().error("Action unavailable", "Cannot archive while offline");
      return;
    }
    loading.value = true;
    try {
      if (type === "expense") {
        await expenseService.archive(id);
      } else if (type === "income" || type === "deposit") {
        const { incomeService } = await import("@/services/incomeService.js");
        await incomeService.archive(id);
      } else if (type === "transfer") {
        const { transferService } = await import("@/services/transferService.js");
        await transferService.archive(id);
      } else if (type.startsWith("debt") || type === "owed_to_me" || type === "i_owe") {
        const { debtService } = await import("@/services/debtService.js");
        await debtService.archive(id);
      }

      feedItems.value = feedItems.value.filter(
        (item) => !(
          String(item.id) === String(id) && 
          (
            item.type === type || 
            (item.type === "deposit" && type === "income") ||
            (item.type === "income" && type === "deposit") ||
            ((item.type.startsWith("debt") || item.type === "owed_to_me" || item.type === "i_owe") && 
             (type.startsWith("debt") || type === "owed_to_me" || type === "i_owe"))
          )
        )
      );
      useToast().success("Archived successfully");
    } catch (e) {
      useToast().error("Archive failed", e.response?.data?.message || e.message);
    } finally {
      loading.value = false;
    }
  }

  function injectOptimisticFeedItem(item) {
    // Only inject if it doesn't already exist
    const exists = feedItems.value.some(
      (existing) => String(existing.id) === String(item.id) && existing.type === item.type
    );
    if (!exists) {
      feedItems.value.unshift(item);
    }
  }

  function invalidate() {
    fetched.value = false;
    lastCacheKey.value = null;
  }

  function applyFilters(dateFrom, dateTo, type) {
    filters.value = {
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      type: type !== undefined ? type : filters.value.type,
    };
  }

  function clearFilters() {
    filters.value = { dateFrom: null, dateTo: null, type: filters.value.type };
  }

  return {
    expenses,
    loading,
    error,
    fetched,
    cacheTime,
    feedItems,
    feedLoading,
    feedHasMore,
    feedNextCursor,
    filters,
    fetchAll,
    fetchFeed,
    injectOptimisticFeedItem,
    applyFilters,
    clearFilters,
    create,
    update,
    remove,
    archiveTransaction,
    invalidate,
  };
});
