// Portraits for players the NBA CDN has no headshot for.
//
// cdn.nba.com answers 200 for every id but serves a grey silhouette for 488 of the
// 2061 players in rosters.json — overwhelmingly those who retired before ~2014. That
// excluded Jason Kidd, Shawn Marion, Carlos Boozer, Lamar Odom, Rashard Lewis and
// Richard Hamilton from the face-guessing pool outright. See ./missingHeadshots.js.
//
// 357 of those 488 are covered here, by recognizability tier:
//   star 3/3, starter 15/16, rotation 25/25, fringe 72/78, deepBench 242/366
//
// The files are committed under public/media/headshots/ rather than hotlinked, so
// nothing breaks when a CDN rotates its paths — Basketball-Reference's image path
// carries a date stamp that does exactly that. Historical players' portraits never
// change, so this is fetched once and frozen, like ./pre2005Seasons.js.
//
// Sourced 2026-10-26 by resolving each player's Wikidata item from its NBA.com
// player id (property P3647), then reading the ESPN (P3685) and
// Basketball-Reference (P2685) ids from it. Keying off stored ids rather than
// matching names matters: 25 of these names carry diacritics and 118 contain a
// period, apostrophe or hyphen.
//
// Regenerate by re-resolving those ids, fetching
//   https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/<espnId>.png&w=700&h=510
//   https://www.basketball-reference.com/req/<stamp>/images/headshots/<bbrefId>.jpg
// (the <stamp> segment rotates; read it off a live player page), then letterboxing
// each into 480x350 WebP. ESPN cutouts already sit at that aspect ratio;
// Basketball-Reference serves tall portraits, which must be letterboxed rather than
// cropped or the top of the head is lost.
//
// Both sources are all-rights-reserved press portraits, credited in CREDITS below
// and surfaced in the UI — the same posture the app already takes towards the
// cdn.nba.com headshots it shows in its other games.

// ESPN player cutouts: standardised, transparent-background, head-and-shoulders.
const ESPN_IDS = [
  436, 467, 703, 711, 965, 979, 1088, 1499, 1519, 1533,
  1536, 1712, 1716, 1730, 1733, 1740, 1752, 1853, 1885, 1888,
  1890, 1894, 1902, 1905, 1922, 1952, 2035, 2038, 2039, 2041,
  2047, 2048, 2050, 2052, 2059, 2060, 2063, 2067, 2072, 2073,
  2078, 2109, 2124, 2198, 2202, 2203, 2205, 2209, 2215, 2217,
  2222, 2229, 2230, 2239, 2243, 2246, 2248, 2254, 2260, 2294,
  2306, 2404, 2407, 2408, 2429, 2430, 2431, 2436, 2441, 2443,
  2457, 2501, 2545, 2552, 2553, 2554, 2556, 2557, 2562, 2566,
  2567, 2568, 2575, 2584, 2586, 2624, 2648, 2679, 2740, 2742,
  2753, 2767, 2768, 2788, 2810, 101113, 101115, 101120, 101121, 101124,
  101126, 101128, 101130, 101131, 101132, 101142, 101144, 101154, 101155, 101183,
  101194, 101204, 101211, 101214, 101215, 200747, 200748, 200749, 200750, 200758,
  200761, 200764, 200767, 200769, 200772, 200777, 200778, 200780, 200783, 200789,
  200792, 200796, 200809, 200814, 200817, 200822, 200839, 200984, 201041, 201141,
  201151, 201153, 201154, 201157, 201159, 201161, 201169, 201173, 201175, 201178,
  201182, 201187, 201189, 201193, 201199, 201203, 201207, 201208, 201238, 201242,
  201274, 201336, 201570, 201576, 201590, 201591, 201595, 201602, 201607, 201611,
  201616, 201623, 201632, 201633, 201785, 201814, 201934, 201938, 201944, 201947,
  201953, 201957, 201958, 201963, 201964, 201966, 201970, 201972, 201974, 201979,
  201981, 201985, 201986, 201991, 201998, 202077, 202081, 202082, 202091, 202132,
  202148, 202178, 202220, 202221, 202227, 202238, 202333, 202342, 202345, 202346,
  202350, 202351, 202354, 202356, 202358, 202361, 202363, 202364, 202365, 202366,
  202371, 202374, 202376, 202377, 202378, 202380, 202382, 202386, 202392, 202396,
  202406, 202408, 202412, 202686, 202698, 202701, 202706, 202707, 202715, 202716,
  202717, 202723, 202724, 202727, 202729, 202809, 202952, 202962, 202970, 203006,
  203091, 203097, 203102, 203104, 203106, 203108, 203116, 203117, 203119, 203126,
  203129, 203136, 203139, 203144, 203158, 203159, 203162, 203197, 203318, 203479,
  203480, 203491, 203495, 203513, 203517, 203539, 203540, 203543, 203544, 203545,
  203561, 203955, 204054, 204065, 1628221, 1629091, 1630994, 1642379,
]

// Basketball-Reference portraits, used only where ESPN has none. A mix of studio
// headshots and tightly cropped game photography, so they are less uniform.
const BBREF_IDS = [
  109, 239, 243, 278, 283, 361, 384, 452, 458, 673,
  677, 714, 727, 788, 911, 923, 958, 960, 962, 976,
  990, 1425, 1506, 1513, 1517, 1541, 1559, 1709, 1720, 1723,
  1744, 1763, 1800, 1904, 1913, 1960, 2031, 2033, 2036, 2046,
  2049, 2054, 2056, 2058, 2098, 2137, 2366, 2693, 2739, 2779,
  101153, 101158, 101177, 101189, 200753, 200766, 200776, 201165, 201172, 201234,
  202622, 202731, 203317, 1628249, 1628656, 1628681, 1628935, 1629353, 1629541,
]

export const CREDITS = [
  { source: 'espn', label: 'ESPN', url: 'https://www.espn.com/nba/players' },
  { source: 'bbref', label: 'Basketball-Reference',
    url: 'https://www.basketball-reference.com/' },
]

const SOURCE_BY_ID = new Map([
  ...ESPN_IDS.map(id => [id, 'espn']),
  ...BBREF_IDS.map(id => [id, 'bbref']),
])

/** True when a backfilled portrait is committed for this player. */
export function hasBackfilledHeadshot(id) {
  return SOURCE_BY_ID.has(Number(id))
}

/** Where the backfilled portrait came from, or null if there isn't one. */
export function headshotSource(id) {
  return SOURCE_BY_ID.get(Number(id)) ?? null
}

/** Path to the committed portrait, or null when the CDN should be used instead. */
export function backfilledHeadshotUrl(id) {
  return hasBackfilledHeadshot(id) ? `/media/headshots/${Number(id)}.webp` : null
}

/** The portrait to show for any player: the backfill first, else the NBA CDN. */
export function headshotUrl(id) {
  return backfilledHeadshotUrl(id) ?? `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`
}
