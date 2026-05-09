// node scripts/fetch-careers.mjs                   → fetch careers for all players in rosters.json
// node scripts/fetch-careers.mjs --player 2544     → fetch/refresh one player by NBA ID

import { writeFileSync, readFileSync, existsSync } from 'fs'

const CAREERS_OUT = 'public/careers.json'

const NBA_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchCareer(playerId) {
  const url = `https://stats.nba.com/stats/playercareerstats?PlayerID=${playerId}&PerMode=PerGame&LeagueID=00`
  const res = await fetch(url, { headers: NBA_HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()

  const regularSet = data.resultSets?.find(s => s.name === 'SeasonTotalsRegularSeason')
  if (!regularSet) throw new Error('No SeasonTotalsRegularSeason')

  const h = regularSet.headers
  return regularSet.rowSet.map(row => ({
    season:   row[h.indexOf('SEASON_ID')],
    teamAbbr: row[h.indexOf('TEAM_ABBREVIATION')],
    gp:       row[h.indexOf('GP')]   ?? 0,
    pts:      +(row[h.indexOf('PTS')]  ?? 0).toFixed(1),
    reb:      +(row[h.indexOf('REB')]  ?? 0).toFixed(1),
    ast:      +(row[h.indexOf('AST')]  ?? 0).toFixed(1),
    stl:      +(row[h.indexOf('STL')]  ?? 0).toFixed(1),
    blk:      +(row[h.indexOf('BLK')]  ?? 0).toFixed(1),
    fg3m:     +(row[h.indexOf('FG3M')] ?? 0).toFixed(1),
  }))
}

// ── Parse args ───────────────────────────────────────────────────────────────

const playerArgIdx = process.argv.indexOf('--player')
const SINGLE_PLAYER = playerArgIdx !== -1 ? String(process.argv[playerArgIdx + 1]) : null

// ── Load existing ────────────────────────────────────────────────────────────

const rosters  = JSON.parse(readFileSync('public/rosters.json', 'utf8'))
let   careers  = existsSync(CAREERS_OUT) ? JSON.parse(readFileSync(CAREERS_OUT, 'utf8')) : {}

// Collect all unique player IDs + names from rosters.json
const playerMap = new Map() // id → name
for (const seasonData of Object.values(rosters)) {
  for (const teamPlayers of Object.values(seasonData)) {
    for (const p of (teamPlayers || [])) {
      if (p.id && p.name && !playerMap.has(String(p.id))) {
        playerMap.set(String(p.id), p.name)
      }
    }
  }
}

const toFetch = SINGLE_PLAYER
  ? (playerMap.has(SINGLE_PLAYER) ? [SINGLE_PLAYER] : (() => { console.error(`Player ID ${SINGLE_PLAYER} not found in rosters.json`); process.exit(1) })())
  : [...playerMap.keys()].filter(id => !careers[id])  // skip already-fetched

console.log(`📂 careers.json: ${Object.keys(careers).length} players cached`)
console.log(`👤 Total unique players in rosters.json: ${playerMap.size}`)
console.log(`🔄 To fetch: ${toFetch.length} players\n`)

if (toFetch.length === 0) {
  console.log('✅ All players already cached. Use --player <id> to refresh one.')
  process.exit(0)
}

// ── Fetch ────────────────────────────────────────────────────────────────────

let fetched = 0, failed = 0

for (const id of toFetch) {
  const name = playerMap.get(id) || id
  process.stdout.write(`  ${name} (${id})... `)
  try {
    await delay(500)
    const seasons = await fetchCareer(id)
    careers[id] = { name, seasons }
    console.log(`✓ ${seasons.length} seasons`)
    fetched++

    // Write every 50 players to avoid losing progress on failure
    if (fetched % 50 === 0) {
      writeFileSync(CAREERS_OUT, JSON.stringify(careers))
      console.log(`  💾 Progress saved (${fetched} fetched so far)`)
    }
  } catch (e) {
    console.log(`✗ ${e.message}`)
    failed++
  }
}

// ── Write ────────────────────────────────────────────────────────────────────

writeFileSync(CAREERS_OUT, JSON.stringify(careers))
console.log(`\n✅ Done. Fetched: ${fetched} / Failed: ${failed}`)
console.log(`📝 Written: ${CAREERS_OUT} — commit and push to GitHub.`)
