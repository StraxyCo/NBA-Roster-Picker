// node scripts/build-nickname-meta.mjs
//
// Builds public/nickname-meta.json: bref_id -> { n: <#unique seasons>, seasons: [..] }
// for every nickname player we can bridge to career data, via:
//   nicknames.json (bref_id) -> crosswalk (nba_id) -> careers.json (seasons)
//
// This is the shared-data-layer payoff: the nickname game uses bref ids, season
// data is keyed by nba_id, the crosswalk joins them. Build-time only; ships a tiny
// runtime lookup so the nickname setup screen can filter by seasons-played.

import { readFileSync, writeFileSync } from 'fs'

const nicknames = JSON.parse(readFileSync('public/nicknames.json', 'utf8'))
const crosswalk = JSON.parse(readFileSync('data/crosswalk.json', 'utf8')) // { <nba_id>: { bref_id } }
const careers = JSON.parse(readFileSync('public/careers.json', 'utf8')) // { <nba_id>: { seasons:[{season}] } }

// reverse crosswalk: bref_id -> nba_id
const brefToNba = new Map()
for (const nid of Object.keys(crosswalk)) brefToNba.set(crosswalk[nid].bref_id, Number(nid))

// every distinct bref player referenced by a nickname
const brefIds = new Set()
for (const key of Object.keys(nicknames)) for (const e of nicknames[key]) brefIds.add(e.player_id)

const meta = {}
let covered = 0
for (const bref of brefIds) {
  const nba = brefToNba.get(bref)
  const career = nba != null ? careers[nba] : null
  if (!career) continue
  const seasons = [...new Set((career.seasons || []).map(s => s.season))].sort()
  if (!seasons.length) continue
  meta[bref] = { n: seasons.length, seasons }
  covered++
}

writeFileSync('public/nickname-meta.json', JSON.stringify(meta))
console.log(`nickname players (bref):       ${brefIds.size}`)
console.log(`bridged to career data:        ${covered}  (${((covered / brefIds.size) * 100).toFixed(1)}%)`)
console.log(`no career data (pre-2005 etc): ${brefIds.size - covered}`)
console.log(`wrote public/nickname-meta.json (${(JSON.stringify(meta).length / 1024).toFixed(0)} KB)`)