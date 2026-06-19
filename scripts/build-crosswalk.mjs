// node scripts/build-crosswalk.mjs
//
// Step 1 — canonical-ID crosswalk (BUILD-TIME ONLY, never shipped to the browser).
// Maps nba_id <-> bref_id for the 2005-06+ player universe.
//
//   nba_id universe : public/rosters.json + public/careers.json
//   bref_id universe: public/nicknames.json  (player_id is the bref slug)
//
// Strategy: normalized-name match. Clean 1:1 -> auto-crosswalk. Collisions or
// name-variant no-matches -> review pile (resolved later by team-season
// co-occurrence against the bref Advanced tables; birthdate only as last resort).
//
// Outputs:
//   data/crosswalk.json         { <nba_id>: { canonical_id, nba_id, bref_id, full_name } }
//   data/crosswalk-review.json  { ambiguous: [...], noMatch: [...] } with career context

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'

const OUT_DIR = 'data'
const CROSSWALK_OUT = `${OUT_DIR}/crosswalk.json`
const REVIEW_OUT = `${OUT_DIR}/crosswalk-review.json`

// ── normalize a display name for matching ────────────────────────────────────
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])
function norm(s) {
  const tokens = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z\s]/g, ' ') // drop punctuation (J.J. -> "j j")
    .split(/\s+/)
    .filter(t => t && !SUFFIXES.has(t))
  // collapse a run of single-letter initials into one token: "d j mbenga" -> "dj mbenga"
  const merged = []
  let prevWasInitial = false
  for (const t of tokens) {
    if (t.length === 1 && prevWasInitial) merged[merged.length - 1] += t
    else merged.push(t)
    prevWasInitial = t.length === 1
  }
  return merged.join(' ').trim()
}

// ── load source universes ────────────────────────────────────────────────────
const rosters = JSON.parse(readFileSync('public/rosters.json', 'utf8'))
const careers = JSON.parse(readFileSync('public/careers.json', 'utf8'))
const nicknames = JSON.parse(readFileSync('public/nicknames.json', 'utf8'))

// nba_id -> name, and nba_id -> [{season, team}] career context (from careers.json)
const nbaName = new Map()
const nbaCareer = new Map()
for (const season of Object.keys(rosters))
  for (const teamId of Object.keys(rosters[season]))
    for (const p of rosters[season][teamId]) if (!nbaName.has(p.id)) nbaName.set(p.id, p.name)

for (const id of Object.keys(careers)) {
  const c = careers[id]
  const nid = Number(id)
  if (!nbaName.has(nid)) nbaName.set(nid, c.name)
  nbaCareer.set(nid, (c.seasons || []).map(s => ({ season: s.season, team: s.teamAbbr })))
}

// bref_id -> name (dedup over the nicknames map)
const brefName = new Map()
for (const key of Object.keys(nicknames))
  for (const e of nicknames[key]) if (!brefName.has(e.player_id)) brefName.set(e.player_id, e.player_name)

// ── index by normalized name ─────────────────────────────────────────────────
function indexByName(idNameMap) {
  const m = new Map()
  for (const [id, name] of idNameMap) {
    const n = norm(name)
    if (!m.has(n)) m.set(n, [])
    m.get(n).push({ id, name })
  }
  return m
}
const nbaByName = indexByName(nbaName)
const brefByName = indexByName(brefName)

// Augment bref name index with single-target nickname keys as aliases
// ("Flip Murray" -> ronald murray's bref_id, "Slava Medvedenko" -> stanislav...).
// Only unambiguous (single bref_id) nickname keys, and never override a real name.
for (const key of Object.keys(nicknames)) {
  const targets = nicknames[key]
  if (targets.length !== 1) continue // skip multi-player nicknames ("Don", "Black Hole")
  const n = norm(key)
  if (brefByName.has(n)) continue // a real player already owns this normalized name
  brefByName.set(n, [{ id: targets[0].player_id, name: targets[0].player_name }])
}

// ── match ────────────────────────────────────────────────────────────────────
const crosswalk = {}
const ambiguous = []
const noMatch = []

for (const [n, nbaEntries] of nbaByName) {
  const brefEntries = brefByName.get(n)
  if (!brefEntries) {
    for (const e of nbaEntries)
      noMatch.push({ nba_id: e.id, full_name: e.name, career: nbaCareer.get(e.id) || [] })
    continue
  }
  if (nbaEntries.length === 1 && brefEntries.length === 1) {
    const e = nbaEntries[0]
    crosswalk[e.id] = {
      canonical_id: `nba_${e.id}`,
      nba_id: e.id,
      bref_id: brefEntries[0].id,
      full_name: e.name,
    }
  } else {
    // collision on one or both sides -> needs co-occurrence disambiguation
    for (const e of nbaEntries)
      ambiguous.push({
        nba_id: e.id,
        full_name: e.name,
        career: nbaCareer.get(e.id) || [],
        bref_candidates: brefEntries.map(b => ({ bref_id: b.id, full_name: b.name })),
      })
  }
}

// ── write ────────────────────────────────────────────────────────────────────
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(CROSSWALK_OUT, JSON.stringify(crosswalk, null, 2))
writeFileSync(REVIEW_OUT, JSON.stringify({ ambiguous, noMatch }, null, 2))

const total = nbaName.size
const matched = Object.keys(crosswalk).length
console.log(`NBA universe:          ${total}`)
console.log(`bref universe:         ${brefName.size}`)
console.log(`auto-matched (1:1):    ${matched}  (${((matched / total) * 100).toFixed(1)}%)`)
console.log(`ambiguous (review):    ${ambiguous.length}`)
console.log(`no-match (review):     ${noMatch.length}`)
console.log(`\nwrote ${CROSSWALK_OUT} and ${REVIEW_OUT}`)
