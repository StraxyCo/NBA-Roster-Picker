// Who counts as a "team leader" candidate.
//
// The NBA requires a player to appear in 58 of 82 games (~70% of the schedule)
// before he shows up on the per-game leaderboards. We apply the same share, but
// derive the schedule length from the roster itself so lockout and bubble
// seasons (66, 72 games…) scale down instead of wiping out every candidate.

export const MIN_GAMES_SHARE = 0.7

const FULL_SEASON_GAMES = 82

// Guarantee a usable pool even when a roster slice has almost no complete
// seasons (mid-season trades, incomplete historical data).
const MIN_ELIGIBLE_PLAYERS = 5

export function seasonGameCount(roster) {
  const maxGp = roster.reduce((max, p) => Math.max(max, p.gp ?? 0), 0)
  return maxGp > 0 ? Math.min(maxGp, FULL_SEASON_GAMES) : FULL_SEASON_GAMES
}

export function minGamesForLeaders(roster) {
  return Math.ceil(seasonGameCount(roster) * MIN_GAMES_SHARE)
}

export function getEligibility(roster) {
  const threshold = minGamesForLeaders(roster)
  let eligible = roster.filter(p => (p.gp ?? 0) >= threshold)

  if (eligible.length < MIN_ELIGIBLE_PLAYERS) {
    eligible = [...roster]
      .sort((a, b) => (b.gp ?? 0) - (a.gp ?? 0) || (b.min ?? 0) - (a.min ?? 0))
      .slice(0, MIN_ELIGIBLE_PLAYERS)
  }

  const minGames = eligible.length
    ? Math.min(threshold, ...eligible.map(p => p.gp ?? 0))
    : threshold

  return { minGames, eligible, eligibleIds: new Set(eligible.map(p => p.id)) }
}
