// node scripts/fetch-heights.mjs                      → all seasons that have a shard
// node scripts/fetch-heights.mjs --seasons 2015-16,2024-25
//
// Fills players[*].height_in in public/grading/<season>.json from NBA.com
// leaguedashplayerbiostats — ONE request per season, keyed by nba_id.
//
// RUN LOCALLY: needs stats.nba.com reachability (sandboxes / CI often can't reach
// it). Heights are the only NBA.com-sourced field; everything else is bref. Re-running
// scripts/build-grading-data.mjs preserves heights already filled here.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'

const SHARD_DIR = 'public/grading'
const CACHE_DIR = 'data/nba-cache'
const THROTTLE_MS = 2500

const NBA_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://www.nba.com',
  Referer: 'https://www.nba.com/',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}
const delay = ms => new Promise(r => setTimeout(r, ms))

async function biostats(season) {
  const cache = `${CACHE_DIR}/biostats-${season}.json`
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'))
  const url = `https://stats.nba.com/stats/leaguedashplayerbiostats?LeagueID=00&Season=${season}&SeasonType=Regular+Season&PerMode=PerGame`
  console.log(`  fetch ${season}`)
  const res = await fetch(url, { headers: NBA_HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${season}`)
  const data = await res.json()
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(cache, JSON.stringify(data))
  await delay(THROTTLE_MS)
  return data
}

function heightMap(data) {
  const rs = data.resultSets?.[0]
  if (!rs) return {}
  const h = rs.headers
  const idIdx = h.indexOf('PLAYER_ID')
  const htIdx = h.indexOf('PLAYER_HEIGHT_INCHES')
  const m = {}
  for (const row of rs.rowSet) {
    const id = row[idIdx]
    const ht = row[htIdx]
    if (id != null && ht != null && ht > 0) m[String(id)] = ht
  }
  return m
}

const args = process.argv.slice(2)
const si = args.indexOf('--seasons')
const seasons = si !== -1 && args[si + 1]
  ? args[si + 1].split(',')
  : readdirSync(SHARD_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).sort()

console.log(`Filling heights for: ${seasons.join(', ')}`)
for (const season of seasons) {
  const shardPath = `${SHARD_DIR}/${season}.json`
  if (!existsSync(shardPath)) { console.log(`  ${season}: no shard, skip`); continue }
  const hmap = heightMap(await biostats(season))
  const shard = JSON.parse(readFileSync(shardPath, 'utf8'))
  let filled = 0
  const total = Object.keys(shard.players).length
  for (const id of Object.keys(shard.players)) {
    if (hmap[id]) { shard.players[id].height_in = hmap[id]; filled++ }
  }
  writeFileSync(shardPath, JSON.stringify(shard))
  console.log(`  ${season}: ${filled}/${total} heights filled`)
}
console.log('done.')
