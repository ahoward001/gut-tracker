import { useState, useEffect, useCallback } from 'react'
import Dashboard from './components/Dashboard'
import CheckIn from './components/CheckIn'
import History from './components/History'
import Report from './components/Report'
import Settings from './components/Settings'
import { addEntry, CHECK_IN_SLOTS, getSlotForHour, getMissedSlots, getEntriesForDate, getEntriesForLastNDays, toDateString } from './db'

const TABS = [
  { id: 'home',     label: 'Home',    icon: '🏠' },
  { id: 'history',  label: 'History', icon: '📅' },
  { id: 'report',   label: 'Report',  icon: '📊' },
  { id: 'settings', label: 'Settings',icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState('home')
  const [checkingIn, setCheckingIn] = useState(false)
  const [activeSlot, setActiveSlot] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notifBadge, setNotifBadge] = useState(0)
  const [sundayReviewSymptoms, setSundayReviewSymptoms] = useState([])
  const [showSundayReview, setShowSundayReview] = useState(false)

  // Check for missed check-ins on mount and every minute
  useEffect(() => {
    checkMissed()
    const interval = setInterval(checkMissed, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Check for Sunday review on mount and when tab changes
  useEffect(() => {
    checkSundayReview()
  }, [tab])

  // Register periodic background sync for Service Worker notifications
  useEffect(() => {
    if ('serviceWorker' in navigator && 'BackgroundSyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.periodicSync.register('gut-check-in', { minInterval: 60 * 1000 }).catch(e => {
          console.log('Periodic sync not available:', e.message)
          scheduleNextNotification() // Fallback to app-level notifications
        })
      })
    } else {
      scheduleNextNotification() // Fallback for browsers without Background Sync
    }
  }, [])

  async function checkMissed() {
    const today = toDateString(new Date())
    const entries = await getEntriesForDate(today)
    const missed = getMissedSlots(entries)
    setNotifBadge(missed.length)
  }

  async function checkSundayReview() {
    const now = new Date()
    const dayOfWeek = now.getDay()

    // 0 = Sunday
    if (dayOfWeek !== 0) {
      setShowSundayReview(false)
      return
    }

    // Get last 7 days of entries
    const entries = await getEntriesForLastNDays(7)
    const customSymptoms = entries
      .filter(e => e.customSymptom)
      .map(e => ({ date: e.date, symptom: e.customSymptom }))
      .sort((a, b) => a.date.localeCompare(b.date))

    if (customSymptoms.length > 0) {
      setSundayReviewSymptoms(customSymptoms)
      setShowSundayReview(true)
    }
  }

  function scheduleNextNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const now = new Date()
    const checkTimes = CHECK_IN_SLOTS.map(s => {
      const d = new Date()
      d.setHours(s.hour, s.minute, 0, 0)
      return d
    })

    const upcoming = checkTimes.find(t => t > now)
    if (!upcoming) return

    const delay = upcoming.getTime() - now.getTime()
    const slot = CHECK_IN_SLOTS.find(s => s.hour === upcoming.getHours())

    setTimeout(() => {
      if (Notification.permission === 'granted') {
        const n = new Notification(`Gut Check — ${slot?.label || 'Check-in'} 🌿`, {
          body: 'Tap to log how you\'re feeling.',
          icon: '/icon-192.png',
          tag: `gut-checkin-${slot?.id}`,
          renotify: true,
        })
        n.onclick = () => {
          window.focus()
          setActiveSlot(slot)
          setCheckingIn(true)
          setTab('home')
          n.close()
        }
        // Schedule the next one
        scheduleNextNotification()
        checkMissed()
      }
    }, delay)
  }

  async function handleSave(data) {
    await addEntry(data)
    setRefreshKey(k => k + 1)
    await checkMissed()
    // Auto-close after a brief "done" display (handled in CheckIn component)
    setTimeout(() => {
      setCheckingIn(false)
      setActiveSlot(null)
      setTab('home')
    }, 1800)
  }

  function openCheckIn(slot) {
    setActiveSlot(slot || null)
    setCheckingIn(true)
  }

  return (
    <div style={styles.app}>
      {/* Sunday review overlay */}
      {showSundayReview && (
        <div style={styles.overlay}>
          <div style={styles.overlayHeader}>
            <button style={styles.closeBtn} onClick={() => setShowSundayReview(false)}>
              ✕
            </button>
          </div>
          <div style={styles.overlayContent}>
            <div style={{ padding: '24px 20px', maxWidth: 480, margin: '0 auto', minHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Weekly Symptom Review</h2>
              <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>Custom symptoms logged this week:</p>
              <div style={{ flex: 1 }}>
                {sundayReviewSymptoms.map((item, idx) => (
                  <div key={idx} style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', marginBottom: 12, borderLeft: '4px solid #4F46E5' }}>
                    <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>{item.date}</div>
                    <div style={{ fontSize: 15, color: '#0F172A' }}>{item.symptom}</div>
                  </div>
                ))}
              </div>
              <button style={{ width: '100%', padding: '16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 20 }} onClick={() => setShowSundayReview(false)}>
                Got it, continue →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-in overlay */}
      {checkingIn && (
        <div style={styles.overlay}>
          <div style={styles.overlayHeader}>
            <button style={styles.closeBtn} onClick={() => { setCheckingIn(false); setActiveSlot(null) }}>
              ✕
            </button>
          </div>
          <div style={styles.overlayContent}>
            <CheckIn
              onSave={handleSave}
              initialSlot={activeSlot}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={styles.content}>
        {tab === 'home'     && <Dashboard onCheckIn={openCheckIn} refreshKey={refreshKey} />}
        {tab === 'history'  && <History refreshKey={refreshKey} />}
        {tab === 'report'   && <Report refreshKey={refreshKey} />}
        {tab === 'settings' && <Settings />}
      </div>

      {/* Bottom nav */}
      <nav style={styles.nav}>
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            style={{
              ...styles.navBtn,
              color: tab === id ? '#4F46E5' : '#94A3B8',
            }}
            onClick={() => setTab(id)}
          >
            <div style={styles.navIconWrap}>
              <span style={styles.navIcon}>{icon}</span>
              {id === 'home' && notifBadge > 0 && (
                <span style={styles.badge}>{notifBadge}</span>
              )}
            </div>
            <span style={{ ...styles.navLabel, fontWeight: tab === id ? 700 : 400 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

const styles = {
  app: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    maxWidth: 480,
    margin: '0 auto',
    position: 'relative',
    fontFamily: "'EB Garamond', Georgia, 'Times New Roman', serif",
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 80,
  },
  nav: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    background: '#ffffff',
    borderTop: '1px solid #F1F5F9',
    padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
    zIndex: 100,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
  },
  navBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '6px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'color 0.15s',
  },
  navIconWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: { fontSize: 22 },
  navLabel: { fontSize: 11, letterSpacing: 0.2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    background: '#EF4444',
    color: '#fff',
    borderRadius: '50%',
    width: 16,
    height: 16,
    fontSize: 10,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: 480,
    background: '#ffffff',
    zIndex: 200,
    overflowY: 'auto',
  },
  overlayHeader: {
    position: 'sticky',
    top: 0,
    padding: '16px 20px 0',
    display: 'flex',
    justifyContent: 'flex-end',
    background: '#fff',
    zIndex: 1,
  },
  overlayContent: { paddingTop: 0 },
  closeBtn: {
    background: '#F1F5F9',
    border: 'none',
    borderRadius: '50%',
    width: 36,
    height: 36,
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748B',
    fontFamily: 'inherit',
  },
}
