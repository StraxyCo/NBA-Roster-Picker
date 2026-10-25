// Derive the current NBA season label from a date. The season opens in October and
// runs into the next calendar year, so Oct–Dec belongs to YYYY-(YY+1) and Jan–Sep to
// (YYYY-1)-YY. Keeps season lists and defaults correct without a yearly code change.
export function getCurrentSeason(date = new Date()) {
  const year = date.getMonth() >= 9 ? date.getFullYear() : date.getFullYear() - 1
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`
}

export const FIRST_SEASON = '2005-06'
export const CURRENT_SEASON = getCurrentSeason()

// Every season from FIRST_SEASON through the current one, oldest first.
export function seasonRange(from = FIRST_SEASON, to = CURRENT_SEASON) {
  const start = Number(from.slice(0, 4))
  const end   = Number(to.slice(0, 4))
  const out = []
  for (let y = start; y <= end; y++) out.push(`${y}-${String((y + 1) % 100).padStart(2, '0')}`)
  return out
}

export const ALL_SEASONS = seasonRange()

// Pseudo-season token: any career season before 2005-06 (the start of our stat data).
// Used by the nickname-game season filter to optionally include pre-2005 legends.
export const PRE_2006 = 'pre-2006'
