import { openDB } from 'idb'

const DB_NAME = 'pamilyahub_offline'
const DB_VERSION = 6

let _db = null

export async function getDb() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('outbox')) {
        const s = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
        s.createIndex('by_status', 'status')
      }
      for (const entity of ['expenses', 'wallets', 'debts']) {
        if (!db.objectStoreNames.contains(`cache_${entity}`)) {
          db.createObjectStore(`cache_${entity}`, { keyPath: 'id' })
        }
      }
      for (const entity of ['dashboard', 'salary', 'notes', 'user', 'files', 'chat_history', 'plans']) {
        if (!db.objectStoreNames.contains(`cache_${entity}`)) {
          db.createObjectStore(`cache_${entity}`, { keyPath: 'key' })
        }
      }
    },
  })
  return _db
}

// ── Serialize helper: strips Vue Proxy reactivity before IDB writes ─────────

function serialize(data) {
  return JSON.parse(JSON.stringify(data))
}

// ── Outbox ──────────────────────────────────────────────────────────────────

export async function outboxAdd(entry) {
  const db = await getDb()
  return db.add('outbox', serialize({
    createdAt: Date.now(),
    tries: 0,
    status: 'pending',
    lastError: null,
    ...entry,
  }))
}

export async function outboxGetPending() {
  const db = await getDb()
  const all = await db.getAllFromIndex('outbox', 'by_status', 'pending')
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function outboxRemove(id) {
  const db = await getDb()
  return db.delete('outbox', id)
}

export async function outboxUpdate(id, changes) {
  const db = await getDb()
  const tx = db.transaction('outbox', 'readwrite')
  const existing = await tx.store.get(id)
  if (existing) await tx.store.put(serialize({ ...existing, ...changes }))
  await tx.done
}

export async function outboxCount() {
  const db = await getDb()
  const pending = await db.getAllFromIndex('outbox', 'by_status', 'pending')
  return pending.length
}

export async function outboxRemapTempId(tempId, realId) {
  const db = await getDb()
  const pending = await db.getAllFromIndex('outbox', 'by_status', 'pending')
  const tx = db.transaction('outbox', 'readwrite')
  for (const entry of pending) {
    const urlHas = typeof entry.url === 'string' && entry.url.includes(tempId)
    const bodyStr = entry.data ? JSON.stringify(entry.data) : ''
    const dataHas = bodyStr.includes(tempId)
    if (urlHas || dataHas) {
      await tx.store.put({
        ...entry,
        url: entry.url ? entry.url.replace(new RegExp(tempId, 'g'), realId) : entry.url,
        data: dataHas
          ? JSON.parse(bodyStr.replace(new RegExp(tempId, 'g'), realId))
          : entry.data,
      })
    }
  }
  await tx.done
}

// ── List Entity Cache (expenses, wallets, debts) ────────────────────────────

export async function cacheSet(entity, items) {
  const db = await getDb()
  const tx = db.transaction(`cache_${entity}`, 'readwrite')
  await tx.store.clear()
  for (const item of items) await tx.store.put(serialize(item))
  await tx.done
}

export async function cacheGet(entity) {
  const db = await getDb()
  return db.getAll(`cache_${entity}`)
}

export async function cacheUpsert(entity, item) {
  const db = await getDb()
  return db.put(`cache_${entity}`, serialize(item))
}

export async function cacheRemove(entity, id) {
  const db = await getDb()
  return db.delete(`cache_${entity}`, id)
}

// ── Single-Document Cache (dashboard, salary) ────────────────────────────────

export async function cacheSingleSet(entity, data, key = 'singleton') {
  const db = await getDb()
  return db.put(`cache_${entity}`, serialize({ key, ...data }))
}

export async function cacheSingleGet(entity, key = 'singleton') {
  const db = await getDb()
  const row = await db.get(`cache_${entity}`, key)
  if (!row) return null
  const { key: _k, ...data } = row
  return data
}

export async function cacheSingleRemove(entity, key = 'singleton') {
  const db = await getDb()
  return db.delete(`cache_${entity}`, key)
}

// ── Utility ──────────────────────────────────────────────────────────────────

export function isNetworkError(err) {
  return (
    !err.response &&
    (err.code === 'ERR_NETWORK' ||
      err.code === 'ECONNABORTED' ||
      err.message === 'Network Error')
  )
}
