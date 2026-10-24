// Who counts as a "team leader" candidate.
//
// A player has to have played half his team's games. The NBA's own per-game
// leaderboard bar is stricter (58 of 82, ~70%), but that is built for a
// league-wide leaderboard: applied to a single team it greys out any star who
// missed a third of the season, and those are exactly the players you would
// guess. Half a season keeps them in while still cutting the two-way and
// 10-day signings.
//
// The bar scales with the schedule length, taken from the roster slice itself,
// so lockout and bubble seasons — and the season currently in progress — are
// judged on the games that actually exist.

export const MIN_GAMES_SHARE = 0.5

const FULL_SEASON_GAMES = 82

// Guarantee a usable pool even when a roster slice is thin or its games are
// missing from the source data.
const MIN_ELIGIBLE_PLAYERS = 5

export function seasonGameCount(roster) {
  const maxGp = roster.reduce((max, p) => Math.max(max, p.gp ?? 0), 0)
  return maxGp > 0 ? Math.min(maxGp, FULL_SEASON_GAMES) : FULL_SEASON_GAMES
}

export function minGamesForLeaders(roster) {
  return Math.ceil(seasonGameCount(roster) * MIN_GAMES_SHARE)
}

export function getEligibility(roster) {
  const minGames = minGamesForLeaders(roster)
  let eligible = roster.filter(p => (p.gp ?? 0) >= minGames)

  if (eligible.length < MIN_ELIGIBLE_PLAYERS) {
    eligible = [...roster]
      .sort((a, b) => (b.gp ?? 0) - (a.gp ?? 0) || (b.min ?? 0) - (a.min ?? 0))
      .slice(0, MIN_ELIGIBLE_PLAYERS)
  }

  return { minGames, eligible, eligibleIds: new Set(eligible.map(p => p.id)) }
}
