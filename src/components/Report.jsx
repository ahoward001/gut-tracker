import { useState, useEffect, useRef } from 'react'
import { getEntriesForLastNDays, FEELING_META } from '../db'
import { MANUAL_TRIGGERS } from './CheckIn'

// ── SVG Line Chart ─────────────────────────────────────────────────────────────
// Shows every feeling check-in as a point on a line (good=top, destruction=bottom)
// with tagged triggers displayed as pills below each point.

function SymptomLineChart({ entries }) {
  const containerRef = useRef(null)
  const [width, setWidth] = useState(340)

  useEffect(() => {
    function measure() {
      if (containerRef.current) setWidth(containerRef.current.offsetWidth)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const feelingEntries = entries
    .filter(e => e.feeling)
    .sort((a, b) => a.timestamp - b.timestamp)

  if (feelingEntries.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: 13 }}>
        Log at least 2 check-ins to see the chart.
      </div>
    )
  }

  const SCORE = { good: 0, uncomfortable: 1, bloated: 2, pain: 3, destruction: 4 }
  const COLORS = {
    good: '#16A34A', uncomfortable: '#D97706', bloated: '#EA580C',
    pain: '#DC2626', destruction: '#7C3AED'
  }

  // Chart geometry
  const W = width
  const PAD_LEFT = 28
  const PAD_RIGHT = 12
  const PAD_TOP = 18
  const LINE_H = 90           // height of the feeling line area
  const TRIGGER_H = 60        // height reserved below for trigger pills
  const TOTAL_H = PAD_TOP + LINE_H + TRIGGER_H + 8

  const n = feelingEntries.length
  const colW = (W - PAD_LEFT - PAD_RIGHT) / Math.max(n - 1, 1)

  // Point coords (y inverted: score 0 = top, 4 = bottom)
  const pts = feelingEntries.map((e, i) => ({
    x: n === 1 ? PAD_LEFT + (W - PAD_LEFT - PAD_RIGHT) / 2 : PAD_LEFT + i * colW,
    y: PAD_TOP + (SCORE[e.feeling] / 4) * LINE_H,
    feeling: e.feeling,
    score: SCORE[e.feeling],
    color: COLORS[e.feeling],
    entry: e,
  }))

  // Polyline path
  const polyline = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // Shaded area under the line (fill to bottom of LINE area)
  const areaPath = [
    `M${pts[0].x.toFixed(1)},${(PAD_TOP + LINE_H).toFixed(1)}`,
    ...pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L${pts[pts.length-1].x.toFixed(1)},${(PAD_TOP + LINE_H).toFixed(1)}`,
    'Z'
  ].join(' ')

  // Trigger pill layout: we stagger two rows if needed
  const PILL_W = 44
  const PILL_H = 14
  const PILL_R = 7

  // Y-axis labels
  const yLabels = [
    { score: 0, label: '😊', y: PAD_TOP },
    { score: 2, label: '😮‍💨', y: PAD_TOP + LINE_H / 2 },
    { score: 4, label: '💀', y: PAD_TOP + LINE_H },
  ]

  // X-axis date labels — show date + slot abbreviated
  function slotAbbr(slot) {
    return { wake: '7a', morning: '9a', lunch: '1p', afternoon: '5p', evening: '9p', manual: '•' }[slot] || '•'
  }
  function dateAbbr(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
  }

  return (
    <div ref={containerRef} style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        width={Math.max(W, n * 48 + PAD_LEFT + PAD_RIGHT)}
        height={TOTAL_H}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Y-axis labels */}
        {yLabels.map(({ label, y }) => (
          <text key={label} x={PAD_LEFT - 4} y={y + 5} textAnchor="end" fontSize={11} fill="#CBD5E1">{label}</text>
        ))}

        {/* Horizontal guide lines */}
        {yLabels.map(({ y }) => (
          <line key={y} x1={PAD_LEFT} y1={y} x2={W - PAD_RIGHT} y2={y} stroke="#F1F5F9" strokeWidth={1} />
        ))}

        {/* Shaded area */}
        <path d={areaPath} fill="url(#areaGrad)" opacity={0.25} />
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>
        </defs>

        {/* Line */}
        <path d={polyline} fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Points */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={6} fill={p.color} stroke="#fff" strokeWidth={2} />
        ))}

        {/* X-axis labels: date and slot time */}
        {pts.map((p, i) => {
          const e = p.entry
          const d = dateAbbr(e.timestamp)
          const sl = slotAbbr(e.slot)
          return (
            <g key={'xl-' + i}>
              <text x={p.x} y={PAD_TOP + LINE_H + 14} textAnchor="middle" fontSize={9} fill="#94A3B8">{sl}</text>
              {/* Show date only when it changes */}
              {(i === 0 || dateAbbr(pts[i-1].entry.timestamp) !== d) && (
                <text x={p.x} y={PAD_TOP + LINE_H + 24} textAnchor="middle" fontSize={9} fontWeight="600" fill="#64748B">{d}</text>
              )}
            </g>
          )
        })}

        {/* Trigger pills below each point */}
        {pts.map((p, i) => {
          const tags = p.entry.manualTriggers || []
          if (!tags.length) return null
          const triggers = MANUAL_TRIGGERS.filter(t => tags.includes(t.id))
          // Stack pills vertically below the x-axis labels
          return (
            <g key={'tp-' + i}>
              {triggers.slice(0, 3).map((t, ti) => {
                const pillY = PAD_TOP + LINE_H + 32 + ti * 16
                const pillX = p.x - PILL_W / 2
                const shortLabel = t.label.replace(/^[^\s]+ /, '').slice(0, 7)
                return (
                  <g key={t.id}>
                    <rect x={pillX} y={pillY} width={PILL_W} height={PILL_H} rx={PILL_R} fill="#EEF2FF" />
                    <text x={p.x} y={pillY + PILL_H - 3} textAnchor="middle" fontSize={8} fill="#4338CA" fontWeight="600">{shortLabel}</text>
                  </g>
                )
              })}
              {triggers.length > 3 && (
                <text x={p.x} y={PAD_TOP + LINE_H + 32 + 3 * 16 + PILL_H - 3} textAnchor="middle" fontSize={8} fill="#94A3B8">+{triggers.length - 3}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
// ──────────────────────────────────────────────────────────────────────────────

export default function Report({ refreshKey }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [range, setRange] = useState(7)

  useEffect(() => { load() }, [refreshKey, range])

  async function load() {
    setLoading(true)
    const data = await getEntriesForLastNDays(range)
    setEntries(data)
    setLoading(false)
  }

  const feelingEntries = entries.filter(e => e.feeling)
  const mealEntries = entries.filter(e => e.meal)

  // Feeling distribution
  const feelingCounts = {}
  for (const e of feelingEntries) {
    feelingCounts[e.feeling] = (feelingCounts[e.feeling] || 0) + 1
  }

  // Trigger frequency
  const triggerCounts = {}
  for (const e of entries) {
    for (const t of (e.manualTriggers || [])) {
      triggerCounts[t] = (triggerCounts[t] || 0) + 1
    }
  }
  const topTriggers = Object.entries(triggerCounts).sort(([, a], [, b]) => b - a)

  // Simple co-occurrence: for each trigger, what % of check-ins after that meal were bad (pain or destruction)?
  const triggerOutcomes = computeTriggerOutcomes(entries)

  // Average symptom score
  const scoreMap = { good: 0, uncomfortable: 1, bloated: 2, pain: 3, destruction: 4 }
  const avgScore = feelingEntries.length
    ? feelingEntries.reduce((s, e) => s + (scoreMap[e.feeling] ?? 0), 0) / feelingEntries.length
    : null

  const bestDays = getDayAverages(entries, scoreMap).sort((a, b) => a.avg - b.avg).slice(0, 2)
  const worstDays = getDayAverages(entries, scoreMap).sort((a, b) => b.avg - a.avg).slice(0, 2)

  // Export text for Claude analysis
  const exportText = buildExportText(entries, range)

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(exportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // fallback: show text in a modal or alert
      alert('Copy the text below:\n\n' + exportText)
    }
  }

  if (loading) return <div style={s.loading}>Loading…</div>

  if (feelingEntries.length < 3) {
    return (
      <div style={s.wrap}>
        <div style={s.pageTitle}>Weekly Report</div>
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>📊</div>
          <div style={s.emptyTitle}>Not enough data yet</div>
          <div style={s.emptySub}>Log at least 3 check-ins to start seeing patterns. Your data is building — keep going.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.pageTitle}>Report</div>

      {/* Range selector */}
      <div style={s.rangeRow}>
        {[7, 14, 30].map(n => (
          <button
            key={n}
            style={{ ...s.rangeBtn, background: range === n ? '#4F46E5' : '#F1F5F9', color: range === n ? '#fff' : '#64748B' }}
            onClick={() => setRange(n)}
          >
            {n}d
          </button>
        ))}
      </div>

      {/* Summary bar */}
      <div style={s.summaryCard}>
        <div style={s.summaryItem}>
          <div style={s.summaryNum}>{feelingEntries.length}</div>
          <div style={s.summaryLabel}>Check-ins</div>
        </div>
        <div style={s.summaryDivider} />
        <div style={s.summaryItem}>
          <div style={s.summaryNum}>{mealEntries.length}</div>
          <div style={s.summaryLabel}>Meals logged</div>
        </div>
        <div style={s.summaryDivider} />
        <div style={s.summaryItem}>
          <div style={{ ...s.summaryNum, color: avgScore !== null ? scoreToColor(avgScore) : '#94A3B8' }}>
            {avgScore !== null ? avgScore.toFixed(1) : '—'}
          </div>
          <div style={s.summaryLabel}>Avg severity</div>
        </div>
      </div>

      {/* Symptom line chart */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Symptom Timeline</div>
        <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: '16px 12px 10px' }}>
          <SymptomLineChart entries={entries} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 8, paddingLeft: 28 }}>
            {Object.entries(FEELING_META).map(([k, m]) => (
              <span key={k} style={{ fontSize: 10, color: m.color, fontWeight: 600 }}>{m.emoji} {m.label}</span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 6, paddingLeft: 4 }}>
          Each dot = one check-in. Trigger tags shown below the line at each point.
        </div>
      </div>

      {/* How you've felt */}
      <div style={s.section}>
        <div style={s.sectionTitle}>How You've Felt</div>
        <div style={s.feelBar}>
          {Object.entries(FEELING_META).map(([key, meta]) => {
            const count = feelingCounts[key] || 0
            const pct = feelingEntries.length ? (count / feelingEntries.length) * 100 : 0
            if (pct === 0) return null
            return (
              <div key={key} title={`${meta.label}: ${count}`} style={{ ...s.feelSegment, width: `${pct}%`, background: meta.color }} />
            )
          })}
        </div>
        <div style={s.feelLegend}>
          {Object.entries(FEELING_META).map(([key, meta]) => {
            const count = feelingCounts[key] || 0
            if (!count) return null
            return (
              <div key={key} style={s.feelLegendItem}>
                <span style={{ color: meta.color, fontWeight: 700 }}>{meta.emoji} {meta.label}</span>
                <span style={s.feelCount}>{count}×</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Trigger frequency */}
      {topTriggers.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Triggers You Tagged</div>
          {topTriggers.map(([triggerId, count]) => {
            const t = MANUAL_TRIGGERS.find(x => x.id === triggerId)
            if (!t) return null
            const pct = (count / (topTriggers[0][1])) * 100
            const outcome = triggerOutcomes[triggerId]
            return (
              <div key={triggerId} style={s.triggerRow}>
                <div style={s.triggerInfo}>
                  <span style={s.triggerName}>{t.label}</span>
                  <span style={s.triggerCount}>{count} meal{count > 1 ? 's' : ''}</span>
                </div>
                <div style={s.triggerTrack}>
                  <div style={{ ...s.triggerFill, width: `${pct}%` }} />
                </div>
                {outcome !== null && outcome > 0 && (
                  <div style={{ ...s.outcomeTag, color: outcome > 0.5 ? '#DC2626' : '#D97706', background: outcome > 0.5 ? '#FEF2F2' : '#FFFBEB' }}>
                    {Math.round(outcome * 100)}% bad outcomes
                  </div>
                )}
              </div>
            )
          })}
          <div style={s.outcomeNote}>
            "Bad outcomes" = pain or destruction within 8h of that tagged food
          </div>
        </div>
      )}

      {/* Best / Worst days */}
      {(bestDays.length > 0 || worstDays.length > 0) && (
        <div style={s.daysRow}>
          {bestDays.length > 0 && (
            <div style={{ ...s.dayCard, borderColor: '#86EFAC', background: '#F0FDF4' }}>
              <div style={s.dayCardTitle}>😊 Best Days</div>
              {bestDays.map(d => (
                <div key={d.date} style={s.dayCardDate}>
                  {new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              ))}
            </div>
          )}
          {worstDays.length > 0 && (
            <div style={{ ...s.dayCard, borderColor: '#FCA5A5', background: '#FEF2F2' }}>
              <div style={s.dayCardTitle}>💀 Worst Days</div>
              {worstDays.map(d => (
                <div key={d.date} style={s.dayCardDate}>
                  {new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Claude Analysis Export */}
      <div style={s.claudeCard}>
        <div style={s.claudeHeader}>
          <div style={s.claudeIcon}>🤖</div>
          <div>
            <div style={s.claudeTitle}>Get Claude's Analysis</div>
            <div style={s.claudeSub}>Copy your data below and paste it into a new Cowork session. Claude will analyze your patterns and flag the most likely culprits.</div>
          </div>
        </div>
        <pre style={s.exportPreview}>{exportText.slice(0, 400)}…</pre>
        <button style={{ ...s.copyBtn, background: copied ? '#16A34A' : '#4F46E5' }} onClick={copyToClipboard}>
          {copied ? '✓ Copied to clipboard!' : '📋 Copy full report for Claude'}
        </button>
      </div>

      <div style={{ height: 80 }} />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDayAverages(entries, scoreMap) {
  const byDate = {}
  for (const e of entries) {
    if (!e.feeling) continue
    if (!byDate[e.date]) byDate[e.date] = []
    byDate[e.date].push(scoreMap[e.feeling] ?? 0)
  }
  return Object.entries(byDate).map(([date, scores]) => ({
    date,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length
  }))
}

function computeTriggerOutcomes(entries) {
  // For each trigger, look at check-ins within 8h AFTER a meal containing that trigger.
  // Bad = pain (3) or destruction (4).
  const outcomes = {}
  for (const t of MANUAL_TRIGGERS) outcomes[t.id] = null

  const mealEntries = entries.filter(e => e.meal && e.manualTriggers?.length)
  const feelEntries = entries.filter(e => e.feeling)
  const scoreMap = { good: 0, uncomfortable: 1, bloated: 2, pain: 3, destruction: 4 }

  for (const t of MANUAL_TRIGGERS) {
    const triggeredMeals = mealEntries.filter(m => m.manualTriggers.includes(t.id))
    if (triggeredMeals.length < 2) { outcomes[t.id] = null; continue }

    let badCount = 0, totalCount = 0
    for (const meal of triggeredMeals) {
      const after = feelEntries.filter(f => f.timestamp > meal.timestamp && f.timestamp < meal.timestamp + 8 * 3600 * 1000)
      for (const f of after) {
        totalCount++
        if ((scoreMap[f.feeling] ?? 0) >= 3) badCount++
      }
    }
    outcomes[t.id] = totalCount > 0 ? badCount / totalCount : null
  }
  return outcomes
}

function buildExportText(entries, rangeDays) {
  const lines = []
  const now = new Date()
  lines.push(`=== GUT TRACKER — ${rangeDays}-DAY ANALYSIS REQUEST ===`)
  lines.push(`Exported: ${now.toDateString()}`)
  lines.push(`Check-ins: ${entries.filter(e => e.feeling).length} | Meals logged: ${entries.filter(e => e.meal).length}`)
  lines.push('')
  lines.push('TRIGGER KEY: wheat=gluten (note: may also be FODMAP), dairy, garlic_onion=FODMAP, coffee=caffeine, wine/beer/bourbon=alcohol, spicy, fried_fatty')
  lines.push('')

  const byDate = {}
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = []
    byDate[e.date].push(e)
  }

  lines.push('--- DAILY LOG ---')
  for (const [date, dayEntries] of Object.entries(byDate).sort()) {
    lines.push(`\n${date} (${new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' })})`)
    for (const e of dayEntries.sort((a, b) => a.timestamp - b.timestamp)) {
      const t = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      if (e.feeling) lines.push(`  ${t} → FEELING: ${e.feeling.toUpperCase()}`)
      if (e.meal) {
        lines.push(`  ${t} → ATE: ${e.meal}`)
        if (e.manualTriggers?.length) {
          lines.push(`         TAGGED TRIGGERS: ${e.manualTriggers.join(', ')}`)
        }
      }
    }
  }

  lines.push('\n--- PLEASE ANALYZE ---')
  lines.push(`Based on ${rangeDays} days of data above, please:`)
  lines.push('1. Identify which triggers most consistently precede bad symptoms (pain/destruction), considering timing.')
  lines.push('2. Note any combinations that seem worse than individual triggers alone.')
  lines.push('3. Distinguish between gluten vs FODMAP if wheat keeps appearing — is garlic/onion (pure FODMAP) also correlating?')
  lines.push('4. Identify any time-of-day or day-of-week patterns.')
  lines.push('5. Give a ranked list of what I should try eliminating first, with reasoning.')
  lines.push('6. Flag anything unusual or worth investigating.')

  return lines.join('\n')
}

function scoreToColor(avg) {
  if (avg < 0.5) return '#16A34A'
  if (avg < 1.5) return '#D97706'
  if (avg < 2.5) return '#EA580C'
  if (avg < 3.5) return '#DC2626'
  return '#7C3AED'
}

const s = {
  wrap: { padding: '24px 20px', maxWidth: 480, margin: '0 auto' },
  loading: { padding: 40, textAlign: 'center', color: '#94A3B8' },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 20 },
  rangeRow: { display: 'flex', gap: 8, marginBottom: 20 },
  rangeBtn: { padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s' },
  summaryCard: { background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: '16px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: 24 },
  summaryItem: { textAlign: 'center' },
  summaryNum: { fontSize: 26, fontWeight: 800, color: '#0F172A' },
  summaryLabel: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  summaryDivider: { width: 1, height: 40, background: '#E2E8F0' },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  feelBar: { height: 12, borderRadius: 8, overflow: 'hidden', display: 'flex', marginBottom: 12 },
  feelSegment: { height: '100%', transition: 'width 0.3s' },
  feelLegend: { display: 'flex', flexDirection: 'column', gap: 6 },
  feelLegendItem: { display: 'flex', justifyContent: 'space-between', fontSize: 14 },
  feelCount: { color: '#94A3B8', fontWeight: 500 },
  triggerRow: { marginBottom: 14 },
  triggerInfo: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  triggerName: { fontSize: 14, fontWeight: 500, color: '#374151' },
  triggerCount: { fontSize: 12, color: '#94A3B8' },
  triggerTrack: { height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  triggerFill: { height: '100%', background: '#4F46E5', borderRadius: 4, transition: 'width 0.3s' },
  outcomeTag: { display: 'inline-block', fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '2px 8px' },
  outcomeNote: { fontSize: 11, color: '#CBD5E1', marginTop: 8 },
  daysRow: { display: 'flex', gap: 12, marginBottom: 24 },
  dayCard: { flex: 1, border: '1.5px solid', borderRadius: 14, padding: '14px' },
  dayCardTitle: { fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 },
  dayCardDate: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  claudeCard: { background: '#F5F3FF', border: '1.5px solid #DDD6FE', borderRadius: 16, padding: '18px', marginBottom: 24 },
  claudeHeader: { display: 'flex', gap: 12, marginBottom: 14 },
  claudeIcon: { fontSize: 28, flexShrink: 0 },
  claudeTitle: { fontSize: 15, fontWeight: 700, color: '#4C1D95', marginBottom: 4 },
  claudeSub: { fontSize: 13, color: '#6D28D9', lineHeight: 1.4 },
  exportPreview: { background: '#EDE9FE', borderRadius: 10, padding: '12px', fontSize: 11, color: '#5B21B6', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 120, overflow: 'hidden', marginBottom: 14, fontFamily: 'monospace', lineHeight: 1.4 },
  copyBtn: { width: '100%', padding: '14px', border: 'none', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' },
  emptyState: { textAlign: 'center', padding: '40px 20px' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#94A3B8', lineHeight: 1.5 },
}
