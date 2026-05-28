import { NBA_TEAMS } from '../data/teams.js'

// Map team abbreviations (as they appear in careers.json) to NBA_TEAMS id strings
const ABBR_TO_ID = {
  ...Object.fromEntries(NBA_TEAMS.map(t => [t.abbr, String(t.id)])),
  NJN: '4', CHH: '5', NOH: '23', NOK: '23', SEA: '25',
}

/**
 * Find a teammate connection between two players.
 * Returns { season, teamAbbr, teamName } if they played together, else null.
 * If excludeTeamAbbr is set, connections through that franchise are skipped.
 */
export function findTeammateConnection(playerAId, playerBId, careers, rosters, excludeTeamAbbr = null) {
  const careerA = careers[String(playerAId)]
  if (!careerA) return null

  for (const { season, teamAbbr } of careerA.seasons) {
    if (teamAbbr === 'TOT') continue

    // Apply "no same team" constraint
    if (excludeTeamAbbr) {
      // Resolve both to a canonical franchise id
      const excludeId = ABBR_TO_ID[excludeTeamAbbr]
      const currentId = ABBR_TO_ID[teamAbbr]
      if (currentId && excludeId && currentId === excludeId) continue
    }

    const teamId = ABBR_TO_ID[teamAbbr]
    if (!teamId) continue
    const roster = rosters[season]?.[teamId]
    if (!roster) continue

    if (roster.some(p => String(p.id) === String(playerBId))) {
      const team = NBA_TEAMS.find(t => String(t.id) === teamId)
      return { season, teamAbbr, teamName: team?.name ?? teamAbbr }
    }
  }
  return null
}

/**
 * Pick a random starting player from careers.json.
 * Prefers players with seasons in the available rosters (post-2005).
 */
export function pickStartingPlayer(careers, rosters) {
  const rosterSeasons = new Set(Object.keys(rosters))
  const eligible = Object.entries(careers).filter(([, d]) =>
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
