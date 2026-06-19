// Shared stat derivation — the ONE place raw bref/box fields become the numeric
// vector the engine z-scores. Imported by both the offline build (benchmarks +
// shards) and the runtime engine, so a player and the league benchmark are always
// computed the same way (no source drift).

import { GRADING_CONFIG } from './config.js'

// Map a Basketball-Reference position string to the coarse 5-bucket scheme
// (G / G-F / F / F-C / C) used for the position nudge and size/archetype balance.
export function posBucket(pos) {
  if (!pos) return null
  const set = new Set(
    String(pos)
      .toUpperCase()
      .split(/[-,/]/)
      .map(p => (p === 'PG' || p === 'SG' || p === 'G' ? 'G' : p === 'SF' || p === 'PF' || p === 'F' ? 'F' : p === 'C' ? 'C' : null))
      .filter(Boolean),
  )
  if (set.has('G') && set.has('F')) return 'G-F'
  if (set.has('F') && set.has('C')) return 'F-C'
  if (set.has('G')) return 'G'
  if (set.has('C')) return 'C'
  if (set.has('F')) return 'F'
  return null
}

const safe = (x, d = 0) => (x == null || Number.isNaN(x) ? d : x)

// record = parsed bref season line (see scripts/build-grading-data.mjs for shape).
// ctx.p_league3P = season league 3P% (attempts-weighted, qualified pop).
// Returns the flat numeric vector that gets z-scored against the benchmark.
export function deriveStats(record, ctx) {
  const r = record
  const PRIOR = GRADING_CONFIG.offense.PRIOR_3PA
  const fg3a = safe(r.fg3a)
  const fg2a = safe(r.fg2a)
  const shots3 = fg3a + fg2a
  return {
    // offense — volume / efficiency / playmaking
    pts: safe(r.pts),
    usg: safe(r.usg_pct),
    ts: safe(r.ts_pct),
    ast_pct: safe(r.ast_pct),
    ast_to: safe(r.ast) / Math.max(safe(r.tov), 0.5),
    tov_pct: safe(r.tov_pct),
    // spacing — volume + volume-shrunk 3P%
    fg3m: safe(r.fg3m),
    adj3pct: (safe(r.fg3m) + PRIOR * safe(ctx?.p_league3P, 0.35)) / (fg3a + PRIOR),
    tpar: safe(r.tpar),
    // rim pressure
    ftr: safe(r.ftr),
    two_pa_share: shots3 > 0 ? fg2a / shots3 : 0,
    fg2_pct: safe(r.fg2_pct),
    // rebounding
    orb_pct: safe(r.orb_pct),
    drb_pct: safe(r.drb_pct),
    // defense box
    stl_pct: safe(r.stl_pct),
    blk_pct: safe(r.blk_pct),
    pf36: safe(r.mpg) > 0 ? (safe(r.pf) / r.mpg) * 36 : 0,
    // BPM anchors
    obpm: safe(r.obpm),
    dbpm: safe(r.dbpm),
  }
}

// Keys produced by deriveStats — the benchmark carries mean/sd for each.
export const STAT_KEYS = Object.keys(
  deriveStats(
    { fg3a: 0, fg2a: 0, mpg: 1 },
    { p_league3P: 0.35 },
  ),
)
