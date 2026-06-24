import { NBA_TEAMS } from '../data/teams.js'

// Map team abbreviations (as they appear in careers.json) to NBA_TEAMS franchise id
// strings. Relocations collapse to the current franchise so a team-season is stable.
const ABBR_TO_ID = {
  ...Object.fromEntries(NBA_TEAMS.map(t => [t.abbr, String(t.id)])),
  NJN: '4', CHH: '5', NOH: '23', NOK: '23', SEA: '25', VAN: '19',
}
const teamName = id => NBA_TEAMS.find(t => String(t.id) === String(id))?.name ?? id

// A player's distinct team-seasons → Map<"<franchiseId>:<season>", {teamId, season, teamName, key}>
function teamSeasons(playerId, careers) {
  const c = careers[String(playerId)]
  const m = new Map()
  if (!c) return m
  for (const { season, teamAbbr } of c.seasons) {
    if (teamAbbr === 'TOT') continue
    const teamId = ABBR_TO_ID[teamAbbr]
    if (!teamId) continue
    const key = `${teamId}:${season}`
    if (!m.has(key)) m.set(key, { teamId, season, teamName: teamName(teamId), key })
  }
  return m
}

// Team-seasons two players shared (= they were teammates), as a Map keyed like above.
function sharedTeamSeasons(aId, bId, careers) {
  const a = teamSeasons(aId, careers)
  const b = teamSeasons(bId, careers)
  const out = new Map()
  for (const [k, v] of a) if (b.has(k)) out.set(k, v)
  return out
}

// Does the chain player have any team-season OUTSIDE the excluded set? If not, the
// exclusion would dead-end them, so it gets lifted for this round.
export function hasAvailableOutside(playerId, careers, excludedKeys) {
  if (!excludedKeys || excludedKeys.size === 0) return true
  for (const k of teamSeasons(playerId, careers).keys()) if (!excludedKeys.has(k)) return true
  return false
}

// The team-seasons currently excluded for the chain player (for UI display).
export function excludedConnections(excludedKeys, careers, chainPlayerId) {
  if (!excludedKeys || excludedKeys.size === 0) return []
  // Only show excluded team-seasons the chain player actually has (relevant ones).
  const ts = teamSeasons(chainPlayerId, careers)
  const out = []
  for (const k of excludedKeys) if (ts.has(k)) out.push(ts.get(k))
  return out
}

/**
 * Validate `candidate` as the next teammate of `chainPlayer`.
 *
 * Rule: the team-season(s) that justified the PREVIOUS link (`excludedKeys`) are
 * consumed — the new link must use a different team-season, and a candidate who was
 * a teammate within any excluded team-season is banned (they're "the same team+seasons
 * as the previous link"). Exception: if every team-season of the chain player is in the
 * excluded set (excluding it would leave no way to continue), the exclusion is lifted.
 *
 * Returns { connections:[{teamId,season,teamName,key}], exceptionApplied } or null.
 */
export function validatePick(chainPlayerId, candidateId, careers, excludedKeys = new Set(), applyConstraint = true) {
  const shared = sharedTeamSeasons(chainPlayerId, candidateId, careers)
  if (shared.size === 0) return null // never teammates

  if (!applyConstraint || excludedKeys.size === 0) {
    return { connections: [...shared.values()], exceptionApplied: false }
  }

  // Exception: lift the exclusion if the chain player has nothing outside it.
  const lift = !hasAvailableOutside(chainPlayerId, careers, excludedKeys)
  if (lift) {
    return { connections: [...shared.values()], exceptionApplied: true }
  }

  // The link must connect via a non-excluded team-season…
  const validShared = [...shared.values()].filter(v => !excludedKeys.has(v.key))
  if (validShared.length === 0) return null

  // …and the candidate must not have played on ANY excluded team-season.
  const candidateTS = teamSeasons(candidateId, careers)
  for (const k of excludedKeys) if (candidateTS.has(k)) return null

  return { connections: validShared, exceptionApplied: false }
}

/** Distinct ids of players who have been an All-Star at least once. */
export function allStarIds(allstars) {
  const ids = new Set()
  if (!allstars) return ids
  for (const season of Object.values(allstars)) {
    for (const p of [...(season.east || []), ...(season.west || [])]) ids.add(String(p.id))
  }
  return ids
}

/**
 * Pick a random starting player from careers.json.
 * Prefers players with seasons in the available rosters (post-2005).
 * When `allowedIds` is a non-empty set, only those players are eligible
 * (used to start the chain on a former All-Star).
 */
export function pickStartingPlayer(careers, rosters, allowedIds = null) {
  const rosterSeasons = new Set(Object.keys(rosters))
  const restrict = allowedIds && allowedIds.size > 0
  const eligible = Object.entries(careers).filter(([id, d]) =>
    (!restrict || allowedIds.has(String(id))) &&
    d.seasons.some(s => rosterSeasons.has(s.season) && s.teamAbbr !== 'TOT')
  )
  if (!eligible.length) return null
  const [id, data] = eligible[Math.floor(Math.random() * eligible.length)]
  return { id, name: data.name }
}

/** Player search — same pattern as Who's That Guy */
export function getAllPlayers(careers) {
  return Object.entries(careers)
    .map(([id, d]) => ({ id, name: d.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function filterPlayers(allPlayers, query) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  return allPlayers.filter(p => p.name.toLowerCase().includes(q)).slice(0, 20)
}
