import { ref } from 'vue'
import {
  getDb,
  outboxGetPending,
  outboxRemove,
  outboxUpdate,
  outboxCount,
  outboxRemapTempId,
  cacheUpsert,
  cacheRemove,
} from './offlineDb.js'
import api from './axios.js'

export const pendingCount = ref(0)
export const hasFailedEntries = ref(false)
export const isSyncing = ref(false)

let _lock = false

export async function refreshPendingCount() {
  const db = await getDb()
  const pending = await db.getAllFromIndex('outbox', 'by_status', 'pending')
  pendingCount.value = pending.length

  const failed = await db.getAllFromIndex('outbox', 'by_status', 'failed')
  hasFailedEntries.value = failed.length > 0

  window.dispatchEvent(
    new CustomEvent('pamilya:pending-count', {
      detail: {
        count: pendingCount.value,
        hasFailed: hasFailedEntries.value,
      },
    })
  )
}

export async function retryFailedEntries() {
  const db = await getDb()
  const failed = await db.getAllFromIndex('outbox', 'by_status', 'failed')
  for (const entry of failed) {
    await outboxUpdate(entry.id, { status: 'pending', tries: 0 })
  }
  await refreshPendingCount()
  if (navigator.onLine) {
    drainOutbox()
  }
}

export async function initSyncEngine() {
  await refreshPendingCount()
  window.addEventListener('online', handleOnline)
  if (navigator.onLine) drainOutbox()
}


function handleOnline() {
  drainOutbox()
}

export async function drainOutbox() {
  if (_lock || !navigator.onLine) return
  _lock = true
  isSyncing.value = true

  const syncedEntities = new Set()
  try {
    const entries = await outboxGetPending()
    for (const entry of entries) {
      const shouldStop = await processEntry(entry)
      if (entry.entity) syncedEntities.add(entry.entity)
      if (shouldStop) break
    }
  } finally {
    _lock = false
    isSyncing.value = false
    await refreshPendingCount()
    if (syncedEntities.size > 0) {
      window.dispatchEvent(
        new CustomEvent('pamilya:drain-complete', { detail: { entities: [...syncedEntities] } })
      )
    }
  }
}

async function processEntry(entry) {
  let res
  try {
    res = await api({
      method: entry.method,
      url: entry.url,
      data: entry.data,
      params: entry.params,
    })
  } catch (err) {
    if (err.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('pamilya:sync-auth-error'))
      return true
    }
    if (err.response && err.response.status >= 400 && err.response.status < 500) {
      await outboxUpdate(entry.id, {
        status: 'failed',
        lastError: err.response?.data?.message || `Client error ${err.response.status}`,
      })
      window.dispatchEvent(
        new CustomEvent('pamilya:sync-failed', {
          detail: { entity: entry.entity, error: err.response?.data?.message },
        })
      )
      return false
    }
    await outboxUpdate(entry.id, {
      tries: (entry.tries || 0) + 1,
      lastError: err.message,
    })
    return true
  }

  const serverData = res.data?.data

  if (entry.tempId && serverData?.id && String(entry.tempId) !== String(serverData.id)) {
    await outboxRemapTempId(entry.tempId, String(serverData.id))
  }

  if (entry.entity && ['expenses', 'wallets', 'debts'].includes(entry.entity)) {
    if (entry.method === 'delete') {
      const idToRemove = entry.recordId ?? entry.tempId
      if (idToRemove != null) await cacheRemove(entry.entity, idToRemove)
    } else if (serverData) {
      await cacheUpsert(entry.entity, serverData)
      if (entry.tempId && serverData.id && String(entry.tempId) !== String(serverData.id)) {
        await cacheRemove(entry.entity, entry.tempId)
      }
    }
  }

  await outboxRemove(entry.id)

  window.dispatchEvent(
    new CustomEvent('pamilya:id-remap', {
      detail: {
        entity: entry.entity,
        tempId: entry.tempId,
        realId: serverData?.id,
        serverData,
      },
    })
  )
  window.dispatchEvent(
    new CustomEvent('pamilya:sync-done', {
      detail: { entity: entry.entity, method: entry.method, serverData },
    })
  )

  return false
}
