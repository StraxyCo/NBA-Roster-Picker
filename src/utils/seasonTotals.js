// rosters.json stores stats PER TEAM: a player traded mid-season has one entry per
// team, each holding only the games he played there. That is what the team-relative
// games want (Team Leaders, the Roster Picker draft, Who Did They Have).
//
// A season-level question — "who averaged more points in 2022-23?" — wants the other
// thing: the full season, across both teams. Picking one entry would show Kevin
// Durant at 8 games and 26.0 for Phoenix and call it his 2022-23.
//
// Rather than storing the full-season line a second time (rosters.json is already
// ~3 MB), those games merge the entries back on demand. Untraded players have a
// single entry, so merging is a no-op for all but a few dozen players a season.

const AVERAGED = ['pts', 'reb', 'ast', 'stl', 'blk', 'min']

// Per-game averages recombine as a mean weighted by games played; fg3m and gp are
// season totals and simply add up.
export function mergeSeasonEntries(entries) {
  if (entries.length === 1) return entries[0]

  const withGames = entries.filter(e => (e.gp ?? 0) > 0)
  // Nobody played: these are roster members with no stat line. Keep the first as-is.
  if (withGames.length === 0) return entries[0]
  if (withGames.length === 1) return withGames[0]

  const totalGp = withGames.reduce((sum, e) => sum + e.gp, 0)
  // Identity (name, position, jersey) comes from the longest stint — the team the
  // player is most recognisable on that season, and the one whose entry carries a
  // jersey number when the other was a team he was traded away from.
  const main = withGames.reduce((best, e) => (e.gp > best.gp ? e : best), withGames[0])

  const merged = { ...main, gp: totalGp }
  for (const key of AVERAGED) {
    const weighted = withGames.reduce((sum, e) => sum + (e[key] ?? 0) * e.gp, 0)
    merged[key] = +(weighted / totalGp).toFixed(1)
  }
  merged.fg3m = withGames.reduce((sum, e) => sum + (e.fg3m ?? 0), 0)
  return merged
}

// Every player in a season as one full-season line each, name-sorted.
export function getSeasonPlayers(rostersData, season) {
  const seasonData = (rostersData || {})[season] || {}
  const byPlayer = new Map()
  for (const teamPlayers of Object.values(seasonData)) {
    for (const p of (teamPlayers || [])) {
      const key = String(p.id)
      if (!byPlayer.has(key)) byPlayer.set(key, [])
      byPlayer.get(key).push(p)
    }
  }
  return [...byPlayer.values()].map(mergeSeasonEntries)
}
