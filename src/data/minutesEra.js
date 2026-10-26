// League minutes baseline per season: the mean MPG of the five most-used
// rotation players (40+ games) that year.
//
// Workloads have fallen sharply. The busiest players averaged 42.0 minutes in
// 2005-06 and 36.6 in 2025-26, so identical prominence earns very different raw
// minutes depending on era. Scoring raw MPG taxes every modern player: it filed
// Stephen Curry, who never led the league in minutes, below journeymen who did.
// Dividing by the season baseline makes a workload mean "how heavily used, for
// its time".
//
// Computed from rosters.json (all 30 rosters, 2005-06 to 2025-26).

export const PRE_2005_BASELINE = 41.0  // 1990-2004 sat at 40-42; our sample there is stars-only

// The scale era-adjusted minutes are expressed on, so the bracket ladder keeps
// reading in familiar MPG units rather than ratios.
export const REFERENCE_MINUTES = 40.0

export const SEASON_MINUTES_BASELINE = {
  '2005-06': 42.0,
  '2006-07': 41.18,
  '2007-08': 40.56,
  '2008-09': 39.24,
  '2009-10': 40.12,
  '2010-11': 39.54,
  '2011-12': 38.76,
  '2012-13': 38.56,
  '2013-14': 38.42,
  '2014-15': 36.84,
  '2015-16': 36.98,
  '2016-17': 37.32,
  '2017-18': 36.7,
  '2018-19': 36.48,
  '2019-20': 36.54,
  '2020-21': 36.66,
  '2021-22': 37.48,
  '2022-23': 37.02,
  '2023-24': 37.48,
  '2024-25': 37.26,
  '2025-26': 36.62,
}

/** The baseline for a season, falling back to the pre-2005 constant. */
export function seasonBaseline(season) {
  return SEASON_MINUTES_BASELINE[season] ?? PRE_2005_BASELINE
}

/** MPG restated on the reference scale, so eras compare directly. */
export function eraAdjustedMinutes(season, minutesPerGame) {
  return minutesPerGame * (REFERENCE_MINUTES / seasonBaseline(season))
}
