// node scripts/build-playerdle.mjs
//
// Builds public/playerdle.json — one profile per player for the Playerdle game.
// Assembled from public/careers.json (career box stats, teams, seasons, debut) +
// the grading shards public/grading/<season>.json (position + height). No new scrape.
//
// Profile: { name, position, height, lastTeam, signatureTeam, debutSeason,
//            careerPPG/RPG/APG, topPPG/RPG/APG, seasons[], nSeasons }

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { NBA_TEAMS } from '../src/data/teams.js'

const ABBR_TO_ID = {
  ...Object.fromEntries(NBA_TEAMS.map(t => [t.abbr, String(t.id)])),
  NJN: '4', CHH: '5', NOH: '23', NOK: '23', SEA: '25', VAN: '19',
}
const TEAM = id => NBA_TEAMS.find(t => String(t.id) === String(id))
const CURRENT_SEASON = '2025-26'

// signature-team weights (normalised points / minutes / seasons)
const W = { pts: 0.5, min: 0.3, seasons: 0.2 }

const careers = JSON.parse(readFileSync('public/careers.json', 'utf8'))

// position + height from the most recent shard season a player appears in
const posHeight = new Map() // nba_id -> { position, height }
const shardFiles = readdirSync('public/grading').filter(f => /^\d{4}-\d{2}\.json$/.test(f)).sort()
for (const f of shardFiles) {
  const shard = JSON.parse(readFileSync(`public/grading/${f}`, 'utf8'))
  for (const id of Object.keys(shard.players)) {
    const p = shard.players[id]
    posHeight.set(Number(id), { position: p.pos_bucket ?? null, height: p.height_in ?? null }) // later season overwrites
  }
}

const num = v => (v == null || Number.isNaN(+v) ? 0 : +v)

function buildProfile(id, data) {
  const rows = (data.seasons || []).filter(s => s.season)
  if (!rows.length) return null

  // group by season; the representative row is the combined (TOT) line if traded
  const bySeason = new Map()
  for (const r of rows) {
    if (!bySeason.has(r.season)) bySeason.set(r.season, [])
    bySeason.get(r.season).push(r)
  }
  const repOf = list => list.find(r => r.teamAbbr === 'TOT') || list[0]

  let sumGp = 0, sumPts = 0, sumReb = 0, sumAst = 0
  let topPPG = 0, topRPG = 0, topAPG = 0
  const seasons = [...bySeason.keys()].sort()
  for (const s of seasons) {
    const rep = repOf(bySeason.get(s))
    const gp = num(rep.gp)
    sumGp += gp
    sumPts += num(rep.pts) * gp
    sumReb += num(rep.reb) * gp
    sumAst += num(rep.ast) * gp
    topPPG = Math.max(topPPG, num(rep.pts))
    topRPG = Math.max(topRPG, num(rep.reb))
    topAPG = Math.max(topAPG, num(rep.ast))
  }
  const r1 = x => Math.round(x * 10) / 10
  const careerPPG = sumGp ? r1(sumPts / sumGp) : 0
  const careerRPG = sumGp ? r1(sumReb / sumGp) : 0
  const careerAPG = sumGp ? r1(sumAst / sumGp) : 0

  // per-franchise aggregation (non-TOT rows) for last + signature team
  const franchises = new Map() // id -> { pts, min, seasons:Set }
  for (const r of rows) {
    if (r.teamAbbr === 'TOT') continue
    const fid = ABBR_TO_ID[r.teamAbbr]
    if (!fid) continue
    const gp = num(r.gp)
    const f = franchises.get(fid) || { pts: 0, min: 0, seasons: new Set() }
    f.pts += num(r.pts) * gp
    f.min += num(r.min) * gp
    f.seasons.add(r.season)
    franchises.set(fid, f)
  }
  if (!franchises.size) return null

  // last team: franchise of the last season's biggest-GP non-TOT row
  const lastSeason = seasons[seasons.length - 1]
  const lastRows = bySeason.get(lastSeason).filter(r => r.teamAbbr !== 'TOT' && ABBR_TO_ID[r.teamAbbr])
  lastRows.sort((a, b) => num(b.gp) - num(a.gp))
  const lastFid = lastRows.length ? ABBR_TO_ID[lastRows[0].teamAbbr] : [...franchises.keys()][0]
  const teamInfo = fid => ({ id: Number(fid), abbr: TEAM(fid)?.abbr ?? '?', name: TEAM(fid)?.name ?? '?' })

  // signature team: normalised points/minutes/seasons composite
  const maxP = Math.max(...[...franchises.values()].map(f => f.pts)) || 1
  const maxM = Math.max(...[...franchises.values()].map(f => f.min)) || 1
  const maxS = Math.max(...[...franchises.values()].map(f => f.seasons.size)) || 1
  let sigFid = null, sigScore = -1
  for (const [fid, f] of franchises) {
    const score = W.pts * (f.pts / maxP) + W.min * (f.min / maxM) + W.seasons * (f.seasons.size / maxS)
    if (score > sigScore) { sigScore = score; sigFid = fid }
  }

  const ph = posHeight.get(Number(id)) || { position: null, height: null }
  return {
    name: data.name,
    position: ph.position,
    height: ph.height,
    lastTeam: { ...teamInfo(lastFid), active: lastSeason === CURRENT_SEASON },
    signatureTeam: teamInfo(sigFid),
    debutSeason: seasons[0],
    careerPPG, careerRPG, careerAPG,
    topPPG: r1(topPPG), topRPG: r1(topRPG), topAPG: r1(topAPG),
    seasons,
    nSeasons: seasons.length,
  }
}

const out = {}
let skipped = 0
for (const id of Object.keys(careers)) {
  const prof = buildProfile(id, careers[id])
  if (prof) out[id] = prof
  else skipped++
}

writeFileSync('public/playerdle.json', JSON.stringify(out))
console.log(`players profiled: ${Object.keys(out).length}  (skipped ${skipped})`)
console.log(`with position+height: ${Object.values(out).filter(p => p.position && p.height).length}`)
console.log(`wrote public/playerdle.json (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`)
