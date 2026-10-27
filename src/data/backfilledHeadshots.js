// Portraits for players the NBA CDN has no headshot for.
//
// cdn.nba.com answers 200 for every id but serves a grey silhouette for 488 of the
// 2061 players in rosters.json — overwhelmingly those who retired before ~2014. That
// excluded Jason Kidd, Shawn Marion, Carlos Boozer, Lamar Odom, Rashard Lewis and
// Richard Hamilton from the face-guessing pool outright. See ./missingHeadshots.js.
//
// 406 of those 488 are covered here, by recognizability tier:
//   star 3/3, starter 16/16, rotation 25/25, fringe 76/78, deepBench 286/366
//
// The files are committed under public/media/headshots/ rather than hotlinked, so
// nothing breaks when a CDN rotates its paths — Basketball-Reference's image path
// carries a date stamp that does exactly that. Historical players' portraits never
// change, so this is fetched once and frozen, like ./pre2005Seasons.js.
//
// Sourced 2026-10-26 by resolving each player's Wikidata item from its NBA.com
// player id (property P3647), then reading the ESPN (P3685) and
// Basketball-Reference (P2685) ids and the Commons image (P18) from it. Keying off
// stored ids rather than matching names matters: 25 of these names carry diacritics
// and 118 contain a period, apostrophe or hyphen.
//
// Regenerate by re-resolving those ids, fetching
//   https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/<espnId>.png&w=700&h=510
//   https://www.basketball-reference.com/req/<stamp>/images/headshots/<bbrefId>.jpg
//   https://commons.wikimedia.org/wiki/Special:FilePath/<file>?width=1200
// (the <stamp> segment rotates; read it off a live player page), then fitting each
// into 480x350 WebP. ESPN cutouts already sit at that aspect ratio;
// Basketball-Reference serves tall portraits, which must be letterboxed rather than
// cropped or the top of the head is lost; the Commons photos are cropped to the
// detected face, which is also what keeps a jersey nameplate out of frame.

// ESPN player cutouts: standardised, transparent-background, head-and-shoulders.
// Uniform and unambiguous, so these are preferred wherever they exist.
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

// Wikimedia Commons photographs, used only where neither of the above has anything.
// These are action and press photos rather than portraits, so each one was reviewed
// by eye: candidates showing more than one face, a head too small to read, or no
// frontal face at all were rejected rather than shipped. They are also the only
// freely-licensed set here, so each carries its own author and licence below.
const WIKIMEDIA_IDS = [
  441, 970, 1442, 1521, 1729, 1766, 1956, 2212, 2413, 2484,
  2560, 2565, 2573, 2745, 2751, 2857, 101118, 101119, 101134, 101136,
  101137, 101143, 101146, 101149, 101152, 101160, 101180, 101212, 200759, 200763,
  200781, 200785, 200788, 200790, 200810, 200816, 200837, 201174, 201192, 201592,
  201605, 201612, 201629, 201802, 202067, 202070, 202375, 1629341, 1642490,
]

// Per-image attribution, required by the CC licences these are published under.
export const WIKIMEDIA_CREDITS = {
  441: { author: 'Video by Sgt. David Taylor', license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Lamond_Murray.png' },
  970: { author: 'All-Pro Reels', license: 'CC BY-SA 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Othella_Harrington_(51910110377)_(cropped).jpg' },
  1442: { author: 'tvpirot pirot', license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:%D0%96%D0%B5%D1%99%D0%BA%D0%BE_%D0%A0%D0%B5%D0%B1%D1%80%D0%B0%D1%87%D0%B0_2020.png' },
  1521: { author: 'YESNetwork', license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Jacque_Vaughn_(Feb_2024)_03.png' },
  1729: { author: 'Keith Allison from Baltimore, USA', license: 'CC BY-SA 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Ricky_Davis_2007-12-30.jpg' },
  1766: { author: 'Avi kedmi', license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Baston104.JPG' },
  1956: { author: 'David Herrera', license: 'CC BY 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Ira_Newble_2005.jpg' },
  2212: { author: 'U.S. Air Force photo by Denise Willhite', license: 'Public domain',
    page: 'https://commons.wikimedia.org/wiki/File:Steven_Hunter_(161110-F-WV360-001)_(cropped).jpg' },
  2413: { author: 'Keith Allison from Baltimore, USA', license: 'CC BY-SA 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:J_Dixon_-_Wizards_vs_Heat_2009-04-04.jpg' },
  2484: { author: 'Keith Allison', license: 'CC BY-SA 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Devin_Brown.jpg' },
  2560: { author: 'Sakhalinio', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:%C5%BDarko_%C4%8Cabarkapa_Fenerbah%C3%A7e_Basketball_20210913_(1).jpg' },
  2565: { author: 'Hodyachih', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:ZoranPlaninicBCKhimki.jpg' },
  2573: { author: 'Ailura', license: 'CC BY-SA 3.0 at',
    page: 'https://commons.wikimedia.org/wiki/File:20160814_Basketball_%C3%96BV_Vier-Nationen-Turnier_4394.jpg' },
  2745: { author: 'This photo is a work by Artem Korzhimanov . You can find more of my', license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Kirk_Snyder_2011-03-26_(3).JPG' },
  2751: { author: 'Sakhalinio', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Victor_Khryapa_31_PBC_CSKA_Moscow_20171027_(3)_(cropped).jpg' },
  2857: { author: 'Elemaki', license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:AndreBarret.JPG' },
  101118: { author: 'Rikster2', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Sean_May_Paris-Levallois_warm-up.JPG' },
  101119: { author: 'Keith Allison', license: 'CC BY-SA 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Rashad_McCants_in_2007.jpg' },
  101134: { author: 'Elemaki', license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:WayneSimien.jpg' },
  101136: { author: 'Jeramey Jannene', license: 'CC BY 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Salim_Stoudamire.jpg' },
  101137: { author: 'Patryk Chmiel', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Daniel_Ewing.jpg' },
  101143: { author: 'Francesco Canu', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Travis_Diener.JPG' },
  101146: { author: 'shaka', license: 'CC BY-SA 2.0 it',
    page: 'https://commons.wikimedia.org/wiki/File:Roko_Ukic.JPG' },
  101149: { author: 'Christopher Johnson from Tokyo, Japan', license: 'CC BY-SA 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Martynas_Andriuskevicius.jpg_-_La_selecci%C3%B3n_de_Lituania_celebra_su_tercer_puesto_en_el_Mundial_de_baloncesto_2010_(cropped).jpg' },
  101152: { author: 'Elemaki', license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:BraceyW.JPG' },
  101160: { author: 'Rudolf Getel from Novi Sad', license: 'CC BY 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Lawrence_Roberts_Partizan.jpg' },
  101180: { author: 'Zafer', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:%C5%A0ar%C5%ABnas_Jasikevi%C4%8Dius_Fenerbah%C3%A7e_Basketbol_Euroleague_20260925_(2)_(cropped).JPG' },
  101212: { author: 'FrancescoSoliani', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:BatistaVenezia.jpg' },
  200759: { author: 'Ultraslansi', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Cedric_Simmons.JPG' },
  200763: { author: 'Michael Cortina', license: 'CC BY 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Quincy_Douby_2006_Las_Vegas_Summer_League.jpg' },
  200781: { author: 'Keith Allison', license: 'CC BY-SA 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Paul_Davis_Wizards.jpg' },
  200785: { author: 'Elemaki', license: 'CC BY 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:KostaPerovic.jpg' },
  200788: { author: 'Hodyachih', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:James_Augustine_BCKhimki.JPG' },
  200790: { author: 'Fernando Frazão', license: 'CC BY 3.0 br',
    page: 'https://commons.wikimedia.org/wiki/File:Marcus_Vinicius_Rio_2016.jpg' },
  200810: { author: 'shaka', license: 'CC BY-SA 2.0 it',
    page: 'https://commons.wikimedia.org/wiki/File:Allan_Ray.JPG' },
  200816: { author: 'Zafer', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Jorge_Garbajosa_20241002_(1).jpg' },
  200837: { author: 'Bruno Cordioli', license: 'CC BY 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Mike_Hall_(2009).jpg' },
  201174: { author: 'STB-1', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Nick_fazekas.jpg' },
  201192: { author: 'Dotan Doron', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Taurean_Green_Hertzeliya.jpg' },
  201592: { author: 'Niccolò Caranti', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:J.R._Giddens_-_Basket_Brescia_Leonessa_2013.jpg' },
  201605: { author: 'Ultraslansi', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Nathan_Jawai_GS.JPG' },
  201612: { author: 'Ultraslansi', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Malik_Samory_Hairston.JPG' },
  201629: { author: 'Sandro Halank , Wikimedia Commons', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:2022-06-17_ALBA_Berlin_gegen_FC_Bayern_M%C3%BCnchen_(Basketball-Bundesliga_2021-22)_by_Sandro_Halank%E2%80%93044.jpg' },
  201802: { author: 'Coentor', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Oliver_Lafayette.jpg' },
  202067: { author: 'Yaakov2', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Diamon_Simpson.jpg' },
  202070: { author: 'Botend', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Tony_Gaffney_(2).JPG' },
  202375: { author: 'STB-1', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Magnum_Rolle.jpg' },
  1629341: { author: 'Zafer', license: 'CC BY 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Tarik_Phillip_22_London_Lions_MB_EuroCup_20251007_(5).jpg' },
  1642490: { author: 'All-Pro Reels', license: 'CC BY-SA 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Josh_Oduro_2021.jpg' },
}

// Players photographed in a later role rather than as an NBA player. The face is
// the right one, so they stay in the pool, but they are harder than their tier says:
//   Jacque Vaughn — coaching, with a full grey beard he never had as a player
//   Jorge Garbajosa — in a suit, years after retiring
//   Othella Harrington — post-career
//   Sarunas Jasikevicius — coaching in Europe
//   Zeljko Rebraca — post-career
export const LATER_ROLE_IDS = new Set([970, 1442, 1521, 101180, 200816])

export const CREDITS = [
  { source: 'espn', label: 'ESPN', url: 'https://www.espn.com/nba/players' },
  { source: 'bbref', label: 'Basketball-Reference',
    url: 'https://www.basketball-reference.com/' },
  { source: 'wikimedia', label: 'Wikimedia Commons',
    url: 'https://commons.wikimedia.org/' },
]

const SOURCE_BY_ID = new Map([
  ...ESPN_IDS.map(id => [id, 'espn']),
  ...BBREF_IDS.map(id => [id, 'bbref']),
  ...WIKIMEDIA_IDS.map(id => [id, 'wikimedia']),
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

/**
 * What to display as the photo credit, or null for a CDN portrait.
 * Commons images name their photographer and licence; the other two sources are
 * all-rights-reserved press photos, credited to the publication.
 */
export function headshotCredit(id) {
  const source = headshotSource(id)
  if (!source) return null
  const own = WIKIMEDIA_CREDITS[Number(id)]
  if (own) {
    return { source, text: `${own.author} / ${own.license}`, url: own.page }
  }
  const credit = CREDITS.find(c => c.source === source)
  return credit ? { source, text: credit.label, url: credit.url } : null
}
