// Player-name normalization for search and answer matching.
//
// Roster data stores names exactly as spelled (Nikola Vučević, Luka Dončić),
// but players type ASCII. Every name comparison in the app runs both sides
// through `normalizeName` so "Donc" finds Dončić and "Nikola Vucevic" counts
// as correct.

// Letters that don't decompose under NFD and so survive the diacritic strip.
const SPECIAL_LETTERS = {
  'đ': 'd', 'Đ': 'd',
  'ð': 'd', 'Ð': 'd',
  'ø': 'o', 'Ø': 'o',
  'ł': 'l', 'Ł': 'l',
  'ß': 'ss',
  'æ': 'ae', 'Æ': 'ae',
  'œ': 'oe', 'Œ': 'oe',
  'þ': 'th', 'Þ': 'th',
}

export function normalizeName(str) {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐðÐøØłŁßæÆœŒþÞ]/g, c => SPECIAL_LETTERS[c])
    .toLowerCase()
    .trim()
}

/** True when `query` appears anywhere in `name`, ignoring accents and case. */
export function nameIncludes(name, normalizedQuery) {
  return normalizeName(name).includes(normalizedQuery)
}

/** True when two names are the same player, ignoring accents, case and padding. */
export function namesMatch(a, b) {
  return normalizeName(a) === normalizeName(b)
}
