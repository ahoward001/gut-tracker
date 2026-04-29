import { useState, useEffect } from 'react'
import { getAllEntries, toDateString, FEELING_META, deleteEntry, updateEntry } from '../db'
import { MANUAL_TRIGGERS } from './CheckIn'

export default function History({ refreshKey }) {
  const [entries, setEntries] = useState([])
  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()))
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('calendar') // 'calendar' | 'day'
  const [editingEntry, setEditingEntry] = useState(null)

  useEffect(() => { load() }, [refreshKey])

  async function load() {
    setLoading(true)
    const all = await getAllEntries()
    setEntries(all)
    setLoading(false)
  }

  async function handleDelete(id) {
    await deleteEntry(id)
    load()
  }

  async function handleSaveEdit(id, updates) {
    await updateEntry(id, updates)
    setEditingEntry(null)
    load()
  }

  // Build a map of date → worst feeling score for the calendar
  const dateMap = {}
  for (const e of entries) {
    if (!e.feeling) continue
    const score = { good: 0, uncomfortable: 1, bloated: 2, pain: 3, destruction: 4 }[e.feeling] ?? 0
    if (dateMap[e.date] === undefined || score > dateMap[e.date]) {
      dateMap[e.date] = score
    }
  }

  // Full history calendar grid — shows 18 months of data
  const today = new Date()
  const calStart = new Date(today)
  calStart.setDate(calStart.getDate() - 30) // 30 days back
  const calDays = []
  for (let i = 0; i < 38; i++) {
    const d = new Date(calStart)
    d.setDate(calStart.getDate() + i)
    calDays.push(toDateString(d))
  }

  const dayEntries = entries.filter(e => e.date === selectedDate).sort((a, b) => b.timestamp - a.timestamp)

  function scoreToColor(score) {
    if (score === 0) return '#DCFCE7'
    if (score === 1) return '#FEF3C7'
    if (score === 2) return '#FFEDD5'
    if (score === 3) return '#FEE2E2'
    return '#EDE9FE'
  }
  function scoreToBorder(score) {
    if (score === 0) return '#86EFAC'
    if (score === 1) return '#FCD34D'
    if (score === 2) return '#FDBA74'
    if (score === 3) return '#FCA5A5'
    return '#C4B5FD'
  }

  return (
    <div style={s.wrap}>
      <div style={s.pageTitle}>History</div>

      {/* Calendar */}
      <div style={s.calendarWrap}>
        <div style={s.weekLabels}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} style={s.weekLabel}>{d}</div>
          ))}
        </div>
        <div style={s.calGrid}>
          {/* offset for first day */}
          {Array.from({ length: new Date(calDays[0] + 'T12:00:00').getDay() }).map((_, i) => (
            <div key={'pad-' + i} />
          ))}
          {calDays.map(date => {
            const score = dateMap[date]
            const isSelected = date === selectedDate
            const isToday = date === toDateString(new Date())
            const hasSomething = score !== undefined
            return (
              <button
                key={date}
                style={{
                  ...s.calDay,
                  background: hasSomething ? scoreToColor(score) : '#F8FAFC',
                  borderColor: isSelected ? '#4F46E5' : hasSomething ? scoreToBorder(score) : '#F1F5F9',
                  borderWidth: isSelected ? 2 : 1,
                  boxShadow: isToday ? '0 0 0 2px #4F46E5' : 'none',
                }}
                onClick={() => { setSelectedDate(date); setView('day') }}
              >
                <span style={{ ...s.calDayNum, color: isSelected ? '#4F46E5' : '#374151', fontWeight: isToday ? 800 : 400 }}>
                  {new Date(date + 'T12:00:00').getDate()}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={s.legend}>
        {Object.entries(FEELING_META).map(([key, m]) => (
          <span key={key} style={{ ...s.legendItem, color: m.color }}>
            ● {m.label}
          </span>
        ))}
      </div>

      {/* Day detail */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        {dayEntries.length === 0 ? (
          <div style={s.empty}>No entries for this day.</div>
        ) : (
          <div style={s.entryList}>
            {dayEntries.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onDelete={() => handleDelete(entry.id)}
                onEdit={() => setEditingEntry(entry)}
              />
            ))}
          </div>
        )}

      {editingEntry && (
        <EditModal
          entry={editingEntry}
          onSave={handleSaveEdit}
          onCancel={() => setEditingEntry(null)}
        />
      )}
      </div>

      <div style={{ height: 80 }} />
    </div>
  )
}

const SYMPTOM_OPTIONS = [
  { id: 'none',          label: 'None',           emoji: '✅' },
  { id: 'headache',      label: 'Headache',        emoji: '🤕' },
  { id: 'nauseous',      label: 'Nauseous',        emoji: '🤢' },
  { id: 'hunger',        label: 'Hunger',          emoji: '😤' },
  { id: 'brainfog',      label: 'Brain fog',       emoji: '🌫️' },
  { id: 'drymouth',      label: 'Dry mouth',       emoji: '🏜️' },
  { id: 'salt_craving',  label: 'Salt craving',    emoji: '🧂' },
  { id: 'fried_craving', label: 'Fried craving',   emoji: '🍟' },
  { id: 'sweet_craving', label: 'Sweet craving',   emoji: '🍬' },
]

function EntryCard({ entry, onDelete, onEdit }) {
  const meta = entry.feeling ? FEELING_META[entry.feeling] : null
  const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const [showMenu, setShowMenu] = useState(false)

  const taggedTriggers = MANUAL_TRIGGERS.filter(t => entry.manualTriggers?.includes(t.id))
  const symptoms = entry.symptoms?.filter(s => s !== 'none') || []
  const symptomLabels = SYMPTOM_OPTIONS.filter(o => symptoms.includes(o.id))

  return (
    <div style={{ ...s.entryCard, borderColor: meta ? meta.border : '#E2E8F0', background: meta ? meta.bg : '#F8FAFC' }}>
      <div style={s.entryHeader}>
        <div style={s.entryTime}>{time}</div>
        {meta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18 }}>{meta.emoji}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>{meta.label}</span>
          </div>
        )}
        <button style={s.deleteBtn} onClick={() => setShowMenu(!showMenu)}>⋯</button>
      </div>

      {entry.meal && (
        <div style={s.mealRow}>
          <span style={s.mealIcon}>🍽</span>
          <span style={s.mealText}>{entry.meal}</span>
        </div>
      )}

      {taggedTriggers.length > 0 && (
        <div style={s.tagRow}>
          {taggedTriggers.map(t => (
            <span key={t.id} style={s.tag}>{t.label}</span>
          ))}
        </div>
      )}

      {symptomLabels.length > 0 && (
        <div style={s.tagRow}>
          {symptomLabels.map(s => (
            <span key={s.id} style={{ ...s.tag, background: '#F3E8FF', borderColor: '#D8B4FE', color: '#7C3AED' }}>{s.emoji} {s.label}</span>
          ))}
        </div>
      )}

      {entry.bm && (
        <div style={s.bmRow}>
          <span style={s.bmText}>BM: {entry.bm}{entry.bmUrgent ? ' 🚨' : ''}</span>
        </div>
      )}

      {showMenu && (
        <div style={s.menu}>
          <button style={s.menuBtn} onClick={() => { setShowMenu(false); onEdit(); }}>
            ✏️ Edit this entry
          </button>
          <button style={s.menuBtn} onClick={onDelete}>
            🗑 Delete this entry
          </button>
        </div>
      )}
    </div>
  )
}

function EditModal({ entry, onSave, onCancel }) {
  const [date, setDate] = useState(entry.date)
  const [hour, setHour] = useState(new Date(entry.timestamp).getHours())
  const [minute, setMinute] = useState(new Date(entry.timestamp).getMinutes())
  const [feeling, setFeeling] = useState(entry.feeling || '')
  const [meal, setMeal] = useState(entry.meal || '')
  const [symptoms, setSymptoms] = useState(entry.symptoms || [])

  async function handleSave() {
    const dt = new Date(date + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00')
    await onSave(entry.id, {
      timestamp: dt.getTime(),
      date: toDateString(dt),
      hour: dt.getHours(),
      feeling,
      meal: meal.trim() || null,
      symptoms,
    })
  }

  const SYMPTOM_OPTIONS = [
    { id: 'none', label: 'None', emoji: '✅' },
    { id: 'headache', label: 'Headache', emoji: '🤕' },
    { id: 'nauseous', label: 'Nauseous', emoji: '🤢' },
    { id: 'hunger', label: 'Hunger', emoji: '😤' },
    { id: 'brainfog', label: 'Brain fog', emoji: '🌫️' },
    { id: 'drymouth', label: 'Dry mouth', emoji: '🏜️' },
    { id: 'salt_craving', label: 'Salt craving', emoji: '🧂' },
    { id: 'fried_craving', label: 'Fried craving', emoji: '🍟' },
    { id: 'sweet_craving', label: 'Sweet craving', emoji: '🍬' },
  ]

  function toggleSymptom(id) {
    if (id === 'none') {
      setSymptoms(['none'])
    } else {
      setSymptoms(prev => {
        const without = prev.filter(s => s !== 'none')
        return without.includes(id) ? without.filter(s => s !== id) : [...without, id]
      })
    }
  }

  return (
    <div style={s.modalOverlay} onClick={onCancel}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Edit Entry</h2>
          <button style={s.modalClose} onClick={onCancel}>✕</button>
        </div>

        <div style={s.modalBody}>
          <div style={s.modalRow2}>
            <div style={s.modalSection}>
              <label style={s.label}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={s.smallInput} />
            </div>
            <div style={s.modalSection}>
              <label style={s.label}>Hour</label>
              <input type="number" min="0" max="23" value={hour} onChange={e => setHour(parseInt(e.target.value) || 0)} style={s.smallInput} />
            </div>
            <div style={s.modalSection}>
              <label style={s.label}>Min</label>
              <input type="number" min="0" max="59" value={minute} onChange={e => setMinute(parseInt(e.target.value) || 0)} style={s.smallInput} />
            </div>
          </div>

          <div style={s.modalSection}>
            <label style={s.label}>Feeling</label>
            <select value={feeling} onChange={e => setFeeling(e.target.value)} style={s.input}>
              <option value="">— No feeling logged —</option>
              {Object.entries(FEELING_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.emoji} {meta.label}</option>
              ))}
            </select>
          </div>

          <div style={s.modalSection}>
            <label style={s.label}>Meal / Food</label>
            <textarea value={meal} onChange={e => setMeal(e.target.value)} style={{...s.input, minHeight: '80px', resize: 'vertical'}} placeholder="What did you eat?" />
          </div>

          <div style={s.modalSection}>
            <label style={s.label}>Symptoms</label>
            <div style={s.symptomGrid}>
              {SYMPTOM_OPTIONS.map(s => {
                const selected = symptoms.includes(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSymptom(s.id)}
                    style={{
                      ...s.symptomBtn,
                      background: selected ? '#EEF2FF' : '#F8FAFC',
                      borderColor: selected ? '#6366F1' : '#E2E8F0',
                      color: selected ? '#4338CA' : '#374151',
                      fontWeight: selected ? 700 : 400,
                    }}
                  >
                    {s.emoji} {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div style={s.modalFooter}>
          <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={s.saveBtn} onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  wrap: { padding: '24px 20px', maxWidth: 480, margin: '0 auto' },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 20 },
  calendarWrap: { background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: '16px', marginBottom: 12 },
  weekLabels: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 },
  weekLabel: { textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' },
  calGrid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 },
  calDay: {
    aspectRatio: '1',
    border: '1px solid',
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.1s',
  },
  calDayNum: { fontSize: 13 },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 20, fontSize: 11 },
  legendItem: { fontWeight: 500 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 12 },
  empty: { fontSize: 14, color: '#94A3B8', padding: '20px 0', textAlign: 'center' },
  entryList: { display: 'flex', flexDirection: 'column', gap: 10 },
  entryCard: { border: '1.5px solid', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' },
  entryHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  entryTime: { fontSize: 12, color: '#94A3B8', fontWeight: 500, marginRight: 'auto' },
  deleteBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#CBD5E1', padding: '0 4px', marginLeft: 'auto' },
  mealRow: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  mealIcon: { fontSize: 14, flexShrink: 0, marginTop: 1 },
  mealText: { fontSize: 13, color: '#374151', lineHeight: 1.5 },
  bmRow: { fontSize: 13, color: '#374151', fontWeight: 500 },
  bmText: { fontSize: 12 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tag: { fontSize: 11, background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: 20, padding: '2px 9px', fontWeight: 500 },
  menu: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 },
  menuBtn: { padding: '8px 10px', background: '#F8FAFC', color: '#374151', border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, textAlign: 'left', transition: 'all 0.15s' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' },
  modal: { background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px rgba(0,0,0,0.15)' },
  modalHeader: { padding: '20px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, background: '#fff', zIndex: 1 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 },
  modalClose: { background: 'none', border: 'none', fontSize: 20, color: '#94A3B8', cursor: 'pointer', padding: '0 4px' },
  modalBody: { padding: '20px' },
  modalSection: { marginBottom: 16 },
  modalRow2: { display: 'flex', gap: 8 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' },
  smallInput: { width: '100%', padding: '8px 10px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' },
  symptomGrid: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  symptomBtn: { padding: '6px 10px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', transition: 'all 0.15s' },
  modalFooter: { padding: '16px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', position: 'sticky', bottom: 0, background: '#fff', zIndex: 1 },
  cancelBtn: { padding: '10px 16px', background: 'transparent', color: '#94A3B8', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 },
  saveBtn: { padding: '10px 16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 },
}
