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
  const lastCacheKey = ref(null);

  // ── Sync event listeners ────────────────────────────────────────────────────
  if (typeof window !== "undefined") {
    window.addEventListener("pamilya:id-remap", (e) => {
      const { entity, tempId, realId } = e.detail;
      if (entity !== "debts" || !tempId) return;
      const idx = debts.value.findIndex((d) => d.id === tempId);
      if (idx !== -1) {
        debts.value[idx].id = realId;
        debts.value[idx]._pending = false;
      }
    });
    window.addEventListener("pamilya:sync-done", (e) => {
      if (e.detail.entity === "debts") {
        useDashboardStore().invalidate();
      }
    });
    window.addEventListener("pamilya:drain-complete", (e) => {
      const entities = e.detail?.entities || [];
      if (entities.includes("debts")) {
        fetched.value = false;
        lastCacheKey.value = null;
      }
    });
  }

  // ── fetchAll ────────────────────────────────────────────────────────────────
  async function fetchAll(force = false, filters = {}) {
    const cacheKey = `debts_all_${JSON.stringify(filters)}`
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
          const res = await debtService.getAll(filters)
          const pendingItems = debts.value.filter((d) => d._pending)
          let serverItems = []

          if (res.data && res.data.data && Array.isArray(res.data.data)) {
            serverItems = res.data.data
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

  // ── Feed (Cursor Pagination) ──────────────────────────────────────────────
  const feedItems = ref([]);
  const feedLoading = ref(false);
  const feedHasMore = ref(false);
  const feedNextCursor = ref(null);
  const filters = ref({ dateFrom: null, dateTo: null });

  async function fetchFeed(options = {}) {
    const { refresh = false, limit = 10, startDate = null, endDate = null, search = '', type = '' } = options;

    if (refresh) {
      feedNextCursor.value = null;
      feedHasMore.value = false;
      feedItems.value = [];
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

      const res = await debtService.getFeed(params);
      const newItems = res.data.data || [];

      feedNextCursor.value = res.data.meta?.next_cursor || null;
      feedHasMore.value = !!res.data.meta?.has_more;

      if (refresh) {
        feedItems.value = newItems;
      } else {
        const existingIds = new Set(feedItems.value.map(item => String(item.id)));
        const filteredNew = newItems.filter(item => !existingIds.has(String(item.id)));
        feedItems.value = [...feedItems.value, ...filteredNew];
      }
    } catch (e) {
      error.value = e.response?.data?.message ?? "Failed to load feed";
    } finally {
      feedLoading.value = false;
    }
  }

  // ── create ──────────────────────────────────────────────────────────────────
  async function create(data) {
    if (!navigator.onLine) return _createOffline(data);
    loading.value = true;
    try {
      const res = await debtService.create(data);
      const existingIdx = debts.value.findIndex(d => d.id === res.data.data.id);
      if (existingIdx !== -1) {
        debts.value[existingIdx] = res.data.data;
      } else {
        debts.value.unshift(res.data.data);
      }
      await cacheUpsert("debts", res.data.data);
      if (data.type === "owed_to_me" && data.wallet_id) {
        await useWalletsStore().adjustBalance(data.wallet_id, -Math.abs(parseFloat(data.amount || 0)));
      }
      const statKey = data.type === 'owed_to_me' ? 'debts_owed_to_me' : 'debts_i_owe';
      useDashboardStore().adjustStat(statKey, Math.abs(parseFloat(data.amount || 0)));
      if (data.type === 'owed_to_me') {
        useDashboardStore().adjustStat('monthly_expenses', Math.abs(parseFloat(data.amount || 0)));
        const { useExpensesStore } = await import("./expenses.js");
        const expStore = useExpensesStore();
        expStore.invalidate();
        try {
          await expStore.fetchAll();
        } catch { /* ignore background refresh error */ }
      }
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().debt('Debt created', data.name);
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
      const optimistic = { ...data, id: tempId, _clientKey: crypto.randomUUID(), _pending: true, created_at: now, updated_at: now };
      debts.value.unshift(optimistic);
      await cacheUpsert("debts", optimistic);
      await outboxAdd({ method: "post", url: "/debts", data, entity: "debts", tempId });
      await refreshPendingCount();
      const statKey = data.type === 'owed_to_me' ? 'debts_owed_to_me' : 'debts_i_owe';
      await useDashboardStore().adjustStat(statKey, parseFloat(data.amount || 0));
      // When someone owes me (owed_to_me), I lent them money — log as an optimistic expense
      if (data.type === 'owed_to_me') {
        const { useExpensesStore } = await import("./expenses.js");
        const expStore = useExpensesStore();
        const walletsStore = useWalletsStore();
        let wallet = null;
        if (data.wallet_id) {
          if (walletsStore.wallets.length === 0) {
            try {
              const cached = await cacheGet("wallets");
              if (cached && cached.length > 0) {
                walletsStore.wallets = cached;
              }
            } catch { }
          }
          const walletRaw = walletsStore.wallets.find((w) => String(w.id) === String(data.wallet_id)) || null;
          wallet = walletRaw ? JSON.parse(JSON.stringify(walletRaw)) : null;
        }
        const amount = Math.abs(parseFloat(data.amount || 0));
        const optimisticExpense = {
          id: `tmp_debt_lent_${crypto.randomUUID()}`,
          _debt_temp_id: tempId,
          title: `Lent money to: ${data.name}`,
          amount: String(amount),
          category: "Bills/Debt",
          date: now.split("T")[0],
          wallet_id: data.wallet_id || null,
          wallet,
          description: data.description ?? "Lending money",
          created_at: now,
          updated_at: now,
          is_settled: false,
          _pending: true,
          _debt_lent: true,
        };
        expStore.expenses.unshift(optimisticExpense);
        await cacheUpsert("expenses", optimisticExpense);
        if (data.wallet_id) {
          await walletsStore.adjustBalance(data.wallet_id, -amount);
        }
        await useDashboardStore().adjustStat('monthly_expenses', amount);
      }
      useToast().offline('Saved offline', 'Debt creation queued');
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
      useToast().debt('Debt updated', res.data.data.name);
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
      if (newAmt !== oldAmt) await useDashboardStore().adjustStat(oldKey, newAmt - oldAmt);
    } else {
      await useDashboardStore().adjustStat(oldKey, -oldAmt);
      await useDashboardStore().adjustStat(newKey, +newAmt);
    }
    useToast().offline('Saved offline', 'Debt update queued');
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
        await useWalletsStore().adjustBalance(walletId, delta);
      }
      if (debt) {
        const amount = Math.abs(parseFloat(debt.amount || 0));
        const statKey = debt.type === 'owed_to_me' ? 'debts_owed_to_me' : 'debts_i_owe';
        useDashboardStore().adjustStat(statKey, -amount);
        if (debt.type === 'owed_to_me') {
          useDashboardStore().adjustStat('monthly_expenses', -amount);
        } else {
          useDashboardStore().adjustStat('monthly_expenses', amount);
        }

        const { useExpensesStore } = await import("./expenses.js");
        const expStore = useExpensesStore();
        if (debt.type === 'owed_to_me') {
          expStore.expenses.forEach(async (ex) => {
            if (
              ex.title === `Lent to ${debt.name}` ||
              ex.title === `Lent money to: ${debt.name}` ||
              ex.title === `Debt Repayment: ${debt.name}`
            ) {
              ex.is_settled = true;
              await cacheUpsert("expenses", ex);
            }
          });
        }
        expStore.invalidate();
        try {
          await expStore.fetchAll();
        } catch { /* ignore background refresh error */ }
      }
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().debt('Debt paid', debt?.name);
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
    const amount = debt ? Math.abs(parseFloat((debt.amount || 0) - (debt.amount_paid || 0))) : 0;
    if (idx !== -1) {
      debts.value[idx] = {
        ...debts.value[idx],
        is_paid: true,
        status: "paid",
        _pending: true,
      };
      await cacheUpsert("debts", debts.value[idx]);
    }
    if (walletId && debt) {
      const walletsStore = useWalletsStore();
      if (walletsStore.wallets.length === 0) {
        try {
          const cached = await cacheGet("wallets");
          if (cached && cached.length > 0) {
            walletsStore.wallets = cached;
          }
        } catch { }
      }
      const delta = debt?.type === "owed_to_me"
        ? +amount
        : -amount;
      await walletsStore.adjustBalance(walletId, delta);
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
      const statKey = debt.type === 'owed_to_me' ? 'debts_owed_to_me' : 'debts_i_owe';
      await useDashboardStore().adjustStat(statKey, -amount);

      const { useExpensesStore } = await import("./expenses.js");
      const expStore = useExpensesStore();
      const walletsStore = useWalletsStore();
      if (walletsStore.wallets.length === 0) {
        try {
          const cached = await cacheGet("wallets");
          if (cached && cached.length > 0) {
            walletsStore.wallets = cached;
          }
        } catch { }
      }
      const walletRaw = walletsStore.wallets.find((w) => String(w.id) === String(walletId)) || null;
      const wallet = walletRaw ? JSON.parse(JSON.stringify(walletRaw)) : null;
      const now = new Date().toISOString();

      if (debt.type === 'i_owe') {
        const optimisticExpense = {
          id: `tmp_debt_${crypto.randomUUID()}`,
          _debt_temp_id: id,
          title: `Debt Payment: ${debt.name}`,
          amount: String(amount),
          category: "Bills/Debt",
          date: now.split("T")[0],
          wallet_id: walletId,
          wallet,
          description: debt.description ?? "Paid off debt",
          created_at: now,
          updated_at: now,
          is_settled: false,
          _pending: true,
          _debt_payment: true,
        };
        expStore.expenses.unshift(optimisticExpense);
        await cacheUpsert("expenses", optimisticExpense);
        await useDashboardStore().adjustStat('monthly_expenses', amount);
      } else if (debt.type === 'owed_to_me') {
        expStore.expenses.forEach(async (ex) => {
          if (
            ex.title === `Lent to ${debt.name}` ||
            ex.title === `Lent money to: ${debt.name}` ||
            ex.title === `Debt Repayment: ${debt.name}`
          ) {
            ex.is_settled = true;
            await cacheUpsert("expenses", ex);
          }
        });
        await useDashboardStore().adjustStat('monthly_expenses', -amount);
      }
    }
    useToast().offline('Saved offline', 'Payment status queued');
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
        await useWalletsStore().adjustBalance(walletId, delta);
      }
      if (debt) {
        const paidAmount = Math.abs(parseFloat(amount || 0));
        const statKey = debt.type === 'owed_to_me' ? 'debts_owed_to_me' : 'debts_i_owe';
        useDashboardStore().adjustStat(statKey, -paidAmount);
        if (debt.type === 'owed_to_me') {
          useDashboardStore().adjustStat('monthly_expenses', -paidAmount);
        } else {
          useDashboardStore().adjustStat('monthly_expenses', paidAmount);
        }

        const { useExpensesStore } = await import("./expenses.js");
        const expStore = useExpensesStore();
        if (debt.type === 'owed_to_me') {
          const walletsStore = useWalletsStore();
          const walletRaw = walletsStore.wallets.find((w) => String(w.id) === String(walletId)) || null;
          const wallet = walletRaw ? JSON.parse(JSON.stringify(walletRaw)) : null;
          const nowStr = new Date().toISOString();
          const repaymentExpense = {
            id: `tmp_debt_repayment_${crypto.randomUUID()}`,
            title: `Debt Repayment: ${debt.name}`,
            amount: String(-paidAmount),
            category: "Bills/Debt",
            date: nowStr.split("T")[0],
            wallet_id: walletId,
            wallet,
            description: "Partial repayment received",
            created_at: nowStr,
            updated_at: nowStr,
            is_settled: false,
            _pending: true,
          };
          expStore.expenses.unshift(repaymentExpense);
          await cacheUpsert("expenses", repaymentExpense);
        }
        expStore.invalidate();
        try {
          await expStore.fetchAll();
        } catch { /* ignore background refresh error */ }
      }
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().debt('Payment recorded', debt?.name);
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
      const isPaid = newPaid >= totalAmount;
      debts.value[idx] = {
        ...debts.value[idx],
        amount_paid: newPaid.toFixed(2),
        amount_remaining: Math.max(0, totalAmount - newPaid).toFixed(2),
        is_paid: isPaid,
        status: isPaid ? "paid" : (debts.value[idx].status || ""),
        _pending: true,
      };
      await cacheUpsert("debts", debts.value[idx]);
    }
    if (walletId && amount) {
      const walletsStore = useWalletsStore();
      if (walletsStore.wallets.length === 0) {
        try {
          const cached = await cacheGet("wallets");
          if (cached && cached.length > 0) {
            walletsStore.wallets = cached;
          }
        } catch { }
      }
      const delta = debt?.type === "owed_to_me"
        ? +Math.abs(parseFloat(amount))
        : -Math.abs(parseFloat(amount));
      await walletsStore.adjustBalance(walletId, delta);
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
      await useDashboardStore().adjustStat(statKey, -paidAmount);

      const { useExpensesStore } = await import("./expenses.js");
      const expStore = useExpensesStore();
      const walletsStore = useWalletsStore();
      if (walletsStore.wallets.length === 0) {
        try {
          const cached = await cacheGet("wallets");
          if (cached && cached.length > 0) {
            walletsStore.wallets = cached;
          }
        } catch { }
      }
      const walletRaw = walletsStore.wallets.find((w) => String(w.id) === String(walletId)) || null;
      const wallet = walletRaw ? JSON.parse(JSON.stringify(walletRaw)) : null;
      const now = new Date().toISOString();

      if (debt.type === 'i_owe') {
        const optimisticExpense = {
          id: `tmp_debt_${crypto.randomUUID()}`,
          _debt_temp_id: id,
          title: `Partial Debt Payment: ${debt.name}`,
          amount: String(paidAmount),
          category: "Bills/Debt",
          date: now.split("T")[0],
          wallet_id: walletId,
          wallet,
          description: "Partial payment towards debt",
          created_at: now,
          updated_at: now,
          is_settled: false,
          _pending: true,
          _debt_payment: true,
        };
        expStore.expenses.unshift(optimisticExpense);
        await cacheUpsert("expenses", optimisticExpense);
        await useDashboardStore().adjustStat('monthly_expenses', paidAmount);
      } else if (debt.type === 'owed_to_me') {
        const repaymentExpense = {
          id: `tmp_debt_repayment_${crypto.randomUUID()}`,
          _debt_temp_id: id,
          title: `Debt Repayment: ${debt.name}`,
          amount: String(-paidAmount),
          category: "Bills/Debt",
          date: now.split("T")[0],
          wallet_id: walletId,
          wallet,
          description: "Partial repayment received",
          created_at: now,
          updated_at: now,
          is_settled: false,
          _pending: true,
        };
        expStore.expenses.unshift(repaymentExpense);
        await cacheUpsert("expenses", repaymentExpense);
        await useDashboardStore().adjustStat('monthly_expenses', -paidAmount);
      }
    }
    useToast().offline('Saved offline', 'Payment queued');
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
      useToast().delete('Debt deleted', 'Removed successfully');
    } catch (e) {
      if (isNetworkError(e)) return _removeOffline(id);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // ── archive ─────────────────────────────────────────────────────────────────
  async function archive(id) {
    if (!navigator.onLine) throw new Error("Cannot archive while offline");
    loading.value = true;
    try {
      await debtService.archive(id);
      debts.value = debts.value.filter((d) => d.id !== id);
      await cacheRemove("debts", id);
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().success('Debt archived', 'Moved to archives successfully');
    } catch (e) {
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
      await useDashboardStore().adjustStat(statKey, -Math.abs(parseFloat(toRemove.amount || 0)));
    }
    useToast().offline('Saved offline', 'Debt deletion queued');
  }

  function invalidate() {
    fetched.value = false;
    lastCacheKey.value = null;
  }

  function applyFilters(dateFrom, dateTo) {
    filters.value = {
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    };
  }

  function clearFilters() {
    filters.value = { dateFrom: null, dateTo: null };
  }

  return {
    debts,
    loading,
    error,
    fetched,
    fetchAll,
    create,
    update,
    markPaid,
    partialPay,
    remove,
    archive,
    applyFilters,
    clearFilters,
    feedItems,
    feedLoading,
    feedHasMore,
    feedNextCursor,
    fetchFeed,
    filters,
    clearFilters,
  };
});
