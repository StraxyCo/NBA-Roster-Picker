// node scripts/test-rosters.mjs
//
// Step 5 — sanity suite for the grading engine (docs/roster-grading/test-rosters.md).
// Resolves each named player-season to its nba_id in the shard, runs the engine,
// and checks absolute bands + the (stronger) ordering invariants.

import { readFileSync, readdirSync } from 'fs'
import { gradeRoster } from '../src/grading/engine.js'

const SHARD_DIR = 'public/grading'
const shards = {}
for (const f of readdirSync(SHARD_DIR).filter(f => f.endsWith('.json'))) {
  const s = JSON.parse(readFileSync(`${SHARD_DIR}/${f}`, 'utf8'))
  shards[s.season] = s
}

// normalized-name resolver (accent-insensitive), disambiguated by team
const SPECIAL = { ı: 'i', ł: 'l', ø: 'o', đ: 'd', ð: 'd', þ: 'th', ß: 'ss', æ: 'ae', œ: 'oe' }
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ıłøđðþßæœ]/g, c => SPECIAL[c] || c).replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()
function resolve(name, season, team) {
  const shard = shards[season]
  if (!shard) throw new Error(`no shard for ${season}`)
  const want = norm(name)
  const hits = Object.entries(shard.players).filter(([, p]) => norm(p.name) === want)
  if (!hits.length) throw new Error(`NOT FOUND: ${name} ${season}`)
  const pick = hits.length === 1 ? hits[0] : hits.find(([, p]) => p.team === team) || hits[0]
  return Number(pick[0])
}

function makeRoster(rows) {
  return rows.map((r, i) => ({ nba_id: resolve(r[0], r[1], r[2]), season: r[1], team: r[2], roster_slot: i + 1 }))
}

// ── rosters ────────────────────────────────────────────────────────────────────
const ROSTERS = {
  A: { name: 'Dream Team', rows: [
    ['Nikola Jokić', '2021-22', 'DEN'], ['Russell Westbrook', '2016-17', 'OKC'], ['Stephen Curry', '2015-16', 'GSW'],
    ['LeBron James', '2012-13', 'MIA'], ['Kevin Garnett', '2007-08', 'BOS'], ['Kawhi Leonard', '2016-17', 'SAS'],
  ], bands: { offense: [90, 98], defense: [78, 90], complementarity: [70, 85], overall: [86, 94] } },
  B: { name: '3-Alpha Iso', rows: [
    ['Carmelo Anthony', '2012-13', 'NYK'], ['DeMar DeRozan', '2016-17', 'TOR'], ['Devin Booker', '2016-17', 'PHX'],
    ['Bradley Beal', '2020-21', 'WAS'], ['Zach LaVine', '2020-21', 'CHI'], ['Jordan Clarkson', '2021-22', 'UTA'],
  ], bands: { offense: [75, 88], defense: [30, 50], complementarity: [25, 45], overall: [50, 62] } },
  C: { name: 'Balanced Two-Way', rows: [
    ['Chris Paul', '2008-09', 'NOH'], ['Klay Thompson', '2015-16', 'GSW'], ['Paul George', '2018-19', 'OKC'],
    ['Draymond Green', '2016-17', 'GSW'], ['Rudy Gobert', '2016-17', 'UTA'], ['JJ Redick', '2015-16', 'LAC'],
  ], bands: { offense: [78, 88], defense: [80, 90], complementarity: [85, 95], overall: [82, 90] } },
  D: { name: 'All-Defense', rows: [
    ['Ben Wallace', '2005-06', 'DET'], ['Tony Allen', '2012-13', 'MEM'], ['Andre Roberson', '2016-17', 'OKC'],
    ['Joakim Noah', '2013-14', 'CHI'], ['Roy Hibbert', '2013-14', 'IND'], ['Marcus Smart', '2018-19', 'BOS'],
  ], bands: { offense: [30, 45], defense: [88, 96], complementarity: [45, 60], overall: [52, 64] } },
}

// ── Roster E: construct from real low-availability / replacement-level players ───
function deepBench() {
  const season = '2015-16'
  const cands = Object.entries(shards[season].players)
    .filter(([, p]) => p.gp < 40 || p.mpg < 15)
    .sort((a, b) => a[1].gp - b[1].gp)
  const pick = cands.slice(20, 26) // avoid 1-game flukes, take genuine deep bench
  return pick.map(([id, p], i) => ({ nba_id: Number(id), season, team: p.team, roster_slot: i + 1, _name: p.name, _gp: p.gp }))
}

// ── run ──────────────────────────────────────────────────────────────────────
const results = {}
for (const k of Object.keys(ROSTERS)) {
  const r = ROSTERS[k]
  results[k] = gradeRoster(makeRoster(r.rows), shards)
}
const eRoster = deepBench()
results.E = gradeRoster(eRoster, shards)
ROSTERS.E = { name: 'Deep Bench', bands: { offense: [30, 48], defense: [35, 50], complementarity: [35, 55], overall: [40, 55] } }

// ── report ──────────────────────────────────────────────────────────────────
const inBand = (v, [lo, hi]) => v >= lo && v <= hi
const fmt = (v, b) => `${String(v).padStart(5)} ${inBand(v, b) ? '✓' : '✗ ['+b.join('-')+']'}`
console.log('\n══ Roster grades ══')
for (const k of Object.keys(ROSTERS)) {
  const res = results[k], b = ROSTERS[k].bands
  console.log(`\n${k} — ${ROSTERS[k].name}`)
  console.log(`   Offense        ${fmt(res.components.offense.score, b.offense)}`)
  console.log(`   Defense        ${fmt(res.components.defense.score, b.defense)}`)
  console.log(`   Complementarity${fmt(res.components.complementarity.score, b.complementarity)}`)
  console.log(`   OVERALL        ${fmt(res.overall, b.overall)}   (two-way adj ${res.two_way_balance_adjustment})`)
}

// ── ordering invariants (design §0 / test-rosters.md §summary) ─────────────────
const o = k => results[k].overall
console.log('\n══ Ordering invariants ══')
const checks = [
  [`A(${o('A')}) >= C(${o('C')})`, o('A') >= o('C')],
  [`C(${o('C')}) > B(${o('B')})`, o('C') > o('B')],
  [`B(${o('B')}) > D(${o('D')})`, o('B') > o('D')],
  [`B(${o('B')}) > E(${o('E')})`, o('B') > o('E')],
  [`A overall < 97 (cap)`, o('A') < 97],
  [`D overall << Defense (two-way bites): ${o('D')} vs ${results.D.components.defense.score}`, results.D.components.defense.score - o('D') >= 15],
  [`E is lowest`, o('E') <= Math.min(o('A'), o('B'), o('C'), o('D'))],
]
for (const [label, pass] of checks) console.log(`   ${pass ? '✓' : '✗'} ${label}`)

// ── unit test: availability (Embiid 66 GP vs 19 GP) ───────────────────────────
console.log('\n══ Availability unit test (Embiid) ══')
for (const [label, season] of [['2022-23 (66 GP)', '2022-23'], ['2024-25 (19 GP)', '2024-25']]) {
  const id = resolve('Joel Embiid', season, 'PHI')
  const res = gradeRoster([{ nba_id: id, season, team: 'PHI', roster_slot: 1 }], shards)
  const p = res.players[0]
  console.log(`   ${label}: avail=${p.availability_factor}  off_contrib=${p.offense_contribution}  def_contrib=${p.defense_contribution}`)
}
console.log('\nE roster:', eRoster.map(p => `${p._name}(${p._gp}gp)`).join(', '))
