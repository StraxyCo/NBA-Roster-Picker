// Playerdle — pool filtering, mystery pick, and per-attribute guess comparison.
// Profiles come from public/playerdle.json (see scripts/build-playerdle.mjs).

export const ATTRIBUTES = [
  { key: 'position',      label: 'Position' },
  { key: 'height',        label: 'Height' },
  { key: 'lastTeam',      label: 'Last team' },
  { key: 'signatureTeam', label: 'Signature team' },
  { key: 'debutSeason',   label: 'Debut' },
  { key: 'careerPPG',     label: 'PPG' },
  { key: 'careerRPG',     label: 'RPG' },
  { key: 'careerAPG',     label: 'APG' },
  { key: 'topPPG',        label: 'Top PPG' },
  { key: 'topRPG',        label: 'Top RPG' },
  { key: 'topAPG',        label: 'Top APG' },
]

// All keys default-on for a new game.
export const DEFAULT_ATTRIBUTES = Object.fromEntries(ATTRIBUTES.map(a => [a.key, true]))

const CONF = {
  E: ['ATL','BOS','BKN','CHA','CHI','CLE','DET','IND','MIA','MIL','NYK','ORL','PHI','TOR','WAS'],
  W: ['DAL','DEN','GSW','HOU','LAC','LAL','MEM','MIN','NOP','OKC','PHX','POR','SAC','SAS','UTA'],
}
const confOf = abbr => (CONF.E.includes(abbr) ? 'E' : CONF.W.includes(abbr) ? 'W' : null)

const POS_ORDER = ['G', 'G-F', 'F', 'F-C', 'C']

// numeric thresholds: green = exact-ish, yellow = "close"
const NUM = {
  height:    { green: 0,       yellow: 2 },
  debut:     { green: 0,       yellow: 3 },
  careerPPG: { green: 'round', yellow: 3 },
  topPPG:    { green: 'round', yellow: 3 },
  careerRPG: { green: 0.3,     yellow: 1.5 },
  careerAPG: { green: 0.3,     yellow: 1.5 },
  topRPG:    { green: 0.3,     yellow: 1.5 },
  topAPG:    { green: 0.3,     yellow: 1.5 },
}

export const heightFmt = inches => (inches == null ? '—' : `${Math.floor(inches / 12)}'${inches % 12}"`)
const debutYear = s => (s ? parseInt(s, 10) : NaN)

function numStatus(g, m, cfg) {
  const diff = Math.abs(g - m)
  const green = cfg.green === 'round' ? Math.round(g) === Math.round(m) : diff <= cfg.green
  return green ? 'green' : diff <= cfg.yellow ? 'yellow' : 'gray'
}
const arrow = (g, m) => (g === m ? '' : m > g ? '▲' : '▼')

// Compare one guessed profile to the mystery, for the enabled attributes only.
// Returns [{ key, label, value, status:'green'|'yellow'|'gray', arrow }]
export function compareGuess(mystery, guess, enabled) {
  const out = []
  for (const { key, label } of ATTRIBUTES) {
    if (enabled && enabled[key] === false) continue
    let value = '—', status = 'gray', arr = ''

    if (key === 'position') {
      value = guess.position ?? '—'
      const gi = POS_ORDER.indexOf(guess.position), mi = POS_ORDER.indexOf(mystery.position)
      status = guess.position && guess.position === mystery.position ? 'green'
        : gi >= 0 && mi >= 0 && Math.abs(gi - mi) === 1 ? 'yellow' : 'gray'
    } else if (key === 'height') {
      value = heightFmt(guess.height)
      if (guess.height != null && mystery.height != null) {
        status = numStatus(guess.height, mystery.height, NUM.height)
        arr = arrow(guess.height, mystery.height)
      }
    } else if (key === 'lastTeam' || key === 'signatureTeam') {
      const g = guess[key], m = mystery[key]
      value = g?.abbr ?? '—'
      status = g && m && g.id === m.id ? 'green'
        : g && m && confOf(g.abbr) && confOf(g.abbr) === confOf(m.abbr) ? 'yellow' : 'gray'
    } else if (key === 'debutSeason') {
      value = guess.debutSeason ?? '—'
      const gy = debutYear(guess.debutSeason), my = debutYear(mystery.debutSeason)
      if (!Number.isNaN(gy) && !Number.isNaN(my)) {
        status = numStatus(gy, my, NUM.debut)
        arr = arrow(gy, my)
      }
    } else {
      // numeric stats
      const g = guess[key], m = mystery[key]
      value = (g ?? 0).toFixed(1)
      status = numStatus(g, m, NUM[key])
      arr = arrow(g, m)
    }
    if (status === 'green') arr = ''
    out.push({ key, label, value, status, arrow: arr })
  }
  return out
}

// Pool: players matching the setup filters (min seasons + played-in-a-selected-season).
export function filterPool(profiles, selectedSeasons, minSeasons) {
  const seasons = selectedSeasons && selectedSeasons.length ? selectedSeasons : null
  return Object.entries(profiles)
    .filter(([, p]) => p.nSeasons >= (minSeasons || 1) && (!seasons || p.seasons.some(s => seasons.includes(s))))
    .map(([id, p]) => ({ id, ...p }))
}

export function getAllNames(profiles) {
  return Object.entries(profiles).map(([id, p]) => ({ id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name))
}

export function filterNames(allNames, query) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return allNames.filter(p => p.name.toLowerCase().includes(q)).slice(0, 12)
}
