import { preRosterSeasons } from '../data/pre2005Seasons'
import { hasRealHeadshot } from '../data/missingHeadshots'
import { eraAdjustedMinutes } from '../data/minutesEra'

// Scores how likely an NBA fan is to recognize a player, from minutes alone.
//
// Face-guessing rounds get progressively harder, so the pool needs an ordering by
// fame. Career totals are a poor proxy: summed minutes reward journeymen (Trevor
// Ariza outranked Klay Thompson) and bury short-peak stars. Instead each season
// earns points from a graduated minutes ladder, so one 38-minute season is worth
// more than four 20-minute ones, and the points accumulate over a career.
// Longevity and prominence both count, prominence more steeply.
//
// Minutes are era-adjusted first — see data/minutesEra.js. Without that the ladder
// is calibrated to an era that no longer exists and every modern star is taxed.

// Era-adjusted minutes per game -> points for that season. Roughly geometric, so
// there is no cliff a player can straddle, and starter minutes dominate bench ones.
export const MINUTE_BRACKETS = [
  [38, 28],
  [36, 22],
  [34, 17],
  [32, 13],
  [30, 10],
  [28, 7.5],
  [26, 5.5],
  [24, 4],
  [22, 3],
  [20, 2.2],
  [17, 1.4],
  [14, 0.9],
  [10, 0.5],
  [5, 0.2],
  [0, 0.05],
]

// A season counts in full once a player appears in this many games. Below it the
// award is prorated, so 36 minutes across 4 games does not read as stardom.
const FULL_SEASON_GAMES = 50

export function bracketPoints(eraAdjustedMpg) {
  for (const [floor, points] of MINUTE_BRACKETS) {
    if (eraAdjustedMpg >= floor) return points
  }
  return 0
}

/** Points a single season row contributes. */
export function seasonExposure(p) {
  const min = p.min ?? 0
  const gp = p.gp ?? 0
  if (min <= 0 || gp <= 0) return 0
  return bracketPoints(eraAdjustedMinutes(p.season, min)) * Math.min(1, gp / FULL_SEASON_GAMES)
}

/** Summed exposure across every season a player appears in. */
export function recognizabilityScore(seasonRows) {
  return seasonRows.reduce((total, p) => total + seasonExposure(p), 0)
}

// Score floors per tier, easiest first. Tier 1 is drawn in round 1 and each round
// steps down, so a miss costs the player the round their opponent survived.
//
// Calibrated against the era-adjusted, pre-2005-backfilled pool. The floors are
// not independently meaningful: they are percentile landmarks of this scoring, and
// changing the ladder or the backfill moves all of them at once.
// The top two bands are deliberately one tier. Separating them bought nothing: an
// `icon` round splits two decent fans about 2% of the time and a `superstar` round
// 13%, so both are warm-up, and spending two tiers on them only delayed the rounds
// that decide the game.
export const TIERS = [
  { key: 'icon',      label: 'Icon',       min: 205 },
  { key: 'star',      label: 'Star',       min: 130 },
  { key: 'starter',   label: 'Starter',    min: 65 },
  { key: 'rotation',  label: 'Rotation',   min: 25 },
  { key: 'fringe',    label: 'Fringe',     min: 5 },
  { key: 'deepBench', label: 'Deep bench', min: 0 },
]

export function tierOf(score) {
  return TIERS.find(t => score >= t.min) ?? TIERS[TIERS.length - 1]
}

// Players whose fame outruns their minutes, as a floor on the tier they may fall to.
//
// This is the one place the model admits defeat. Minutes measure exposure, and
// exposure is a good proxy for fame only once a career has accumulated. A player
// drafted first overall into instant stardom has the face of a superstar and the
// minutes log of a sophomore: Wembanyama scores 36, which is "rotation", because
// three seasons at 29-33 minutes is all there is to count. No weighting of minutes
// reaches him — peak-average scoring puts Joe Johnson first overall, and recency
// weighting lifts long-serving starters like Lowry and Beal above Jokic and Giannis.
//
// So these are editorial, keyed by player id, and meant to be edited. Fame that the
// box score cannot see belongs in a list a human maintains, not in a formula
// contorted until it happens to agree.
export const TIER_FLOORS = {
  1641705: 'icon',      // Victor Wembanyama
  1630162: 'icon',      // Anthony Edwards
  1629029: 'icon',      // Luka Doncic
  203999:  'icon',      // Nikola Jokic
  203507:  'icon',      // Giannis Antetokounmpo
  1628369: 'icon',      // Jayson Tatum
  1628983: 'icon',      // Shai Gilgeous-Alexander
  // These five sat in the old `superstar` band, which is now part of `icon`, so the
  // merge promotes them to the top tier along with it.
  1630169: 'icon',      // Tyrese Haliburton
  1629627: 'icon',      // Zion Williamson
  1629630: 'icon',      // Ja Morant
  203954:  'icon',      // Joel Embiid
  1628378: 'icon',      // Donovan Mitchell
}

const TIER_RANK = new Map(TIERS.map((t, i) => [t.key, i]))

/** The earned tier, raised to the player's floor when one is set. */
export function tierForPlayer(id, score) {
  const earned = tierOf(score).key
  const floor = TIER_FLOORS[id]
  if (!floor) return earned
  return TIER_RANK.get(floor) < TIER_RANK.get(earned) ? floor : earned
}

// Collapses `rosters.json` (season -> team -> players[]) into one entry per player,
// scored over their whole career.
//
// Two things make a career "whole" here. Scoring spans every season even when a game
// only shows recent ones, because Carmelo Anthony's fame was earned before 2015 and a
// 2015-onward score would file him as a mere "star". And seasons predating the file
// are merged in from PRE_2005_SEASONS, without which anyone who debuted before
// 2005-06 is scored on the tail of their career.
export function buildPlayerIndex(rosters) {
  const byId = new Map()
  for (const season of Object.keys(rosters)) {
    for (const team of Object.keys(rosters[season])) {
      for (const p of rosters[season][team]) {
        let entry = byId.get(p.id)
        if (!entry) {
          entry = { id: p.id, name: p.name, seasons: [], score: 0 }
          byId.set(p.id, entry)
        }
        entry.seasons.push({ season, team, ...p })
      }
    }
  }
  for (const entry of byId.values()) {
    const seasons = [...preRosterSeasons(entry.id), ...entry.seasons]
    entry.score = recognizabilityScore(seasons)
    entry.tier = tierForPlayer(entry.id, entry.score)
    entry.hasPhoto = hasRealHeadshot(entry.id)
  }
  return byId
}

/** The players a face-guessing game may draw: real portrait, scored and tiered. */
export function guessablePlayers(rosters) {
  return [...buildPlayerIndex(rosters).values()].filter(p => p.hasPhoto)
}

/** Players grouped by tier key, each list sorted most-recognizable first. */
export function groupByTier(players) {
  const groups = Object.fromEntries(TIERS.map(t => [t.key, []]))
  for (const p of players) groups[p.tier].push(p)
  for (const list of Object.values(groups)) list.sort((a, b) => b.score - a.score)
  return groups
}
