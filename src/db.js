// IndexedDB wrapper for gut tracker data persistence

const DB_NAME = 'gut-tracker-db'
const DB_VERSION = 1
const STORE_ENTRIES = 'entries'
const STORE_SETTINGS = 'settings'

let dbInstance = null

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) { resolve(dbInstance); return }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
        const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('date', 'date', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' })
      }
    }
    request.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance) }
    request.onerror = (e) => reject(e.target.error)
  })
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function toDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ── Entries ──────────────────────────────────────────────────────────────────

export async function addEntry(entry) {
  const db = await openDB()
  const now = new Date()
  const record = {
    id: generateId(),
    timestamp: now.getTime(),
    date: toDateString(now),
    hour: now.getHours(),
    ...entry
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENTRIES, 'readwrite')
    tx.objectStore(STORE_ENTRIES).add(record)
    tx.oncomplete = () => resolve(record)
    tx.onerror = (e) => reject(e.target.error)
  })
}

export async function getAllEntries() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENTRIES, 'readonly')
    const req = tx.objectStore(STORE_ENTRIES).index('timestamp').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function getEntriesForDate(dateStr) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENTRIES, 'readonly')
    const req = tx.objectStore(STORE_ENTRIES).index('date').getAll(dateStr)
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.timestamp - b.timestamp))
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function getEntriesInRange(startDate, endDate) {
  const all = await getAllEntries()
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime() + 86400000
  return all.filter(e => e.timestamp >= start && e.timestamp <= end)
}

export async function getEntriesForLastNDays(n) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - n)
  return getEntriesInRange(toDateString(start), toDateString(end))
}

export async function deleteEntry(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENTRIES, 'readwrite')
    tx.objectStore(STORE_ENTRIES).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = (e) => reject(e.target.error)
  })
}

export async function updateEntry(id, updates) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENTRIES, 'readwrite')
    const store = tx.objectStore(STORE_ENTRIES)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const record = getReq.result
      if (!record) { reject(new Error('Entry not found')); return }
      const updated = { ...record, ...updates, id } // preserve id, don't allow changes
      const putReq = store.put(updated)
      putReq.onsuccess = () => resolve(updated)
      putReq.onerror = (e) => reject(e.target.error)
    }
    getReq.onerror = (e) => reject(e.target.error)
  })
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key, defaultValue = null) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readonly')
    const req = tx.objectStore(STORE_SETTINGS).get(key)
    req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue)
    req.onerror = (e) => reject(e.target.error)
  })
}

export async function setSetting(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SETTINGS, 'readwrite')
    tx.objectStore(STORE_SETTINGS).put({ key, value })
    tx.oncomplete = () => resolve()
    tx.onerror = (e) => reject(e.target.error)
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export { toDateString }

// Feeling severity scores (for correlation math)
export const FEELING_SCORES = {
  good: 0,
  uncomfortable: 1,
  bloated: 2,
  pain: 3,
  destruction: 4
}

export const FEELING_META = {
  good:         { label: 'Good',          emoji: '😊', color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
  uncomfortable:{ label: 'Uncomfortable', emoji: '😕', color: '#D97706', bg: '#FEF3C7', border: '#FBBF24' },
  bloated:      { label: 'Bloated',       emoji: '😮‍💨', color: '#9A3412', bg: '#FFEDD5', border: '#EA580C' },
  pain:         { label: 'Pain',          emoji: '😣', color: '#DC2626', bg: '#FEF2F2', border: '#DC2626' },
  destruction:  { label: 'Destruction',   emoji: '💀', color: '#7C3AED', bg: '#F5F3FF', border: '#C4B5FD' }
}

export const CHECK_IN_SLOTS = [
  { id: 'wake',      label: 'Wake-up',   hour: 7,  minute: 0,  hasMeal: false },
  { id: 'morning',   label: 'Morning',   hour: 9,  minute: 0,  hasMeal: true  },
  { id: 'lunch',     label: 'Lunch',     hour: 13, minute: 0,  hasMeal: true  },
  { id: 'afternoon', label: 'Afternoon', hour: 17, minute: 0,  hasMeal: true  },
  { id: 'evening',   label: 'Evening',   hour: 21, minute: 0,  hasMeal: true  }
]

export function getSlotForHour(hour) {
  if (hour >= 5  && hour < 8 ) return 'wake'
  if (hour >= 8  && hour < 11) return 'morning'
  if (hour >= 11 && hour < 15) return 'lunch'
  if (hour >= 15 && hour < 19) return 'afternoon'
  if (hour >= 19 || hour < 5 ) return 'evening'
  return 'evening'
}

export function getMissedSlots(todayEntries) {
  const now = new Date()
  const currentHour = now.getHours()
  const loggedSlots = new Set(todayEntries.map(e => e.slot))
  return CHECK_IN_SLOTS.filter(slot => {
    const slotHour = slot.hour
    return currentHour >= slotHour && !loggedSlots.has(slot.id)
  })
}
