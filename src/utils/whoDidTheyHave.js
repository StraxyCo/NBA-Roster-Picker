import { teamSeasonKeys } from './teammateChain.js'
import { normalizeName, nameIncludes } from './normalizeName.js'

// The autocomplete only filters once this many letters have been typed.
export const MIN_QUERY = 3

/** Player search over the whole careers list — same shape as Teammate Chain's. */
export function searchPlayers(allPlayers, query) {
  const q = normalizeName(query)
  if (q.length < MIN_QUERY) return []
  return allPlayers.filter(p => nameIncludes(p.name, q)).slice(0, 20)
}

/**
 * Every player who counts as having played for a team-season: the roster from
 * rosters.json, plus anyone whose careers.json record puts them on that
 * franchise that season (mid-season signings, 10-day deals, and the odd
 * team-season rosters.json has no slice for at all).
 */
export function teamSeasonRoster(teamId, season, roster, careers) {
  const byId = new Map((roster || []).map(p => [String(p.id), { id: String(p.id), name: p.name }]))
  const key = `${teamId}:${season}`
  for (const [id, data] of Object.entries(careers || {})) {
    if (byId.has(String(id))) continue
    if (teamSeasonKeys(id, careers).has(key)) byId.set(String(id), { id: String(id), name: data.name })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Is this player on the team-season's roster (as built by `teamSeasonRoster`)? */
export function playedFor(playerId, roster) {
  return (roster || []).some(p => String(p.id) === String(playerId))
}
