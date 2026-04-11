import { useState, useEffect } from 'react'
import { getSetting, setSetting, CHECK_IN_SLOTS, getAllEntries, addEntry } from '../db'

export default function Settings() {
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifStatus, setNotifStatus] = useState('unknown')
  const [saved, setSaved] = useState(false)
  const [importStatus, setImportStatus] = useState('')

  useEffect(() => {
    checkNotifications()
  }, [])

  async function exportData() {
    const entries = await getAllEntries()
    const json = JSON.stringify(entries, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gut-tracker-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const entries = JSON.parse(text)
      if (!Array.isArray(entries)) {
        setImportStatus('❌ Invalid format')
        return
      }
      let imported = 0
      for (const entry of entries) {
        try {
          await addEntry(entry)
          imported++
        } catch (err) {
          // Skip entries that already exist or are invalid
        }
      }
      setImportStatus(`✓ Imported ${imported} entries`)
      setTimeout(() => setImportStatus(''), 3000)
      e.target.value = ''
    } catch (err) {
      setImportStatus('❌ Failed to import')
    }
  }

  async function checkNotifications() {
    if (!('Notification' in window)) {
      setNotifStatus('unsupported')
      return
    }
    setNotifStatus(Notification.permission)
    if (Notification.permission === 'granted') setNotifEnabled(true)
  }

  async function requestNotifications() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotifStatus(result)
    if (result === 'granted') {
      setNotifEnabled(true)
      await setSetting('notifications', true)
      scheduleNotifications()
    }
  }

  function scheduleNotifications() {
    // Schedule via service worker if available
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        // Periodic sync for background notifications (Android Chrome PWA)
        if ('periodicSync' in reg) {
          reg.periodicSync.register('gut-check-in', { minInterval: 30 * 60 * 1000 })
            .catch(() => { /* not available */ })
        }
      })
    }
  }

  function sendTestNotification() {
    if (Notification.permission === 'granted') {
      new Notification('Gut Tracker — Test 🌿', {
        body: 'Notifications are working! You\'ll be reminded at 7am, 9am, 1pm, 5pm, and 9pm.',
        icon: '/icon-192.png',
      })
    }
  }

  async function saveSettings() {
    await setSetting('notifications', notifEnabled)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function checkForUpdates() {
    // Clear service worker cache and reload
    if ('serviceWorker' in navigator) {
      // Unregister all service workers
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const reg of registrations) {
        await reg.unregister()
      }
      // Clear caches
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
    }
    // Reload without cache
    window.location.reload(true)
  }

  const notifSlots = CHECK_IN_SLOTS.map(s => {
    const h = s.hour
    const ampm = h >= 12 ? 'pm' : 'am'
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    const min = s.minute > 0 ? `:${String(s.minute).padStart(2, '0')}` : ''
    return `${h12}${min}${ampm}`
  })

  return (
    <div style={s.wrap}>
      <div style={s.pageTitle}>Settings</div>

      {/* Notifications */}
      <div style={s.card}>
        <div style={s.cardTitle}>🔔 Check-in Reminders</div>
        <div style={s.cardBody}>
          Reminders will fire at: <strong>{notifSlots.join(', ')}</strong>
        </div>

        {notifStatus === 'unsupported' && (
          <div style={s.warningBanner}>⚠️ Notifications aren't supported in this browser. Try Chrome on Android for the best experience.</div>
        )}

        {notifStatus === 'denied' && (
          <div style={s.warningBanner}>Notifications are blocked. Open your browser settings and allow notifications for this site, then return here.</div>
        )}

        {notifStatus !== 'unsupported' && notifStatus !== 'denied' && notifStatus !== 'granted' && (
          <button style={s.enableBtn} onClick={requestNotifications}>
            Enable Notifications
          </button>
        )}

        {notifStatus === 'granted' && (
          <div style={s.successBanner}>
            ✓ Notifications are enabled!
            <button style={s.testBtn} onClick={sendTestNotification}>Send test</button>
          </div>
        )}
      </div>

      {/* iOS install instructions */}
      <div style={s.card}>
        <div style={s.cardTitle}>📱 Install on Your Phone</div>
        <div style={s.steps}>
          <div style={s.step}><span style={s.stepNum}>1</span><span>Open this URL in your phone's browser (Safari on iPhone, Chrome on Android)</span></div>
          <div style={s.step}><span style={s.stepNum}>2</span><span><strong>iPhone:</strong> Tap the Share button (box with arrow) → "Add to Home Screen"</span></div>
          <div style={s.step}><span style={s.stepNum}>2</span><span><strong>Android:</strong> Tap ⋮ menu → "Add to Home screen" or "Install app"</span></div>
          <div style={s.step}><span style={s.stepNum}>3</span><span>Launch from your home screen — it'll run like a native app with no browser bar</span></div>
        </div>
        <div style={s.note}>
          ⚠️ For background notifications on iPhone, you need iOS 16.4+ and the app must be installed to your home screen first.
        </div>
      </div>

      {/* Data backup/restore */}
      <div style={s.card}>
        <div style={s.cardTitle}>💾 Backup & Restore</div>
        <div style={s.cardBody}>
          All data is stored <strong>on this device</strong> only. Backup your entries before switching devices.
        </div>
        <button style={s.enableBtn} onClick={exportData}>
          📥 Download Backup
        </button>
        <label style={{ ...s.enableBtn, marginTop: 8, display: 'block', cursor: 'pointer', textAlign: 'center', padding: '14px', background: '#F1F5F9', color: '#4F46E5', border: '2px solid #C7D2FE' }}>
          📤 Import Backup
          <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </label>
        {importStatus && (
          <div style={{ marginTop: 10, fontSize: 13, color: importStatus.startsWith('✓') ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
            {importStatus}
          </div>
        )}
      </div>

      {/* Updates */}
      <div style={s.card}>
        <div style={s.cardTitle}>🔄 Check for Updates</div>
        <div style={s.cardBody}>
          Refreshes the app to the latest version. Your data stays safe on this device.
        </div>
        <button style={s.enableBtn} onClick={checkForUpdates}>
          Check for Updates
        </button>
      </div>

      {/* About */}
      <div style={s.card}>
        <div style={s.cardTitle}>ℹ️ About This App</div>
        <div style={s.cardBody}>
          Built to help you track gut health and identify trigger patterns. <br /><br />
          <strong>Check-in times:</strong> 7am (wake-up), 9am, 1pm, 5pm, 9pm<br />
          <strong>Evening check-in</strong> includes water + alcohol intake<br />
          <strong>Every check-in</strong> includes a bowel movement log<br /><br />
          Export your weekly data to Claude for AI-powered pattern analysis.
        </div>
      </div>

      <div style={{ height: 80 }} />
    </div>
  )
}

const s = {
  wrap: { padding: '24px 20px', maxWidth: 480, margin: '0 auto' },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 20 },
  card: { background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: '18px', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 10 },
  cardBody: { fontSize: 14, color: '#64748B', lineHeight: 1.6 },
  enableBtn: { width: '100%', marginTop: 12, padding: '14px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  successBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '10px 14px', marginTop: 10, fontSize: 14, color: '#16A34A', fontWeight: 600 },
  testBtn: { background: 'none', border: '1px solid #86EFAC', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#16A34A', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 },
  warningBanner: { background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', marginTop: 10, fontSize: 13, color: '#C2410C', lineHeight: 1.4 },
  steps: { display: 'flex', flexDirection: 'column', gap: 10 },
  step: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#374151', lineHeight: 1.5 },
  stepNum: { background: '#4F46E5', color: '#fff', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 },
  note: { marginTop: 12, fontSize: 12, color: '#94A3B8', lineHeight: 1.4 },
}
