// node scripts/fetch-allstars.mjs                   → fetch all-star rosters for all seasons
// node scripts/fetch-allstars.mjs --season 2023-24  → fetch/refresh one season

import { writeFileSync, readFileSync, existsSync } from 'fs'

const ALLSTARS_OUT = 'public/allstars.json'

const ALL_SEASONS = [
  '2005-06','2006-07','2007-08','2008-09','2009-10',
  '2010-11','2011-12','2012-13','2013-14','2014-15',
  '2015-16','2016-17','2017-18','2018-19','2019-20',
  '2020-21','2021-22','2022-23','2023-24','2024-25',
]

// NBA assigns specific team IDs to All-Star conferences each year.
// These are the "league" team IDs used for All-Star rosters.
const ALLSTAR_TEAM_IDS = {
  east: '1610612759', // Eastern Conference All-Stars (varies; NBA uses fixed IDs)
  west: '1610612760', // Western Conference All-Stars
}

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

// Strategy 1: Use NBA stats leaguegamelog for All-Star game type, then pull box scores
async function fetchAllStarRosterViaGameLog(season) {
  // Get all All-Star game IDs for this season
  const logUrl = `https://stats.nba.com/stats/leaguegamelog?Season=${season}&SeasonType=All+Star&LeagueID=00&Direction=DESC&PlayerOrTeam=T&Sorter=DATE`
  const logRes = await fetch(logUrl, { headers: NBA_HEADERS })
  if (!logRes.ok) throw new Error(`GameLog HTTP ${logRes.status}`)
  const logData = await logRes.json()

  const logSet = logData.resultSets?.[0]
  if (!logSet?.rowSet?.length) throw new Error('No All-Star games found')

  const h = logSet.headers
  // Find the actual All-Star game (highest attendance / latest date, not Rising Stars etc.)
  const games = logSet.rowSet.map(row => ({
    gameId:   row[h.indexOf('GAME_ID')],
    teamId:   String(row[h.indexOf('TEAM_ID')]),
    matchup:  row[h.indexOf('MATCHUP')] || '',
    date:     row[h.indexOf('GAME_DATE')] || '',
  }))

  // Pick unique game IDs that look like the main All-Star game (not Celebrity/Rising Stars)
  const uniqueGameIds = [...new Set(games.map(g => g.gameId))]

  const roster = { east: [], west: [] }

  for (const gameId of uniqueGameIds.slice(0, 4)) { // check up to 4 games
    await delay(400)
    const boxUrl = `https://stats.nba.com/stats/boxscoresummaryv2?GameID=${gameId}`
    const boxRes = await fetch(boxUrl, { headers: NBA_HEADERS })
    if (!boxRes.ok) continue
    const boxData = await boxRes.json()

    const lineSet = boxData.resultSets?.find(s => s.name === 'GameSummary')
    if (!lineSet) continue

    // Pull player stats from boxscoretraditionalv2
    await delay(400)
    const statsUrl = `https://stats.nba.com/stats/boxscoretraditionalv2?GameID=${gameId}&StartPeriod=0&EndPeriod=0&RangeType=0&StartRange=0&EndRange=0`
    const statsRes = await fetch(statsUrl, { headers: NBA_HEADERS })
    if (!statsRes.ok) continue
    const statsData = await statsRes.json()

    const playerSet = statsData.resultSets?.find(s => s.name === 'PlayerStats')
    if (!playerSet?.rowSet?.length) continue

    const ph = playerSet.headers
    const players = playerSet.rowSet.map(row => ({
      id:       row[ph.indexOf('PLAYER_ID')],
      name:     row[ph.indexOf('PLAYER_NAME')],
      teamId:   String(row[ph.indexOf('TEAM_ID')]),
      teamAbbr: row[ph.indexOf('TEAM_ABBREVIATION')],
    }))

    if (players.length >= 20) {
      // This looks like the main All-Star game (≥20 players)
      // Assign east/west by which team played — use the first two team IDs found
      const teamIds = [...new Set(players.map(p => p.teamId))]
      const [team1, team2] = teamIds
      roster.east = players.filter(p => p.teamId === team1).map(({ id, name, teamAbbr }) => ({ id, name, teamAbbr }))
      roster.west = players.filter(p => p.teamId === team2).map(({ id, name, teamAbbr }) => ({ id, name, teamAbbr }))
      return roster
    }
  }

  throw new Error('Could not identify main All-Star game from game log')
}

// ── Parse args ───────────────────────────────────────────────────────────────

const seasonArgIdx = process.argv.indexOf('--season')
const TARGET_SEASON = seasonArgIdx !== -1 ? process.argv[seasonArgIdx + 1] : null

if (TARGET_SEASON && !ALL_SEASONS.includes(TARGET_SEASON)) {
  console.error(`❌ Unknown season: "${TARGET_SEASON}". Valid: ${ALL_SEASONS.join(', ')}`)
  process.exit(1)
}

// ── Load existing ────────────────────────────────────────────────────────────

let allstars = existsSync(ALLSTARS_OUT) ? JSON.parse(readFileSync(ALLSTARS_OUT, 'utf8')) : {}

const toFetch = TARGET_SEASON
  ? [TARGET_SEASON]
  : ALL_SEASONS.filter(s => !allstars[s])

console.log(`📂 allstars.json: ${Object.keys(allstars).length} seasons cached`)
console.log(`🔄 To fetch: ${toFetch.length} seasons\n`)

if (toFetch.length === 0) {
  console.log('✅ All seasons already cached. Use --season XXXX-XX to refresh one.')
  process.exit(0)
}

// ── Fetch ────────────────────────────────────────────────────────────────────

let fetched = 0, failed = 0

for (const season of toFetch) {
  process.stdout.write(`  ${season}... `)
  try {
    await delay(600)
    const roster = await fetchAllStarRosterViaGameLog(season)
    allstars[season] = roster
    const total = roster.east.length + roster.west.length
    console.log(`✓ ${total} players (East: ${roster.east.length}, West: ${roster.west.length})`)
    fetched++
  } catch (e) {
    console.log(`✗ ${e.message}`)
    failed++
  }
}

// ── Write ────────────────────────────────────────────────────────────────────

writeFileSync(ALLSTARS_OUT, JSON.stringify(allstars, null, 2))
console.log(`\n✅ Done. Fetched: ${fetched} / Failed: ${failed}`)
console.log(`📝 Written: ${ALLSTARS_OUT} — verify the East/West split, then commit and push.`)
console.log(`\n⚠️  Note: East/West labels are inferred from game team IDs.`)
console.log(`   Open allstars.json and verify a known season (e.g. 2023-24) looks correct.`)
