// ─────────────────────────────────────────────────────────────────────────────
//  Food Trigger Analyzer
//  Parses free-text meal descriptions and scores them 0–5 per gut trigger.
//  Accounts for:
//    • Trigger intensity (a full bowl of pasta vs. a sprinkle of breadcrumbs)
//    • Quantity modifiers (huge, small, a bit of, extra, etc.)
//    • Negations (no cheese, dairy-free, gluten-free)
//    • Compound dish recognition (pizza → gluten+dairy, Thai curry → spicy+fodmap)
// ─────────────────────────────────────────────────────────────────────────────

// Each trigger has an array of [{pattern, base}] where base is 0–5
const TRIGGER_PATTERNS = {
  gluten: [
    // Very high (5)
    { pattern: /\b(pasta|spaghetti|fettuccine|linguine|penne|rigatoni|lasagna|ravioli|tortellini)\b/, base: 5 },
    { pattern: /\b(bread(?!ed)|bagel|baguette|focaccia|sourdough|rye bread|white bread|whole wheat)\b/, base: 4.5 },
    { pattern: /\b(pizza(?! sauce))\b/, base: 4.5 },
    { pattern: /\b(pancake|waffle|french toast|crepe)\b/, base: 4 },
    { pattern: /\b(flour tortilla|wrap(?! around)|pita(?! chips))\b/, base: 4 },
    { pattern: /\b(muffin|croissant|danish|scone|biscuit(?! gravy))\b/, base: 4 },
    { pattern: /\b(cake|cupcake|brownie|cookie|donut|doughnut)\b/, base: 4 },
    { pattern: /\b(beer|ale|lager|stout|wheat beer)\b/, base: 3.5 },
    { pattern: /\b(ramen|udon|soba|lo mein|chow mein|pad thai noodle)\b/, base: 4 },
    { pattern: /\b(cereal|granola(?! bar))\b/, base: 3.5 },
    { pattern: /\b(cracker|pretzel|graham cracker)\b/, base: 3 },
    // Medium (2–3)
    { pattern: /\bbreaded\b/, base: 2.5 },
    { pattern: /\b(sandwich|sub|hoagie|hero|burger(?! bowl))\b/, base: 3.5 },
    { pattern: /\b(crouton|breadcrumb|panko)\b/, base: 1.5 },
    { pattern: /\b(soy sauce|teriyaki|hoisin|oyster sauce)\b/, base: 1.5 },
    { pattern: /\b(gravy(?! boat))\b/, base: 1.5 },
    { pattern: /\b(flour coating|battered|tempura)\b/, base: 2 },
    { pattern: /\b(quesadilla)\b/, base: 3.5 },
    { pattern: /\b(dumpling|gyoza|potsticker|wonton)\b/, base: 3 },
    // Low (0.5–1.5)
    { pattern: /\blightly breaded\b/, base: 1.5 },
    { pattern: /\ba little (?:flour|breading)\b/, base: 1 },
  ],

  dairy: [
    // Very high
    { pattern: /\b(milk(?! thistle| substitute| alternative| of magnesia)|whole milk|skim milk|2% milk)\b/, base: 4.5 },
    { pattern: /\b(ice cream|gelato|frozen yogurt|soft serve)\b/, base: 4 },
    { pattern: /\b(cream sauce|cream soup|cream of (?:mushroom|chicken)|heavy cream|whipped cream)\b/, base: 4 },
    { pattern: /\b(mac and cheese|macaroni and cheese|cheesy)\b/, base: 4 },
    { pattern: /\b(butter(?:milk)?)\b/, base: 3 },
    { pattern: /\b(yogurt|greek yogurt)\b/, base: 3.5 },
    { pattern: /\b(sour cream|creme fraiche)\b/, base: 3 },
    { pattern: /\b(cream cheese|brie|camembert|ricotta)\b/, base: 3.5 },
    // Medium
    { pattern: /\b(cheese(?!cake| cloth| burger solo))\b/, base: 3 },
    { pattern: /\b(cheddar|mozzarella|provolone|swiss|gouda|havarti|jack cheese)\b/, base: 2.5 },
    { pattern: /\b(parmesan|pecorino|romano)\b/, base: 2 },
    { pattern: /\b(latte|cappuccino|flat white|cortado|chai latte)\b/, base: 2 },
    { pattern: /\b(milkshake|frappe|hot chocolate)\b/, base: 3.5 },
    { pattern: /\b(ranch|caesar dressing|blue cheese dressing)\b/, base: 2 },
    // Low
    { pattern: /\b(a little cheese|splash of milk|touch of butter|drizzle of cream)\b/, base: 1 },
    { pattern: /\b(dairy-free|non-dairy|vegan cheese|plant-based|oat milk|almond milk|soy milk|coconut milk)\b/, base: -5 }, // negation
  ],

  fodmap: [
    // Very high
    { pattern: /\b(garlic(?! powder in trace))\b/, base: 4.5 },
    { pattern: /\b(onion(?! powder in trace)|red onion|white onion|yellow onion)\b/, base: 4.5 },
    { pattern: /\b(beans|black beans|kidney beans|pinto beans|chickpea|lentil|edamame)\b/, base: 4 },
    { pattern: /\b(apple(?! cider vinegar)|pear(?!mesan)|watermelon|mango|cherry|peach|nectarine)\b/, base: 3.5 },
    { pattern: /\b(asparagus)\b/, base: 4 },
    { pattern: /\b(mushroom)\b/, base: 3.5 },
    { pattern: /\b(cauliflower)\b/, base: 3.5 },
    { pattern: /\b(broccoli)\b/, base: 3 },
    { pattern: /\b(cabbage|sauerkraut)\b/, base: 3 },
    { pattern: /\b(brussels sprout)\b/, base: 3.5 },
    { pattern: /\b(artichoke)\b/, base: 4 },
    { pattern: /\b(wheat|rye|barley)\b/, base: 3.5 },
    // Medium
    { pattern: /\b(avocado)\b/, base: 2 },
    { pattern: /\b(beet(?!root))\b/, base: 2 },
    { pattern: /\b(fennel)\b/, base: 2.5 },
    { pattern: /\b(leek)\b/, base: 3 },
    { pattern: /\b(shallot)\b/, base: 3 },
    { pattern: /\b(pea(?!nut|ch))\b/, base: 2 },
    { pattern: /\b(corn(?! tortilla| chips in small amount))\b/, base: 2 },
    // Low
    { pattern: /\b(spring onion|green onion|chive)\b/, base: 1.5 },
    { pattern: /\b(garlic powder)\b/, base: 1.5 },
    { pattern: /\b(a little garlic|touch of onion)\b/, base: 1 },
    { pattern: /\b(low.?fodmap)\b/, base: -5 }, // negation
  ],

  caffeine: [
    { pattern: /\b(espresso|double shot|triple shot)\b/, base: 5 },
    { pattern: /\b(coffee(?! cake| table| ice cream))\b/, base: 4 },
    { pattern: /\b(cold brew|nitro coffee)\b/, base: 4.5 },
    { pattern: /\b(energy drink|red bull|monster|bang|celsius|prime energy)\b/, base: 5 },
    { pattern: /\b(black tea)\b/, base: 2.5 },
    { pattern: /\b(green tea|matcha)\b/, base: 2 },
    { pattern: /\b(iced coffee|iced latte)\b/, base: 3.5 },
    { pattern: /\b(latte|cappuccino|flat white|americano)\b/, base: 3 },
    { pattern: /\b(dark chocolate)\b/, base: 1.5 },
    { pattern: /\b(pre.?workout)\b/, base: 5 },
    { pattern: /\b(decaf|herbal tea|chamomile|peppermint tea|rooibos)\b/, base: -5 }, // negation
  ],

  alcohol: [
    { pattern: /\b(shots?|whiskey|bourbon|scotch|tequila|vodka|rum|gin|mezcal)\b/, base: 5 },
    { pattern: /\b(wine(?! vinegar)|red wine|white wine|rosé|champagne|prosecco)\b/, base: 4 },
    { pattern: /\b(beer(?! battered)|ipa|lager|stout|ale)\b/, base: 3.5 },
    { pattern: /\b(cocktail|margarita|mojito|bloody mary|mimosa|sangria|hard lemonade)\b/, base: 4 },
    { pattern: /\b(hard seltzer|white claw|truly|spiked)\b/, base: 3 },
    { pattern: /\b(cider(?! vinegar))\b/, base: 3 },
    { pattern: /\b(a glass of wine|one beer|half a beer)\b/, base: 2.5 },
  ],

  spicy: [
    { pattern: /\b(ghost pepper|carolina reaper|scorpion pepper)\b/, base: 5 },
    { pattern: /\b(habanero|scotch bonnet)\b/, base: 4.5 },
    { pattern: /\b(jalapeno|jalapeño)\b/, base: 3.5 },
    { pattern: /\b(buffalo sauce|buffalo wing)\b/, base: 3.5 },
    { pattern: /\b(sriracha|sambal|gochujang|chili oil|chili paste)\b/, base: 3.5 },
    { pattern: /\b(hot sauce|tabasco|frank'?s)\b/, base: 3 },
    { pattern: /\b(spicy|extra hot|very hot|fire|inferno)\b/, base: 3.5 },
    { pattern: /\b(thai food|thai curry|red curry|green curry|vindaloo|tikka masala)\b/, base: 3 },
    { pattern: /\b(chili(?! powder| flake))\b/, base: 3 },
    { pattern: /\b(wasabi)\b/, base: 3 },
    { pattern: /\b(pepper flake|red pepper|cayenne)\b/, base: 2 },
    { pattern: /\b(mild spice|a little spice|lightly spiced)\b/, base: 1 },
    { pattern: /\b(not spicy|no spice|mild(?! cheddar))\b/, base: -5 },
  ],

  highFat: [
    { pattern: /\b(deep.?fried|deep fried)\b/, base: 5 },
    { pattern: /\b(french fries|fries|onion rings|fried chicken|fried fish)\b/, base: 4.5 },
    { pattern: /\b(bacon(?! bit))\b/, base: 4 },
    { pattern: /\b(fatty steak|ribeye|prime rib|short rib|lamb)\b/, base: 4 },
    { pattern: /\b(butter sauce|cream sauce|hollandaise|bernaise|alfredo)\b/, base: 4.5 },
    { pattern: /\b(loaded|smothered|drowning in)\b/, base: 4 },
    { pattern: /\b(fried(?! egg over easy|lightly))\b/, base: 3.5 },
    { pattern: /\b(sausage|pepperoni|salami|chorizo)\b/, base: 3.5 },
    { pattern: /\b(burger(?! bowl| salad))\b/, base: 3 },
    { pattern: /\b(pan fried|sauteed in butter|cooked in oil)\b/, base: 2.5 },
    { pattern: /\b(a little oil|light butter|drizzle of olive oil)\b/, base: 1 },
    { pattern: /\b(air fried|baked|grilled|steamed|poached)\b/, base: -2 }, // reduces fat score
  ],
}

// Quantity modifiers — applied to all detected triggers in the text
const QUANTITY_MULTIPLIERS = [
  { pattern: /\b(massive|enormous|huge|giant|triple|double portion|large portion|overflowing|loaded)\b/, mult: 1.6 },
  { pattern: /\b(large|big|full plate|full bowl|heaping)\b/, mult: 1.3 },
  { pattern: /\b(extra|lots of|a lot of|tons of|so much)\b/, mult: 1.4 },
  { pattern: /\b(bowl of|plate of|full serving)\b/, mult: 1.2 },
  { pattern: /\b(small|half|half a|half-portion|kiddie|kids'?)\b/, mult: 0.7 },
  { pattern: /\b(tiny|a tiny bit of|just a bit|trace of|sprinkle of|dash of|drizzle of)\b/, mult: 0.4 },
  { pattern: /\b(lightly|light|a little|a bit of|a touch of|small amount of|a few)\b/, mult: 0.6 },
  { pattern: /\b(just a taste|one bite|couple bites|a nibble)\b/, mult: 0.3 },
]

// Full negation phrases (override trigger detection for that category)
const NEGATION_PATTERNS = [
  { pattern: /\b(gluten.?free|no gluten|without gluten)\b/, trigger: 'gluten' },
  { pattern: /\b(dairy.?free|no dairy|without dairy|vegan)\b/, trigger: 'dairy' },
  { pattern: /\b(low.?fodmap|no garlic|no onion)\b/, trigger: 'fodmap' },
  { pattern: /\b(decaf|no caffeine|caffeine.?free)\b/, trigger: 'caffeine' },
  { pattern: /\b(non.?alcoholic|alcohol.?free|no alcohol|virgin)\b/, trigger: 'alcohol' },
  { pattern: /\b(not spicy|no spice|no heat|mild)\b/, trigger: 'spicy' },
]

export function analyzeFood(text) {
  if (!text || text.trim().length < 2) return null

  const lower = text.toLowerCase()

  // Detect negations first
  const negatedTriggers = new Set()
  for (const { pattern, trigger } of NEGATION_PATTERNS) {
    if (pattern.test(lower)) negatedTriggers.add(trigger)
  }

  // Calculate quantity multiplier (take the strongest modifier mentioned)
  let multiplier = 1.0
  for (const { pattern, mult } of QUANTITY_MULTIPLIERS) {
    if (pattern.test(lower)) {
      // Take the modifier that moves furthest from 1.0
      if (Math.abs(mult - 1) > Math.abs(multiplier - 1)) multiplier = mult
    }
  }

  // Score each trigger
  const scores = {}
  const matchedFoods = {}

  for (const [trigger, patterns] of Object.entries(TRIGGER_PATTERNS)) {
    let maxScore = 0
    const foods = []

    for (const { pattern, base } of patterns) {
      const match = lower.match(pattern)
      if (match) {
        if (base < 0) {
          // Negation pattern within trigger definition
          negatedTriggers.add(trigger)
        } else {
          if (base > maxScore) maxScore = base
          foods.push(match[0])
        }
      }
    }

    if (negatedTriggers.has(trigger)) {
      scores[trigger] = 0
      matchedFoods[trigger] = []
    } else {
      const finalScore = Math.min(5, maxScore * multiplier)
      scores[trigger] = Math.round(finalScore * 10) / 10
      matchedFoods[trigger] = [...new Set(foods)]
    }
  }

  // Generate human-readable notes
  const notes = generateNotes(scores, matchedFoods, multiplier, negatedTriggers)
  const topTriggers = getTopTriggers(scores)
  const overallRisk = computeOverallRisk(scores)

  return { scores, matchedFoods, notes, topTriggers, overallRisk, multiplier }
}

function generateNotes(scores, matchedFoods, multiplier, negatedTriggers) {
  const notes = []

  for (const [trigger, score] of Object.entries(scores)) {
    if (score <= 0) continue
    const foods = matchedFoods[trigger]
    const label = TRIGGER_LABELS[trigger]
    const level = score >= 4 ? 'high' : score >= 2.5 ? 'moderate' : 'low'
    if (foods.length > 0) {
      notes.push(`${label}: ${level} (${score.toFixed(1)}/5) — from ${foods.join(', ')}`)
    }
  }

  if (multiplier > 1.2) notes.push('⚠️ Large portion detected — scores scaled up')
  if (multiplier < 0.7) notes.push('✓ Small portion — scores scaled down')
  for (const t of negatedTriggers) notes.push(`✓ ${TRIGGER_LABELS[t]}-free confirmed`)

  return notes
}

function getTopTriggers(scores) {
  return Object.entries(scores)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => ({ trigger: k, score: v, label: TRIGGER_LABELS[k] }))
}

function computeOverallRisk(scores) {
  const values = Object.values(scores)
  if (values.every(v => v === 0)) return 0
  const weighted = scores.gluten * 1.0 + scores.dairy * 1.0 + scores.fodmap * 0.9 +
    scores.caffeine * 0.7 + scores.alcohol * 0.8 + scores.spicy * 0.8 + scores.highFat * 0.7
  return Math.min(5, Math.round((weighted / 6) * 10) / 10)
}

export const TRIGGER_LABELS = {
  gluten:   'Gluten',
  dairy:    'Dairy',
  fodmap:   'FODMAPs',
  caffeine: 'Caffeine',
  alcohol:  'Alcohol',
  spicy:    'Spicy',
  highFat:  'High Fat',
}

export const TRIGGER_COLORS = {
  gluten:   '#F59E0B',
  dairy:    '#3B82F6',
  fodmap:   '#10B981',
  caffeine: '#8B5CF6',
  alcohol:  '#EF4444',
  spicy:    '#F97316',
  highFat:  '#6B7280',
}

// ─── Weekly Correlation Engine ────────────────────────────────────────────────
// Given a set of entries with scores + feelings, compute which triggers
// best predict bad gut days.

export function computeCorrelations(entries) {
  // For each trigger, collect (triggerScore, feelingScore) pairs
  // Look for meals logged within 6 hours BEFORE a feeling check-in
  const pairings = {}
  for (const trigger of Object.keys(TRIGGER_LABELS)) {
    pairings[trigger] = []
  }

  const feelingEntries = entries.filter(e => e.feeling)
  const mealEntries = entries.filter(e => e.meal && e.analysis)

  for (const feeling of feelingEntries) {
    // Find meals logged 0.5–8 hours before this feeling entry
    const windowStart = feeling.timestamp - 8 * 3600 * 1000
    const windowEnd   = feeling.timestamp - 30 * 60 * 1000
    const relevantMeals = mealEntries.filter(m =>
      m.timestamp >= windowStart && m.timestamp <= windowEnd
    )
    if (relevantMeals.length === 0) continue

    // Use the highest trigger score from relevant meals
    for (const trigger of Object.keys(TRIGGER_LABELS)) {
      const maxScore = Math.max(...relevantMeals.map(m => m.analysis?.scores?.[trigger] ?? 0))
      const feelScore = { good: 0, uncomfortable: 1, bloated: 2, pain: 3, destruction: 4 }[feeling.feeling] ?? 0
      pairings[trigger].push({ triggerScore: maxScore, feelScore })
    }
  }

  // Compute Pearson-like correlation coefficient per trigger
  const correlations = {}
  for (const [trigger, pairs] of Object.entries(pairings)) {
    if (pairs.length < 3) { correlations[trigger] = null; continue }
    const n = pairs.length
    const sumX = pairs.reduce((s, p) => s + p.triggerScore, 0)
    const sumY = pairs.reduce((s, p) => s + p.feelScore, 0)
    const sumXY = pairs.reduce((s, p) => s + p.triggerScore * p.feelScore, 0)
    const sumX2 = pairs.reduce((s, p) => s + p.triggerScore ** 2, 0)
    const sumY2 = pairs.reduce((s, p) => s + p.feelScore ** 2, 0)
    const num = n * sumXY - sumX * sumY
    const den = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2))
    correlations[trigger] = den === 0 ? 0 : Math.round((num / den) * 100) / 100
  }

  return correlations
}

// Format all entries for Claude analysis export
export function formatForClaudeAnalysis(entries, correlations) {
  const lines = []
  lines.push('=== GUT TRACKER WEEKLY ANALYSIS REQUEST ===')
  lines.push(`Period: ${new Date(Math.min(...entries.map(e => e.timestamp))).toDateString()} – ${new Date(Math.max(...entries.map(e => e.timestamp))).toDateString()}`)
  lines.push(`Total check-ins: ${entries.filter(e => e.feeling).length}`)
  lines.push('')

  // Day-by-day summary
  const byDate = {}
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = []
    byDate[e.date].push(e)
  }

  lines.push('--- DAILY LOG ---')
  for (const [date, dayEntries] of Object.entries(byDate).sort()) {
    lines.push(`\n${date}:`)
    for (const e of dayEntries.sort((a, b) => a.timestamp - b.timestamp)) {
      if (e.feeling) {
        const time = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        lines.push(`  [${time}] Feeling: ${e.feeling.toUpperCase()}`)
      }
      if (e.meal) {
        const time = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        lines.push(`  [${time}] Ate: ${e.meal}`)
        if (e.analysis?.topTriggers?.length) {
          const t = e.analysis.topTriggers.map(t => `${t.label}:${t.score.toFixed(1)}`).join(', ')
          lines.push(`          Triggers: ${t}`)
        }
      }
    }
  }

  lines.push('\n--- TRIGGER CORRELATIONS (r = Pearson, range -1 to +1) ---')
  if (correlations) {
    for (const [trigger, r] of Object.entries(correlations).sort(([, a], [, b]) => (b ?? -99) - (a ?? -99))) {
      if (r === null) { lines.push(`  ${TRIGGER_LABELS[trigger]}: insufficient data`) }
      else { lines.push(`  ${TRIGGER_LABELS[trigger]}: r=${r} (${r > 0.4 ? '⚠️ SUSPECT' : r > 0.2 ? 'possible' : 'weak/none'})`) }
    }
  }

  lines.push('\n--- PLEASE ANALYZE ---')
  lines.push('Based on the above data: Which triggers appear most associated with my worst symptoms? Are there any patterns by time of day, day of week, or meal combinations? What would you recommend I try eliminating or reducing first? Any other patterns you notice?')

  return lines.join('\n')
}
