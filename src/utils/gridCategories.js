import { NBA_TEAMS } from '../data/teams.js'

// Historical team abbreviation aliases in careers.json
const FRANCHISE_ABBRS = {
  4:  ['BKN', 'NJN'],
  5:  ['CHA', 'CHH'],
  23: ['NOP', 'NOH', 'NOK'],
  25: ['OKC', 'SEA'],
}
function teamAbbrs(team) {
  return FRANCHISE_ABBRS[team.id] || [team.abbr]
}

// ── Category makers ───────────────────────────────────────────────────────────

function makeTeamCategory(team) {
  const abbrs = teamAbbrs(team)
  return {
    type: 'team',
    key: `team-${team.id}`,
    label: team.name,
    validate(playerId, careers) {
      return careers[String(playerId)]?.seasons.some(
        s => s.teamAbbr !== 'TOT' && abbrs.includes(s.teamAbbr)
      ) ?? false
    },
  }
}

function makeSeasonCategory(season) {
  return {
    type: 'season',
    key: `season-${season}`,
    label: season,
    validate(playerId, careers) {
      return careers[String(playerId)]?.seasons.some(
        s => s.season === season && s.teamAbbr !== 'TOT'
      ) ?? false
    },
  }
}

const STAT_DEFS = [
  { key: 'pts',  label: 'PPG',  thresholds: [15, 20, 25, 30] },
  { key: 'reb',  label: 'RPG',  thresholds: [8, 10, 12] },
  { key: 'ast',  label: 'APG',  thresholds: [6, 8, 10] },
  { key: 'stl',  label: 'SPG',  thresholds: [1.5, 2.0, 2.5] },
  { key: 'blk',  label: 'BPG',  thresholds: [1.5, 2.0, 3.0] },
  { key: 'fg3m', label: '3PM',  thresholds: [100, 150, 200, 250] },
  { key: 'min',  label: 'MPG',  thresholds: [30, 34, 38] },
  { key: 'gp',   label: 'games played', thresholds: [70, 75, 80] },
]

function makeStatMinCategory(statKey, statLabel, threshold) {
  const isInt = statKey === 'fg3m' || statKey === 'gp'
  const fmt = v => isInt ? `${Math.round(v)}` : v.toFixed(0)
  return {
    type: 'stat',
    key: `stat-${statKey}-${threshold}`,
    label: `${fmt(threshold)}+ ${statLabel} (season)`,
    validate(playerId, careers) {
      return careers[String(playerId)]?.seasons.some(
        s => s.teamAbbr !== 'TOT' && (s[statKey] ?? 0) >= threshold
      ) ?? false
    },
  }
}

function makeAllStarCategory(allstarsData) {
  const ids = new Set()
  Object.values(allstarsData).forEach(({ east = [], west = [] }) => {
    ;[...east, ...west].forEach(p => ids.add(String(p.id)))
  })
  return {
    type: 'allstar',
    key: 'allstar',
    label: 'NBA All-Star',
    validate(playerId) { return ids.has(String(playerId)) },
  }
}

const POSITIONS = [
  { prefix: 'G', label: 'Guard' },
  { prefix: 'F', label: 'Forward' },
  { prefix: 'C', label: 'Center' },
]
function makePositionCategory(prefix, label, rosterIndex) {
  return {
    type: 'position',
    key: `pos-${prefix}`,
    label: `${label}`,
    validate(playerId) {
      return rosterIndex[String(playerId)]?.positions.some(p => p.startsWith(prefix)) ?? false
    },
  }
}

const JERSEY_NUMBERS = [0,1,3,5,6,7,8,10,11,13,15,20,21,22,23,24,25,30,31,32,33,34,35,41,44]
function makeJerseyCategory(number, rosterIndex) {
  return {
    type: 'jersey',
    key: `jersey-${number}`,
    label: `Wore #${number}`,
    validate(playerId) {
      return rosterIndex[String(playerId)]?.numbers.has(String(number)) ?? false
    },
  }
}

function makeDecadeCategory(decadeStart) {
  const label = `${decadeStart}s`
  const start = `${decadeStart}-${String(decadeStart + 1).slice(-2)}`
  const end   = `${decadeStart + 9}-${String(decadeStart + 10).slice(-2)}`
  return {
    type: 'decade',
    key: `decade-${decadeStart}`,
    label: `Played in the ${label}`,
    validate(playerId, careers) {
      return careers[String(playerId)]?.seasons.some(
        s => s.season >= start && s.season <= end && s.teamAbbr !== 'TOT'
      ) ?? false
    },
  }
}

// ── Roster index ──────────────────────────────────────────────────────────────

export function buildRosterIndex(rosters) {
  const index = {}
  for (const seasonData of Object.values(rosters)) {
    for (const teamRoster of Object.values(seasonData)) {
      for (const player of teamRoster) {
        const id = String(player.id)
        if (!index[id]) index[id] = { positions: [], numbers: new Set() }
        if (player.position && !index[id].positions.includes(player.position)) {
          index[id].positions.push(player.position)
        }
        if (player.number != null) index[id].numbers.add(String(player.number))
      }
    }
  }
  return index
}

// ── Category generation ───────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateCategories(n, allstarsData, rosterIndex, selectedSeasons) {
  const allStarCat = makeAllStarCategory(allstarsData)

  const pools = {
    team:     shuffle(NBA_TEAMS).map(makeTeamCategory),
    season:   shuffle(selectedSeasons).map(makeSeasonCategory),
    stat:     shuffle(STAT_DEFS.flatMap(d => d.thresholds.map(t => makeStatMinCategory(d.key, d.label, t)))),
    allstar:  [allStarCat],
    position: POSITIONS.map(p => makePositionCategory(p.prefix, p.label, rosterIndex)),
    jersey:   shuffle(JERSEY_NUMBERS).map(n => makeJerseyCategory(n, rosterIndex)),
    decade:   shuffle([2000, 2010, 2020, 2005].map(makeDecadeCategory)),
  }

  // Weighted type list — teams are most interesting, then seasons, then stats
  const typeSeq = shuffle([
    'team','team','team','team',
    'season','season',
    'stat','stat','stat',
    'allstar',
    'position',
    'jersey',
    'decade',
  ])

  const chosen = []
  const usedKeys = new Set()
  const typeCounts = {}

  for (const type of [...typeSeq, ...typeSeq]) {
    if (chosen.length >= n) break
    const pool = pools[type]
    if (!pool?.length) continue
    const maxOfType = type === 'team' ? 4 : type === 'stat' ? 3 : 2
    if ((typeCounts[type] || 0) >= maxOfType) continue
    const available = pool.filter(c => !usedKeys.has(c.key))
    if (!available.length) continue
    const cat = available[Math.floor(Math.random() * available.length)]
    chosen.push(cat)
    usedKeys.add(cat.key)
    typeCounts[type] = (typeCounts[type] || 0) + 1
  }

  // Fallback: fill remaining with teams
  while (chosen.length < n) {
    const available = pools.team.filter(c => !usedKeys.has(c.key))
    if (!available.length) break
    const cat = available[Math.floor(Math.random() * available.length)]
    chosen.push(cat)
    usedKeys.add(cat.key)
  }

  return chosen
}

// ── Player search ─────────────────────────────────────────────────────────────

export function getAllPlayers(careers) {
  return Object.entries(careers)
    .map(([id, d]) => ({ id, name: d.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function filterPlayers(allPlayers, query) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return allPlayers.filter(p => p.name.toLowerCase().includes(q)).slice(0, 20)
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateCell(playerId, rowCat, colCat, careers) {
  return rowCat.validate(playerId, careers) && colCat.validate(playerId, careers)
}
