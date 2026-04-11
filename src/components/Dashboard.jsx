import { useState, useEffect } from 'react'
import { getEntriesForDate, getEntriesForLastNDays, toDateString, FEELING_META, CHECK_IN_SLOTS, getMissedSlots } from '../db'
import { TRIGGER_LABELS, TRIGGER_COLORS } from '../foodAnalyzer'

export default function Dashboard({ onCheckIn, refreshKey }) {
  const [todayEntries, setTodayEntries] = useState([])
  const [weekEntries, setWeekEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [refreshKey])

  async function load() {
    setLoading(true)
    const today = toDateString(new Date())
    const [todays, week] = await Promise.all([
      getEntriesForDate(today),
      getEntriesForLastNDays(7)
    ])
    setTodayEntries(todays)
    setWeekEntries(week)
    setLoading(false)
  }

  const missed = getMissedSlots(todayEntries)
  const todayFeelings = todayEntries.filter(e => e.feeling)
  const todayMeals = todayEntries.filter(e => e.meal)

  // Streak calculation
  const streak = computeStreak(weekEntries)

  // Week mini-chart data
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return toDateString(d)
  })

  const avgByDay = weekDays.map(date => {
    const dayEntries = weekEntries.filter(e => e.date === date && e.feeling)
    if (!dayEntries.length) return null
    const scoreMap = { good: 0, uncomfortable: 1, bloated: 2, pain: 3, destruction: 4 }
    const avg = dayEntries.reduce((s, e) => s + (scoreMap[e.feeling] ?? 0), 0) / dayEntries.length
    return avg
  })

  return (
    <div style={styles.wrap}>
      {/* Greeting */}
      <div style={styles.greeting}>
        <div>
          <div style={styles.greetingText}>{getGreeting()}</div>
          <div style={styles.dateText}>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        {streak > 1 && (
          <div style={styles.streakBadge}>
            <span style={styles.streakFire}>🔥</span>
            <span style={styles.streakNum}>{streak}</span>
          </div>
        )}
      </div>

      {/* Missed check-ins */}
      {missed.length > 0 && (
        <div style={styles.missedCard}>
          <div style={styles.missedIcon}>⏰</div>
          <div style={{ flex: 1 }}>
            <div style={styles.missedTitle}>Pending check-in{missed.length > 1 ? 's' : ''}</div>
            <div style={styles.missedSub}>{missed.map(s => s.label).join(', ')}</div>
          </div>
          <button style={styles.checkInBtn} onClick={() => onCheckIn(missed[0])}>
            Log now
          </button>
        </div>
      )}

      {/* Quick check-in if nothing missed but user wants to log */}
      {missed.length === 0 && (
        <button style={styles.manualCheckIn} onClick={() => onCheckIn(null)}>
          + Log how I'm feeling
        </button>
      )}

      {/* Today timeline */}
      {todayEntries.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Today's Log</div>
          <div style={styles.timeline}>
            {[...todayEntries].reverse().map((entry, i) => (
              <TimelineEntry key={entry.id} entry={entry} isLast={i === 0} />
            ))}
          </div>
        </div>
      )}

      {/* Week chart */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>This Week</div>
        <div style={styles.weekChart}>
          {weekDays.map((date, i) => {
            const score = avgByDay[i]
            const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })
            const barColor = score === null ? '#E2E8F0' : scoreToColor(score)
            const barHeight = score === null ? 8 : Math.max(12, (score / 4) * 64)
            return (
              <div key={date} style={styles.chartBar}>
                <div style={styles.barTrack}>
                  <div style={{ ...styles.barFill, height: barHeight, background: barColor }} />
                </div>
                <div style={styles.dayLabel}>{dayLabel}</div>
              </div>
            )
          })}
        </div>
        <div style={styles.chartLegend}>
          <span style={{ color: '#16A34A' }}>● Good</span>
          <span style={{ color: '#D97706' }}>● Uncomfortable</span>
          <span style={{ color: '#C2410C' }}>● Bloated</span>
          <span style={{ color: '#DC2626' }}>● Pain</span>
          <span style={{ color: '#7C3AED' }}>● Destruction</span>
        </div>
      </div>

      {/* Top triggers this week */}
      <WeeklyTriggers entries={weekEntries} />

      <div style={{ height: 80 }} />
    </div>
  )
}

function TimelineEntry({ entry, isLast }) {
  const meta = entry.feeling ? FEELING_META[entry.feeling] : null
  const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={styles.timelineRow}>
      <div style={styles.timelineLeft}>
        <div style={styles.timelineTime}>{time}</div>
        <div style={{ ...styles.timelineDot, background: meta ? meta.color : '#94A3B8' }} />
        {!isLast && <div style={styles.timelineLine} />}
      </div>
      <div style={{ ...styles.timelineCard, background: meta ? meta.bg : '#F8FAFC', borderColor: meta ? meta.border : '#E2E8F0' }}>
        {entry.feeling && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{meta.emoji}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: meta.color }}>{meta.label}</span>
          </div>
        )}
        {entry.meal && (
          <div style={styles.mealText}>🍽 {entry.meal}</div>
        )}
        {entry.analysis?.topTriggers?.length > 0 && (
          <div style={styles.triggerPills}>
            {entry.analysis.topTriggers.map(t => (
              <span key={t.trigger} style={{ ...styles.triggerPill, background: TRIGGER_COLORS[t.trigger] + '22', color: TRIGGER_COLORS[t.trigger], borderColor: TRIGGER_COLORS[t.trigger] + '44' }}>
                {t.label} {t.score.toFixed(1)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WeeklyTriggers({ entries }) {
  const mealEntries = entries.filter(e => e.analysis?.scores)
  if (mealEntries.length === 0) return null

  const totals = {}
  for (const entry of mealEntries) {
    for (const [trigger, score] of Object.entries(entry.analysis.scores)) {
      totals[trigger] = (totals[trigger] || 0) + score
    }
  }

  const top = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  if (top.length === 0) return null

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Most Consumed This Week</div>
      <div style={styles.triggerBars}>
        {top.map(([trigger, total]) => {
          const max = top[0][1]
          const pct = (total / max) * 100
          return (
            <div key={trigger} style={styles.triggerBarRow}>
              <div style={styles.triggerBarLabel}>{TRIGGER_LABELS[trigger]}</div>
              <div style={styles.triggerBarTrack}>
                <div style={{ ...styles.triggerBarFill, width: `${pct}%`, background: TRIGGER_COLORS[trigger] }} />
              </div>
              <div style={styles.triggerBarVal}>{total.toFixed(1)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function computeStreak(entries) {
  const days = new Set(entries.filter(e => e.feeling).map(e => e.date))
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 30; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    if (days.has(toDateString(d))) streak++
    else break
  }
  return streak
}

function scoreToColor(score) {
  if (score < 0.5) return '#16A34A'
  if (score < 1.5) return '#D97706'
  if (score < 2.5) return '#EA580C'
  if (score < 3.5) return '#DC2626'
  return '#7C3AED'
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning 👋'
  if (h < 17) return 'Good afternoon 👋'
  return 'Good evening 👋'
}

const styles = {
  wrap: { padding: '24px 20px', maxWidth: 480, margin: '0 auto' },
  greeting: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greetingText: { fontSize: 22, fontWeight: 800, color: '#0F172A' },
  dateText: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  streakBadge: { background: '#FFF7ED', border: '2px solid #FED7AA', borderRadius: 20, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 },
  streakFire: { fontSize: 18 },
  streakNum: { fontSize: 16, fontWeight: 800, color: '#EA580C' },
  missedCard: { background: '#EEF2FF', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, border: '1px solid #C7D2FE' },
  missedIcon: { fontSize: 22 },
  missedTitle: { fontSize: 14, fontWeight: 700, color: '#3730A3' },
  missedSub: { fontSize: 12, color: '#6366F1', marginTop: 2 },
  checkInBtn: { background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  manualCheckIn: { width: '100%', marginBottom: 20, padding: '14px', background: '#F8FAFC', border: '2px dashed #CBD5E1', borderRadius: 14, fontSize: 15, fontWeight: 600, color: '#64748B', cursor: 'pointer', fontFamily: 'inherit' },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  timeline: { display: 'flex', flexDirection: 'column' },
  timelineRow: { display: 'flex', gap: 12, marginBottom: 8 },
  timelineLeft: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: 52, flexShrink: 0 },
  timelineTime: { fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 6, whiteSpace: 'nowrap' },
  timelineDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  timelineLine: { width: 2, flex: 1, background: '#E2E8F0', marginTop: 4, minHeight: 20 },
  timelineCard: { flex: 1, border: '1.5px solid', borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 },
  mealText: { fontSize: 13, color: '#374151', lineHeight: 1.4 },
  triggerPills: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  triggerPill: { fontSize: 11, fontWeight: 600, border: '1px solid', borderRadius: 20, padding: '2px 8px' },
  weekChart: { display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 },
  chartBar: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  barTrack: { width: '100%', height: 64, background: '#F1F5F9', borderRadius: 6, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 6, transition: 'height 0.4s ease' },
  dayLabel: { fontSize: 11, color: '#94A3B8', fontWeight: 500 },
  chartLegend: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8, fontSize: 11, color: '#94A3B8' },
  triggerBars: { display: 'flex', flexDirection: 'column', gap: 10 },
  triggerBarRow: { display: 'flex', alignItems: 'center', gap: 10 },
  triggerBarLabel: { width: 70, fontSize: 13, fontWeight: 500, color: '#374151', flexShrink: 0 },
  triggerBarTrack: { flex: 1, height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  triggerBarFill: { height: '100%', borderRadius: 4, transition: 'width 0.4s ease' },
  triggerBarVal: { width: 32, fontSize: 12, color: '#94A3B8', textAlign: 'right' },
}
