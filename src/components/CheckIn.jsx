import { useState } from 'react'
import { FEELING_META, CHECK_IN_SLOTS, getSlotForHour } from '../db'

// Manual trigger tags
export const MANUAL_TRIGGERS = [
  { id: 'wheat',        label: '🌾 Wheat / Gluten' },
  { id: 'dairy',        label: '🥛 Dairy' },
  { id: 'garlic_onion', label: '🧅 Garlic / Onions' },
  { id: 'coffee',       label: '☕ Coffee / Caffeine' },
  { id: 'wine',         label: '🍷 Wine' },
  { id: 'beer',         label: '🍺 Beer' },
  { id: 'bourbon',      label: '🥃 Bourbon / Spirits' },
  { id: 'spicy',        label: '🌶️ Spicy' },
  { id: 'fried_fatty',  label: '🍟 Fried / Heavy' },
]

// BM quality options
const BM_OPTIONS = [
  { id: 'none',        label: 'No poop',     emoji: '💨', color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' },
  { id: 'good',        label: 'Good',        emoji: '💩', color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
  { id: 'bad',         label: 'Bad',         emoji: '💧', color: '#D97706', bg: '#FEF3C7', border: '#FBBF24' },
  { id: 'ugly',        label: 'Ugly',        emoji: '🚨', color: '#DC2626', bg: '#FEF2F2', border: '#DC2626' },
  { id: 'constipated', label: 'Constipated', emoji: '🪨', color: '#6B7280', bg: '#F9FAFB', border: '#D1D5DB' },
]

const WATER_OPTIONS = ['0', '1', '2', '3', '4', '5+']
const DRINK_OPTIONS = ['0', '1', '2', '3', '4+']

const SYMPTOM_OPTIONS = [
  { id: 'none',          label: 'None',           emoji: '✅' },
  { id: 'headache',      label: 'Headache',        emoji: '🤕' },
  { id: 'nauseous',      label: 'Nauseous',        emoji: '🤢' },
  { id: 'hunger',        label: 'Hunger',          emoji: '😤' },
  { id: 'brainfog',      label: 'Brain fog',       emoji: '🌫️' },
  { id: 'drymouth',      label: 'Dry mouth',       emoji: '🏜️' },
  { id: 'heartburn',     label: 'Heartburn',       emoji: '🔥' },
  { id: 'salt_craving',  label: 'Salt craving',    emoji: '🧂' },
  { id: 'fried_craving', label: 'Fried craving',   emoji: '🍟' },
  { id: 'sweet_craving', label: 'Sweet craving',   emoji: '🍬' },
]

export default function CheckIn({ onSave, initialSlot }) {
  const currentSlot = initialSlot || CHECK_IN_SLOTS.find(s => s.id === getSlotForHour(new Date().getHours()))
  const isEvening = currentSlot?.id === 'evening'
  const hasMeal = currentSlot?.hasMeal !== false

  // Build step list dynamically
  const steps = ['feeling']
  if (hasMeal) { steps.push('meal'); steps.push('triggers') }
  steps.push('bm')           // BM in every check-in
  steps.push('symptoms')     // Other symptoms in every check-in
  if (isEvening) { steps.push('water'); steps.push('drinks') }
  steps.push('done')

  const [stepIdx, setStepIdx] = useState(0)
  const step = steps[stepIdx]

  const [feeling, setFeeling] = useState(null)
  const [meal, setMeal] = useState('')
  const [triggers, setTriggers] = useState([])
  const [bmType, setBmType] = useState(null)
  const [bmUrgent, setBmUrgent] = useState(null)
  const [symptoms, setSymptoms] = useState([])
  const [water, setWater] = useState(null)
  const [drinks, setDrinks] = useState(null)
  const [customSymptom, setCustomSymptom] = useState('')
  const [saving, setSaving] = useState(false)
  const [showUrgency, setShowUrgency] = useState(false)

  function next() { setStepIdx(i => i + 1) }
  function back() { setStepIdx(i => Math.max(0, i - 1)) }

  function toggleTrigger(id) {
    setTriggers(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

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

  async function handleFeelingSelect(f) {
    setFeeling(f)
    next()
  }

  function handleBMSelect(type) {
    setBmType(type)
    if (type === 'none') {
      setBmUrgent(null)
      next()
    } else {
      setShowUrgency(true)
    }
  }

  function handleUrgency(urgent) {
    setBmUrgent(urgent)
    setShowUrgency(false)
    next()
  }

  async function commitSave(overrides = {}) {
    setSaving(true)
    try {
      await onSave({
        feeling,
        meal: meal.trim() || null,
        manualTriggers: triggers,
        bm: bmType,
        bmUrgent,
        symptoms,
        customSymptom,
        waterBottles: water,
        alcoholDrinks: drinks,
        slot: currentSlot?.id || 'manual',
        ...overrides,
      })
      setSaving(false)
      next()
    } catch (error) {
      console.error('Failed to save:', error)
      setSaving(false)
    }
  }

  const totalSteps = steps.filter(s => s !== 'done').length
  const slotLabel = { wake: 'Wake-up', morning: 'Morning', lunch: 'Lunch', afternoon: 'Afternoon', evening: 'Evening', manual: '' }[currentSlot?.id] || ''

  if (step === 'done') {
    return (
      <div style={s.doneWrap}>
        <div style={s.doneCircle}>✓</div>
        <div style={s.doneText}>Logged!</div>
        <div style={s.doneSub}>Keep it up — data = answers.</div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.slotBadge}>{slotLabel ? `${slotLabel} Check-in` : 'Check-in'}</div>
        <div style={s.steps}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ ...s.stepDot, background: i < stepIdx ? '#4F46E5' : i === stepIdx ? '#818CF8' : '#E2E8F0' }} />
          ))}
        </div>
      </div>

      {/* ── Step: Feeling ──────────────────────────────────────────────────── */}
      {step === 'feeling' && (
        <>
          <h2 style={s.question}>How are you feeling right now?</h2>
          <div style={s.feelingGrid}>
            {Object.entries(FEELING_META).map(([key, meta]) => (
              <button key={key} style={{ ...s.feelBtn, borderColor: meta.border, background: meta.bg }} onClick={() => handleFeelingSelect(key)}>
                <span style={s.feelEmoji}>{meta.emoji}</span>
                <span style={{ ...s.feelLabel, color: meta.color }}>{meta.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Step: Meal ─────────────────────────────────────────────────────── */}
      {step === 'meal' && (
        <>
          <h2 style={s.question}>What did you last eat or drink?</h2>
          <p style={s.sub}>Be specific — your exact description gets analyzed later by Claude. "Lightly breaded chicken in garlic butter" beats just "chicken".</p>
          <textarea
            style={s.textarea}
            placeholder="e.g. Homemade pasta, garlic butter, cherry tomatoes, parmesan. Glass of red wine."
            value={meal}
            onChange={e => setMeal(e.target.value)}
            rows={5}
            autoFocus
          />
          <div style={s.buttonRow}>
            <button style={s.backBtn} onClick={back}>← Back</button>
            <button style={s.primaryBtn} onClick={next}>Next →</button>
          </div>
          <button style={s.skipBtn} onClick={() => { setMeal(''); next() }}>Skip meal</button>
        </>
      )}

      {/* ── Step: Triggers ─────────────────────────────────────────────────── */}
      {step === 'triggers' && (
        <>
          <h2 style={s.question}>Any suspected triggers?</h2>
          <p style={s.sub}>Select everything you think was in your meal. Multiple is fine.</p>
          <div style={s.triggerGrid}>
            {MANUAL_TRIGGERS.map(({ id, label }) => {
              const selected = triggers.includes(id)
              return (
                <button key={id} style={{ ...s.triggerBtn, background: selected ? '#EEF2FF' : '#F8FAFC', borderColor: selected ? '#6366F1' : '#E2E8F0', color: selected ? '#4338CA' : '#374151', fontWeight: selected ? 700 : 400 }} onClick={() => toggleTrigger(id)}>
                  {label}
                  {selected && <span style={s.checkMark}>✓</span>}
                </button>
              )
            })}
          </div>
          <div style={s.buttonRow}>
            <button style={s.backBtn} onClick={back}>← Back</button>
            <button style={s.primaryBtn} onClick={next}>Next →</button>
          </div>
          <button style={s.skipBtn} onClick={next}>Skip</button>
        </>
      )}

      {/* ── Step: BM ───────────────────────────────────────────────────────── */}
      {step === 'bm' && !showUrgency && (
        <>
          <h2 style={s.question}>Any bowel movements since last check-in?</h2>
          <div style={s.feelingGrid}>
            {BM_OPTIONS.map(({ id, label, emoji, color, bg, border }) => (
              <button key={id} style={{ ...s.feelBtn, borderColor: border, background: bg }} onClick={() => handleBMSelect(id)}>
                <span style={s.feelEmoji}>{emoji}</span>
                <span style={{ ...s.feelLabel, color }}>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Step: BM Urgency (inline sub-step) ─────────────────────────────── */}
      {step === 'bm' && showUrgency && (
        <>
          <h2 style={s.question}>Was it urgent?</h2>
          <p style={s.sub}>Did you have to rush?</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button style={{ ...s.urgencyBtn, background: '#FEF2F2', borderColor: '#FCA5A5', color: '#DC2626' }} onClick={() => handleUrgency(true)}>
              🚨 Yes, urgent
            </button>
            <button style={{ ...s.urgencyBtn, background: '#F0FDF4', borderColor: '#86EFAC', color: '#16A34A' }} onClick={() => handleUrgency(false)}>
              No rush
            </button>
          </div>
          <button style={s.skipBtn} onClick={() => { setShowUrgency(false); setBmType(null) }}>← Back</button>
        </>
      )}

      {/* ── Step: Symptoms ─────────────────────────────────────────────────── */}
      {step === 'symptoms' && (
        <>
          <h2 style={s.question}>Any other symptoms?</h2>
          <p style={s.sub}>Select all that apply right now.</p>
          <div style={s.triggerGrid}>
            {SYMPTOM_OPTIONS.map(({ id, emoji, label }) => {
              const selected = symptoms.includes(id)
              return (
                <button key={id} style={{ ...s.triggerBtn, background: selected ? '#EEF2FF' : '#F8FAFC', borderColor: selected ? '#6366F1' : '#E2E8F0', color: selected ? '#4338CA' : '#374151', fontWeight: selected ? 700 : 400 }} onClick={() => toggleSymptom(id)}>
                  <span>{emoji} {label}</span>
                  {selected && <span style={s.checkMark}>✓</span>}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 20 }}>
            <label style={{ display: 'block', fontSize: 14, color: '#64748B', marginBottom: 8 }}>Other symptoms?</label>
            <input
              type="text"
              placeholder="e.g. Rash, itching, joint pain..."
              value={customSymptom}
              onChange={e => setCustomSymptom(e.target.value)}
              style={s.textarea}
            />
          </div>
          {isEvening ? (
            <>
              <div style={s.buttonRow}>
                <button style={s.backBtn} onClick={back}>← Back</button>
                <button style={s.primaryBtn} onClick={next}>Next →</button>
              </div>
              <button style={s.skipBtn} onClick={next}>Skip</button>
            </>
          ) : (
            <>
              <div style={s.buttonRow}>
                <button style={s.backBtn} onClick={back}>← Back</button>
                <button style={{ ...s.primaryBtn }} onClick={() => commitSave({ symptoms, customSymptom: customSymptom.trim() || null })}>Save →</button>
              </div>
              <button style={s.skipBtn} onClick={() => commitSave({ symptoms: [], customSymptom: null })}>Skip &amp; save</button>
            </>
          )}
        </>
      )}

      {/* ── Step: Water (evening) ──────────────────────────────────────────── */}
      {step === 'water' && (
        <>
          <h2 style={s.question}>💧 Water today?</h2>
          <p style={s.sub}>How many 16–20oz bottles (or equivalent) did you drink today?</p>
          <div style={s.buttonGrid}>
            {WATER_OPTIONS.map(opt => (
              <button key={opt} style={{ ...s.gridBtn, background: water === opt ? '#4F46E5' : '#F8FAFC', color: water === opt ? '#fff' : '#374151', borderColor: water === opt ? '#4F46E5' : '#E2E8F0' }} onClick={() => setWater(opt)}>
                {opt}
              </button>
            ))}
          </div>
          <div style={s.buttonRow}>
            <button style={{ ...s.backBtn, marginTop: 16 }} onClick={back}>← Back</button>
            <button style={{ ...s.primaryBtn, marginTop: 16, opacity: water ? 1 : 0.4 }} onClick={next} disabled={!water}>Next →</button>
          </div>
          <button style={s.skipBtn} onClick={() => { setWater(null); next() }}>Skip</button>
        </>
      )}

      {/* ── Step: Drinks (evening) ─────────────────────────────────────────── */}
      {step === 'drinks' && (
        <>
          <h2 style={s.question}>🍷 Alcoholic drinks today?</h2>
          <p style={s.sub}>Total across the day — wine, beer, spirits, cocktails, etc.</p>
          <div style={s.buttonGrid}>
            {DRINK_OPTIONS.map(opt => (
              <button key={opt} style={{ ...s.gridBtn, background: drinks === opt ? '#4F46E5' : '#F8FAFC', color: drinks === opt ? '#fff' : '#374151', borderColor: drinks === opt ? '#4F46E5' : '#E2E8F0' }} onClick={() => setDrinks(opt)}>
                {opt}
              </button>
            ))}
          </div>
          <div style={s.buttonRow}>
            <button style={{ ...s.backBtn, marginTop: 16 }} onClick={back}>← Back</button>
            <button style={{ ...s.primaryBtn, marginTop: 16, opacity: (drinks !== null && !saving) ? 1 : 0.4 }} onClick={() => commitSave()} disabled={drinks === null || saving}>
              {saving ? 'Saving…' : 'Save Entry →'}
            </button>
          </div>
          <button style={s.skipBtn} onClick={() => commitSave({ alcoholDrinks: null })} disabled={saving}>Skip &amp; save</button>
        </>
      )}

      {/* Final save step for non-evening flows (after BM) */}
      {step === 'bm' && !showUrgency && bmType !== null && !isEvening && (
        // Auto-advances in handleBMSelect — nothing to render here
        null
      )}
    </div>
  )
}

// Intercept: after BM step in non-evening flows, we need to auto-commit.
// This is handled by handleBMSelect → next() which moves stepIdx past 'bm'
// to 'done'. But for non-evening flows, the next step IS 'done', so
// commitSave needs to be called. We handle this by checking in useEffect—
// but since we're functional and next() advances, we call commitSave at the
// right spots above. The evening flows call commitSave at the drinks step.

const s = {
  wrap: { padding: '24px 20px', maxWidth: 480, margin: '0 auto', minHeight: '60vh', display: 'flex', flexDirection: 'column' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  slotBadge: { background: '#EEF2FF', color: '#4338CA', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600 },
  steps: { display: 'flex', gap: 5 },
  stepDot: { width: 8, height: 8, borderRadius: '50%', transition: 'background 0.2s' },
  question: { fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 8, lineHeight: 1.3 },
  sub: { fontSize: 14, color: '#64748B', marginBottom: 18, lineHeight: 1.5 },
  feelingGrid: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  feelBtn: { display: 'flex', alignItems: 'center', gap: 16, padding: '18px 24px', borderRadius: 16, border: '2px solid', cursor: 'pointer', outline: 'none', textAlign: 'left', fontFamily: 'inherit', background: 'none', minHeight: 70, width: '100%', boxSizing: 'border-box' },
  feelEmoji: { fontSize: 28, lineHeight: 1, flexShrink: 0 },
  feelLabel: { fontSize: 18, fontWeight: 700, lineHeight: 1.3 },
  textarea: { width: '100%', padding: '14px 16px', fontSize: 15, borderRadius: 14, border: '2px solid #E2E8F0', fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6, color: '#0F172A', boxSizing: 'border-box' },
  buttonRow: { display: 'flex', gap: 10, marginTop: 14 },
  primaryBtn: { flex: 1, padding: '16px', background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' },
  backBtn: { flex: 0, padding: '16px 12px', background: '#F1F5F9', color: '#64748B', border: '2px solid #E2E8F0', borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  skipBtn: { width: '100%', marginTop: 8, padding: '12px', background: 'transparent', color: '#94A3B8', border: 'none', borderRadius: 14, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  triggerGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  triggerBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: 12, border: '2px solid', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, textAlign: 'left', transition: 'all 0.12s', background: 'none' },
  checkMark: { color: '#4F46E5', fontWeight: 800 },
  urgencyBtn: { flex: 1, padding: '18px 0', border: '2px solid', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  buttonGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 8 },
  gridBtn: { padding: '18px 0', border: '2px solid', borderRadius: 14, fontSize: 22, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s', background: 'none' },
  doneWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: 20, padding: '40px 20px' },
  doneCircle: { width: 80, height: 80, background: '#DCFCE7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#16A34A', fontWeight: 800 },
  doneText: { fontSize: 28, fontWeight: 800, color: '#0F172A' },
  doneSub: { fontSize: 16, color: '#64748B', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 },
}
