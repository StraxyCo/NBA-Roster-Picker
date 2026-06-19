// node scripts/build-grading-data.mjs                  → subset seasons (default)
// node scripts/build-grading-data.mjs --all            → all 21 seasons (backfill)
// node scripts/build-grading-data.mjs --seasons 2015-16,2024-25
//
// Step 2/3 pipeline (bref-primary). For each season:
//   1. fetch + cache bref Advanced + Per Game tables (one request each, throttled,
//      cached forever — historical seasons are immutable).
//   2. parse → per-(bref_id, season) line (traded players use the 2TM/3TM line).
//   3. resolve bref_id → nba_id (auto crosswalk + per-season team/lastname co-occurrence).
//   4. compute the qualified-pop benchmark (mean/sd, byPosition, league 3P%).
//   5. write public/grading/<season>.json = { benchmark, players keyed by nba_id }.
//
// NBA.com (height) is NOT fetched here — this sandbox/most CI can't reach stats.nba.com.
// Height is an optional enrichment (scripts/fetch-heights.mjs, run locally); shards
// carry height_in:null until then and size_archetype degrades to position-only.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { deriveStats, posBucket, STAT_KEYS } from '../src/grading/derive.js'
import { NUDGE_STATS } from '../src/grading/config.js'

const CACHE_DIR = 'data/bref-cache'
const SHARD_DIR = 'public/grading'
const CROSSWALK = 'data/crosswalk.json'
const REVIEW = 'data/crosswalk-review.json'
const THROTTLE_MS = 6000

const ALL_SEASONS = ['2005-06','2006-07','2007-08','2008-09','2009-10','2010-11','2011-12','2012-13','2013-14','2014-15','2015-16','2016-17','2017-18','2018-19','2019-20','2020-21','2021-22','2022-23','2023-24','2024-25','2025-26']
const SUBSET = ['2005-06', '2015-16', '2024-25', '2025-26']
// scheduled games per season (lockout/bubble shortened) — for GP discount + qualified threshold
const GP_FULL = { '2011-12': 66, '2019-20': 72, '2020-21': 72 }
const gpFull = s => GP_FULL[s] || 82
const seasonEndYear = s => Number(s.slice(0, 4)) + 1 // '2015-16' -> 2016

const BREF_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15' }
const delay = ms => new Promise(r => setTimeout(r, ms))

// ── fetch + cache ─────────────────────────────────────────────────────────────
async function cachedFetch(url, file) {
  if (existsSync(file)) return readFileSync(file, 'utf8')
  console.log(`  fetch ${url}`)
  const res = await fetch(url, { headers: BREF_HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const txt = await res.text()
  writeFileSync(file, txt)
  await delay(THROTTLE_MS)
  return txt
}

// ── parse a bref league table (id) into row objects ───────────────────────────
function parseTable(html, tableIds, wanted) {
  const clean = html.replace(/<!--/g, '').replace(/-->/g, '') // some tables are comment-wrapped
  const ids = Array.isArray(tableIds) ? tableIds : [tableIds]
  let at = -1
  for (const id of ids) { at = clean.indexOf(`id="${id}"`); if (at !== -1) break }
  if (at === -1) throw new Error(`table not found (tried ${ids.join(', ')})`)
  const body = clean.slice(clean.indexOf('<tbody>', at), clean.indexOf('</tbody>', at))
  const rows = []
  for (const chunk of body.split('<tr').slice(1)) {
    const idm = chunk.match(/data-append-csv="([^"]+)"/)
    if (!idm) continue // thead-repeat / blank row
    const row = { bref_id: idm[1] }
    for (const stat of wanted) {
      const m = chunk.match(new RegExp(`data-stat="${stat}"[^>]*>(?:<[^>]+>)*([^<]*)`))
      row[stat] = m ? m[1] : null
    }
    rows.push(row)
  }
  return rows
}

const num = v => (v == null || v === '' ? null : parseFloat(v))
const TRADED = new Set(['2TM', '3TM', '4TM', '5TM', 'TOT'])

// Collapse a player's multiple team rows in a season to one season line:
// prefer the combined (2TM/TOT) row; else the single team row.
function seasonLine(rowsForPlayer) {
  if (rowsForPlayer.length === 1) return rowsForPlayer[0]
  return rowsForPlayer.find(r => TRADED.has(r.team)) || rowsForPlayer[0]
}

// ── name normalize (mirror of build-crosswalk.mjs) ────────────────────────────
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])
function norm(s) {
  const tokens = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(t => t && !SUFFIXES.has(t))
  const merged = []
  let prevInit = false
  for (const t of tokens) { if (t.length === 1 && prevInit) merged[merged.length - 1] += t; else merged.push(t); prevInit = t.length === 1 }
  return merged.join(' ').trim()
}
const lastName = s => { const t = norm(s).split(' '); return t[t.length - 1] }

// ── load sources ──────────────────────────────────────────────────────────────
const rosters = JSON.parse(readFileSync('public/rosters.json', 'utf8'))
const careers = JSON.parse(readFileSync('public/careers.json', 'utf8'))
const crosswalk = JSON.parse(readFileSync(CROSSWALK, 'utf8')) // { <nba_id>: {bref_id,...} }

// reverse: bref_id -> nba_id (from the auto crosswalk)
const brefToNba = new Map()
for (const nid of Object.keys(crosswalk)) brefToNba.set(crosswalk[nid].bref_id, Number(nid))

// draft universe + per-(season) nba presence for co-occurrence:
//   nbaSeason[season] = Map<lastName, [{nba_id, team}]>   (from careers.json)
const draftable = new Set()
for (const season of Object.keys(rosters)) for (const tid of Object.keys(rosters[season])) for (const p of rosters[season][tid]) draftable.add(p.id)
for (const id of Object.keys(careers)) draftable.add(Number(id))

const nbaSeason = {}
const nbaName = new Map()
for (const id of Object.keys(careers)) {
  const c = careers[id]; const nid = Number(id); nbaName.set(nid, c.name)
  for (const s of c.seasons || []) {
    ;(nbaSeason[s.season] ||= new Map())
    const ln = lastName(c.name)
    ;(nbaSeason[s.season].get(ln) || nbaSeason[s.season].set(ln, []).get(ln)).push({ nba_id: nid, team: s.teamAbbr })
  }
}
for (const season of Object.keys(rosters)) for (const tid of Object.keys(rosters[season])) for (const p of rosters[season][tid]) if (!nbaName.has(p.id)) nbaName.set(p.id, p.name)

// resolve a bref season line to an nba_id (auto, then co-occurrence)
const resolvedThisRun = {}
function resolveNbaId(line) {
  if (brefToNba.has(line.bref_id)) return brefToNba.get(line.bref_id)
  const idx = nbaSeason[line.season]
  if (!idx) return null
  const ln = lastName(line.name)
  const cands = idx.get(ln) || []
  let hit = null
  if (!TRADED.has(line.team)) hit = cands.find(c => c.team === line.team) // same team-season
  if (!hit && cands.length === 1) hit = cands[0] // unique lastname that season (covers traded/2TM)
  if (hit) { resolvedThisRun[hit.nba_id] = { nba_id: hit.nba_id, bref_id: line.bref_id, full_name: nbaName.get(hit.nba_id), via: 'co-occurrence', season: line.season }; brefToNba.set(line.bref_id, hit.nba_id); return hit.nba_id }
  return null
}

// ── stats columns to pull ─────────────────────────────────────────────────────
const ADV = ['name_display', 'team_name_abbr', 'pos', 'age', 'games', 'mp', 'usg_pct', 'ts_pct', 'ast_pct', 'tov_pct', 'orb_pct', 'drb_pct', 'stl_pct', 'blk_pct', 'fta_per_fga_pct', 'fg3a_per_fga_pct', 'obpm', 'dbpm']
const PG = ['team_name_abbr', 'pts_per_g', 'fg3_per_g', 'fg3a_per_g', 'fg3_pct', 'fg2a_per_g', 'fg2_pct', 'ast_per_g', 'tov_per_g', 'pf_per_g', 'mp_per_g', 'games']

function rawRecord(adv, pg) {
  const games = num(adv.games)
  return {
    bref_id: adv.bref_id, name: adv.name_display, team: adv.team_name_abbr, pos: adv.pos,
    games, mpg: pg ? num(pg.mp_per_g) : (num(adv.mp) || 0) / Math.max(games, 1),
    usg_pct: num(adv.usg_pct), ts_pct: num(adv.ts_pct), ast_pct: num(adv.ast_pct), tov_pct: num(adv.tov_pct),
    orb_pct: num(adv.orb_pct), drb_pct: num(adv.drb_pct), stl_pct: num(adv.stl_pct), blk_pct: num(adv.blk_pct),
    ftr: num(adv.fta_per_fga_pct), tpar: num(adv.fg3a_per_fga_pct), obpm: num(adv.obpm), dbpm: num(adv.dbpm),
    pts: pg ? num(pg.pts_per_g) : null, fg3m: pg ? num(pg.fg3_per_g) : null, fg3a: pg ? num(pg.fg3a_per_g) : null,
    fg3_pct: pg ? num(pg.fg3_pct) : null, fg2a: pg ? num(pg.fg2a_per_g) : null, fg2_pct: pg ? num(pg.fg2_pct) : null,
    ast: pg ? num(pg.ast_per_g) : null, tov: pg ? num(pg.tov_per_g) : null, pf: pg ? num(pg.pf_per_g) : null,
  }
}

// mean/sd helper
function meanSd(vals) {
  const v = vals.filter(x => x != null && !Number.isNaN(x))
  if (!v.length) return { mean: 0, sd: 1 }
  const mean = v.reduce((a, b) => a + b, 0) / v.length
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length) || 1
  return { mean, sd }
}

// ── per-season build ──────────────────────────────────────────────────────────
async function buildSeason(season) {
  const yr = seasonEndYear(season)
  const advHtml = await cachedFetch(`https://www.basketball-reference.com/leagues/NBA_${yr}_advanced.html`, `${CACHE_DIR}/${season}-advanced.html`)
  const pgHtml = await cachedFetch(`https://www.basketball-reference.com/leagues/NBA_${yr}_per_game.html`, `${CACHE_DIR}/${season}-per_game.html`)

  const advRows = parseTable(advHtml, ['advanced', 'advanced_stats'], ADV).map(r => ({ ...r, team: r.team_name_abbr }))
  const pgRows = parseTable(pgHtml, ['per_game_stats', 'per_game'], PG).map(r => ({ ...r, team: r.team_name_abbr }))

  // group by bref_id, collapse to season line
  const groupBy = rows => { const m = new Map(); for (const r of rows) (m.get(r.bref_id) || m.set(r.bref_id, []).get(r.bref_id)).push(r); return m }
  const advByB = groupBy(advRows), pgByB = groupBy(pgRows)
  const records = []
  for (const [bid, rows] of advByB) {
    const adv = seasonLine(rows)
    const pg = pgByB.has(bid) ? seasonLine(pgByB.get(bid)) : null
    records.push({ ...rawRecord(adv, pg), season })
  }

  const gf = gpFull(season)
  const minGames = Math.round((30 / 82) * gf)
  const qualified = records.filter(r => r.mpg >= 15 && r.games >= minGames)

  // league 3P% (attempts-weighted over qualified) for the spacing shrink
  let m3 = 0, a3 = 0
  for (const r of qualified) { if (r.fg3m != null && r.fg3a != null) { m3 += r.fg3m * r.games; a3 += r.fg3a * r.games } }
  const p_league3P = a3 > 0 ? m3 / a3 : 0.35
  const ctx = { p_league3P }

  // benchmark: mean/sd of every derived stat over qualified pop
  const derived = qualified.map(r => deriveStats(r, ctx))
  const stats = {}
  for (const k of STAT_KEYS) stats[k] = meanSd(derived.map(d => d[k]))

  // byPosition mean/sd for the nudge stats
  const byPosition = {}
  for (const r of qualified) {
    const b = posBucket(r.pos); if (!b) continue
    ;(byPosition[b] ||= { _rows: [] })._rows.push(deriveStats(r, ctx))
  }
  for (const b of Object.keys(byPosition)) {
    const rows = byPosition[b]._rows; const o = {}
    for (const k of NUDGE_STATS) o[k] = meanSd(rows.map(d => d[k]))
    byPosition[b] = o
  }

  // players keyed by nba_id (draftable only)
  const players = {}
  let mapped = 0, unmapped = 0
  for (const r of records) {
    const nbaId = resolveNbaId(r)
    if (nbaId == null || !draftable.has(nbaId)) { unmapped++; continue }
    mapped++
    players[nbaId] = {
      canonical_id: `nba_${nbaId}`, name: r.name, team: r.team, pos_bucket: posBucket(r.pos), height_in: null,
      gp: r.games, mpg: r.mpg,
      raw: {
        pts: r.pts, fg3m: r.fg3m, fg3a: r.fg3a, fg3_pct: r.fg3_pct, fg2a: r.fg2a, fg2_pct: r.fg2_pct,
        ast: r.ast, tov: r.tov, pf: r.pf, mpg: r.mpg,
        ts_pct: r.ts_pct, usg_pct: r.usg_pct, ast_pct: r.ast_pct, tov_pct: r.tov_pct, orb_pct: r.orb_pct,
        drb_pct: r.drb_pct, stl_pct: r.stl_pct, blk_pct: r.blk_pct, ftr: r.ftr, tpar: r.tpar, obpm: r.obpm, dbpm: r.dbpm,
      },
    }
  }

  if (!existsSync(SHARD_DIR)) mkdirSync(SHARD_DIR, { recursive: true })
  writeFileSync(`${SHARD_DIR}/${season}.json`, JSON.stringify({ season, gp_full: gf, benchmark: { p_league3P, stats, byPosition }, players }, null, 0))
  console.log(`  ${season}: ${records.length} bref rows, ${qualified.length} qualified, ${mapped} mapped to nba_id, ${unmapped} unmapped`)
  return { season, records: records.length, qualified: qualified.length, mapped, unmapped }
}

// ── main ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
let seasons = SUBSET
if (args.includes('--all')) seasons = ALL_SEASONS
const si = args.indexOf('--seasons')
if (si !== -1 && args[si + 1]) seasons = args[si + 1].split(',')

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
console.log(`Building grading data for: ${seasons.join(', ')}`)
for (const s of seasons) await buildSeason(s)

// fold co-occurrence resolutions back into the crosswalk + prune the review pile
if (Object.keys(resolvedThisRun).length) {
  for (const nid of Object.keys(resolvedThisRun)) {
    const r = resolvedThisRun[nid]
    crosswalk[nid] = { canonical_id: `nba_${nid}`, nba_id: Number(nid), bref_id: r.bref_id, full_name: r.full_name }
  }
  writeFileSync(CROSSWALK, JSON.stringify(crosswalk, null, 2))
  const review = JSON.parse(readFileSync(REVIEW, 'utf8'))
  const resolvedIds = new Set(Object.keys(resolvedThisRun).map(Number))
  review.ambiguous = review.ambiguous.filter(x => !resolvedIds.has(x.nba_id))
  review.noMatch = review.noMatch.filter(x => !resolvedIds.has(x.nba_id))
  writeFileSync(REVIEW, JSON.stringify(review, null, 2))
  console.log(`\nresolved ${resolvedIds.size} review-pile players via co-occurrence → crosswalk updated`)
}
console.log('done.')
