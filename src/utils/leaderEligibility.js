// Who counts as a "team leader" candidate.
//
// A player needs 30 games. The point is only to throw out the tiny samples —
// the 8-game call-up whose 14 rebounds a night would otherwise make him the
// team leader — not to demand availability. Anything stricter (the NBA's own
// per-game leaderboard bar is 58 of 82) greys out the stars who missed a third
// of the season, and those are exactly the players you would guess.
//
// 30 is deliberately low enough to keep mid-season trades in: once stats are
// split per team, a player dealt at the deadline still has a real sample on
// both sides of the move.

export const MIN_GAMES = 30

const FULL_SEASON_GAMES = 82

// Guarantee a usable pool even when a roster slice is thin or its games are
// missing from the source data.
const MIN_ELIGIBLE_PLAYERS = 5

export function seasonGameCount(roster) {
  const maxGp = roster.reduce((max, p) => Math.max(max, p.gp ?? 0), 0)
  return maxGp > 0 ? Math.min(maxGp, FULL_SEASON_GAMES) : FULL_SEASON_GAMES
}

export function minGamesForLeaders(roster) {
  // Every completed season is long enough for the flat bar; a season still in
  // progress is not, so fall back to half of what has been played.
  return Math.min(MIN_GAMES, Math.ceil(seasonGameCount(roster) / 2))
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
