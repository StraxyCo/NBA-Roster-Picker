// Who counts as a "team leader" candidate.
//
// The obvious rule — the NBA's own per-game leaderboard bar of 58 of 82 games
// — turns out to be wrong for this game: it throws out any star who missed a
// third of the season (Wade's 51-game years, CP3 in 2009-10) while leaving
// most deep-bench players in, since they suit up every night for 10 minutes.
// Total minutes separates the two cleanly, so we qualify on workload instead:
// 1000 minutes, about 12 a night over a full season.
//
// The bar scales with the schedule length, taken from the roster slice itself,
// so lockout and bubble seasons — and the season currently in progress — are
// judged on the games that actually exist.

export const MIN_SEASON_MINUTES = 1000

const FULL_SEASON_GAMES = 82

// Guarantee a usable pool even when a roster slice is thin or its minutes are
// missing from the source data.
const MIN_ELIGIBLE_PLAYERS = 5

function totalMinutes(p) {
  return (p.min ?? 0) * (p.gp ?? 0)
}

export function seasonGameCount(roster) {
  const maxGp = roster.reduce((max, p) => Math.max(max, p.gp ?? 0), 0)
  return maxGp > 0 ? Math.min(maxGp, FULL_SEASON_GAMES) : FULL_SEASON_GAMES
}

export function minMinutesForLeaders(roster) {
  return Math.round(MIN_SEASON_MINUTES * (seasonGameCount(roster) / FULL_SEASON_GAMES))
}

export function getEligibility(roster) {
  const minMinutes = minMinutesForLeaders(roster)
  let eligible = roster.filter(p => totalMinutes(p) >= minMinutes)

  if (eligible.length < MIN_ELIGIBLE_PLAYERS) {
    eligible = [...roster]
      .sort((a, b) => totalMinutes(b) - totalMinutes(a))
      .slice(0, MIN_ELIGIBLE_PLAYERS)
  }

  return {
    minMinutes,
    eligible,
    eligibleIds: new Set(eligible.map(p => p.id)),
    totalMinutes,
  }
}
