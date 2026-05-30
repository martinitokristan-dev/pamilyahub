import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { walletService } from "@/services/walletService.js";
import { useToast } from "@/composables/useToast.js";
import { useDashboardStore } from "./dashboard.js";
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

const CACHE_TTL = 5 * 60 * 1000;

export const useWalletsStore = defineStore("wallets", () => {
  const wallets = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const fetched = ref(false);
  const cacheTime = ref(null);

  const totalBalance = computed(() =>
    wallets.value.reduce((sum, w) => sum + parseFloat(w.balance || 0), 0)
  );

  function isCacheValid() {
    if (!cacheTime.value) return false;
    return Date.now() - cacheTime.value < CACHE_TTL;
  }

  // ── Sync event listeners ────────────────────────────────────────────────────
  if (typeof window !== "undefined") {
    window.addEventListener("pamilya:id-remap", (e) => {
      const { entity, tempId, realId } = e.detail;
      if (entity !== "wallets" || !tempId) return;
      const idx = wallets.value.findIndex((w) => w.id === tempId);
      if (idx !== -1) {
        wallets.value[idx].id = realId;
        wallets.value[idx]._pending = false;
      }
    });
    window.addEventListener("pamilya:sync-done", (e) => {
      if (e.detail.entity === "wallets") {
        useDashboardStore().invalidate();
      }
    });
    // After full drain: mark stale for lazy refetch; optimistic UI stays stable
    window.addEventListener("pamilya:drain-complete", () => {
      fetched.value = false;
      cacheTime.value = null;
    });
  }

  // ── fetchAll ────────────────────────────────────────────────────────────────
  async function fetchAll(force = false) {
    if (fetched.value && !force && isCacheValid()) return;
    // Don't overwrite optimistic values while outbox is still draining
    if (isSyncing.value && !force) return;

    // Hydrate from IndexedDB first
    if (wallets.value.length === 0) {
      try {
        const cached = await cacheGet("wallets");
        if (cached.length > 0) {
          wallets.value = cached;
          // Set cacheTime so isCacheValid() returns true and prevents
          // unnecessary network attempts that could overwrite optimistic balances
          if (!cacheTime.value) cacheTime.value = Date.now();
        }
      } catch { /* ignore */ }
    }

    loading.value = true;
    try {
      const res = await walletService.getAll();
      const serverItems = res.data.data || [];
      const pendingItems = wallets.value.filter((w) => w._pending);
      const serverIds = new Set(serverItems.map((s) => String(s.id)));
      const unsyncedPending = pendingItems.filter((p) => !serverIds.has(String(p.id)));
      wallets.value = [...unsyncedPending, ...serverItems];
      await cacheSet("wallets", [...serverItems, ...unsyncedPending]);
      fetched.value = true;
      cacheTime.value = Date.now();
    } catch (e) {
      if (isNetworkError(e) && wallets.value.length > 0) {
        fetched.value = true;
        // Prevent repeated network attempts while offline
        if (!cacheTime.value) cacheTime.value = Date.now();
      } else {
        error.value = e.response?.data?.message ?? "Failed to load wallets";
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
      const res = await walletService.create(data);
      wallets.value.push(res.data.data);
      await cacheUpsert("wallets", res.data.data);
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().wallet('Wallet created', data.name);
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
      const optimistic = {
        ...data,
        id: tempId,
        _clientKey: crypto.randomUUID(),
        balance: parseFloat(data.balance) || 0,
        _pending: true,
        created_at: now,
        updated_at: now,
      };
      wallets.value.push(optimistic);
      await cacheUpsert("wallets", optimistic);
      await outboxAdd({ method: "post", url: "/wallets", data, entity: "wallets", tempId });
      await refreshPendingCount();
      useToast().offline('Saved offline', 'Wallet creation queued');
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
      const res = await walletService.update(id, data);
      const idx = wallets.value.findIndex((w) => w.id === id);
      if (idx !== -1) wallets.value[idx] = res.data.data;
      await cacheUpsert("wallets", res.data.data);
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().wallet('Wallet updated', data.name);
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
      const idx = wallets.value.findIndex((w) => w.id === id);
      const updated = {
        ...(wallets.value[idx] || {}),
        ...data,
        id,
        _pending: true,
        updated_at: now,
      };
      if (idx !== -1) wallets.value[idx] = updated;
      await cacheUpsert("wallets", updated);
      const isTemp = String(id).startsWith("tmp_");
      if (isTemp) {
        const pending = await outboxGetPending();
        const createEntry = pending.find((e) => e.tempId === id && e.method === "post");
        if (createEntry) await outboxUpdate(createEntry.id, { data: { ...createEntry.data, ...data } });
      } else {
        await outboxAdd({ method: "put", url: `/wallets/${id}`, data, entity: "wallets", recordId: id });
      }
      await refreshPendingCount();
      useToast().offline('Saved offline', 'Wallet update queued');
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
      await walletService.delete(id);
      wallets.value = wallets.value.filter((w) => w.id !== id);
      await cacheRemove("wallets", id);
      useDashboardStore().invalidate({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
      invalidate();
      useToast().delete('Wallet deleted', 'Removed successfully');
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
      wallets.value = wallets.value.filter((w) => w.id !== id);
      await cacheRemove("wallets", id);
      const isTemp = String(id).startsWith("tmp_");
      if (isTemp) {
        const pending = await outboxGetPending();
        const createEntry = pending.find((e) => e.tempId === id && e.method === "post");
        if (createEntry) await outboxDeleteEntry(createEntry.id);
      } else {
        await outboxAdd({ method: "delete", url: `/wallets/${id}`, entity: "wallets", recordId: id });
      }
      await refreshPendingCount();
      useToast().offline('Saved offline', 'Wallet deletion queued');
    } finally {
      loading.value = false;
    }
  }

  async function adjustBalance(walletId, delta) {
    if (wallets.value.length === 0) {
      try {
        const cached = await cacheGet("wallets");
        if (cached && cached.length > 0) {
          wallets.value = cached;
        }
      } catch (e) {
        console.error("Failed to load wallets cache in adjustBalance", e);
      }
    }
    const w = wallets.value.find((w) => String(w.id) === String(walletId));
    if (w) {
      w.balance = (parseFloat(w.balance || 0) + delta).toFixed(2);
      // Refresh cacheTime so fetchAll won't re-trigger a network call that could
      // overwrite the optimistic balance we just set
      cacheTime.value = Date.now();
      try {
        // Deep-clone to strip Vue reactive proxy before persisting to IndexedDB
        await cacheSet("wallets", JSON.parse(JSON.stringify(wallets.value)));
      } catch (e) {
        console.error("Failed to save wallets cache in adjustBalance", e);
      }
    }
  }

  function invalidate() {
    fetched.value = false;
  }

  return {
    wallets,
    loading,
    error,
    fetched,
    totalBalance,
    fetchAll,
    create,
    update,
    remove,
    adjustBalance,
    invalidate,
  };
});
