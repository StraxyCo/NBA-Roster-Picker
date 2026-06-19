// Roster grading engine — pure, deterministic, fully tunable (see docs/roster-grading/ENGINE_DESIGN.md).
//
//   gradeRoster(picks, shardsBySeason, config?) -> output (design §10)
//
//   picks          : [{ nba_id, season, team, roster_slot(1..N) }]
//   shardsBySeason : { '<season>': shard }  (one loaded public/grading/<season>.json per drawn season)
//   config         : GRADING_CONFIG (defaults imported)
//
// No I/O, no framework — same module runs in the browser and in the Node test harness.

import { GRADING_CONFIG } from './config.js'
import { deriveStats } from './derive.js'

// ── primitives ────────────────────────────────────────────────────────────────
const clip = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)

function makeZ(cfg) {
  return (v, bench) => {
    if (!bench || !bench.sd) return 0
    return clip((v - bench.mean) / bench.sd, -cfg.Z_CLIP, cfg.Z_CLIP)
  }
}
const makeSquash = cfg => z => 100 / (1 + Math.exp(-cfg.K_SQUASH * z))

// Saturating coverage of a trait across players (design §8): sort the positive
// z-scores descending, geometric-discount the 2nd/3rd provider, squash. Diminishing
// returns + gap-fill fall out of this for free.
function coverZ(zs, rho, squash) {
  if (!zs.length) return squash(-1) // category with no providers at all -> low
  const sorted = [...zs].sort((a, b) => b - a)
  let acc = sorted[0] // best provider sets the base (even if negative -> a real hole reads low)
  for (let i = 1; i < sorted.length; i++) if (sorted[i] > 0) acc += sorted[i] * rho ** i // helpers, diminishing
  return squash(acc)
}

// ── per-player grade ──────────────────────────────────────────────────────────
function gradePlayer(pick, shard, cfg, z, squash) {
  const player = shard?.players?.[pick.nba_id]
  const bench = shard?.benchmark
  // Missing data (uncrosswalked / not in shard): neutral 50s, mild availability discount, flagged.
  if (!player || !bench) {
    return { missing: true, offense: 50, defense: 50, availability: 0.8,
      offSubs: { scoring_power: 50, efficiency: 50, spacing: 50, playmaking: 50, rim_pressure: 50, offensive_rebounding: 50 },
      defSubs: { perimeter: 50, interior: 50, defensive_rebounding: 50 },
      traits: { usg: 0, ast: 0, pts: 0, reb: 0, blk: 0, stl: 0, fg3m: 0, tpar: 0, pos_bucket: null, height: null } }
  }

  const d = deriveStats(player.raw, { p_league3P: bench.p_league3P })
  const S = bench.stats
  const zof = {}
  for (const k of Object.keys(d)) zof[k] = z(d[k], S[k])

  // position nudge (design §5): small, capped, additive-in-z, once, for position-sensitive stats
  const bucket = player.pos_bucket
  const posBench = bucket && bench.byPosition ? bench.byPosition[bucket] : null
  const nudge = stat => {
    if (!posBench || !posBench[stat]) return 0
    const zPos = z(d[stat], posBench[stat])
    return clip(cfg.position.LAMBDA_POS * (zPos - zof[stat]), -cfg.position.NUDGE_CAP, cfg.position.NUDGE_CAP)
  }

  // ── offense subcomponents (z-space blends, design §3.1) ──
  const oz = {
    scoring_power: 0.65 * zof.pts + 0.35 * zof.usg,
    efficiency: zof.ts,
    spacing: 0.55 * zof.fg3m + 0.45 * zof.adj3pct,
    playmaking: 0.45 * zof.ast_pct + 0.35 * zof.ast_to - 0.2 * zof.tov_pct + nudge('ast_pct'),
    rim_pressure: 0.5 * zof.ftr + 0.3 * zof.two_pa_share + 0.2 * zof.fg2_pct,
    offensive_rebounding: zof.orb_pct + nudge('orb_pct'),
  }
  // ── defense subcomponents (design §3.2) ──
  const dz = {
    perimeter: 0.6 * zof.stl_pct + 0.4 * -zof.pf36,
    interior: 0.6 * zof.blk_pct + 0.4 * zof.drb_pct + nudge('blk_pct'),
    defensive_rebounding: zof.drb_pct + nudge('drb_pct'),
  }

  // offense meta: weighted avg of subcomponent z's (+ light OBPM anchor), one squash
  const ow = cfg.offense.weights
  let offBlendZ = 0
  for (const k of Object.keys(ow)) offBlendZ += ow[k] * oz[k]
  const offenseZ = (1 - cfg.offense.A_OBPM) * offBlendZ + cfg.offense.A_OBPM * zof.obpm
  const offense = squash(offenseZ)

  // defense meta: DBPM-anchored (design §3.2)
  const bw = cfg.defense.box
  const boxZ = bw.perimeter * dz.perimeter + bw.interior * dz.interior + bw.dreb * dz.defensive_rebounding
  const defenseZ = cfg.defense.D_ANCHOR * zof.dbpm + (1 - cfg.defense.D_ANCHOR) * boxZ
  const defense = squash(defenseZ)

  // availability (design §4): smooth saturating GP discount, normalized to a full season
  const tau = cfg.availability.TAU_GP
  const gpFull = shard.gp_full || 82
  const raw = g => 1 - Math.exp(-g / tau)
  const availability = clip(raw(player.gp) / raw(gpFull), 0, 1)

  const sq = obj => { const o = {}; for (const k of Object.keys(obj)) o[k] = squash(obj[k]); return o }
  return {
    offense, defense, availability,
    offSubs: sq(oz), defSubs: sq(dz),
    traits: {
      usg: zof.usg, ast: zof.ast_pct, pts: zof.pts, reb: (zof.orb_pct + zof.drb_pct) / 2,
      blk: zof.blk_pct, stl: zof.stl_pct, fg3m: zof.fg3m, tpar: zof.tpar,
      pos_bucket: bucket, height: player.height_in,
    },
  }
}

// ── complementarity (distributional, design §8) ───────────────────────────────
function complementarity(pg, cfg, squash) {
  const C = cfg.complementarity
  const cov = makeSquash({ K_SQUASH: C.COV_K }) // gentler squash for coverage -> discriminates mid-range
  const T = pg.map(p => p.traits)
  const N = T.length

  // usage_fit: reward a 1-2 creator hierarchy; penalize stacked high-usage non-passers
  const creators = T.filter(t => t.usg > 0.8).length
  let usage_fit = creators >= 1 && creators <= 2 ? 85 : creators === 0 ? 55 : creators === 3 ? 58 : 45
  const highUsgLowPass = T.filter(t => t.usg > 1 && t.ast < 0).sort((a, b) => b.usg - a.usg)
  for (let i = 1; i < highUsgLowPass.length; i++) usage_fit -= C.PEN_USG * C.RHO_COV ** (i - 1)
  usage_fit = clip(usage_fit, 0, 100)

  // skill_coverage: coverage across categories, penalize holes
  const cats = {
    scoring: T.map(t => t.pts),
    playmaking: T.map(t => t.ast),
    rebounding: T.map(t => t.reb),
    rim_protection: T.map(t => t.blk),
    shooting: T.map(t => t.fg3m),
  }
  const covByCat = {}
  let holes = 0
  for (const c of Object.keys(cats)) {
    covByCat[c] = coverZ(cats[c], C.RHO_COV, cov)
    if (Math.max(...cats[c]) < C.HOLE_Z) holes++ // no *meaningful* provider = a hole
  }
  const skill_coverage = clip(mean(Object.values(covByCat)) - C.GAP_PEN * holes, 0, 100)

  // team_spacing: coverage of 3PM among credible shooters (above-average 3PT volume)
  const shooterFg3 = T.filter(t => t.tpar > 0 && t.fg3m > C.SHOOTER_Z).map(t => t.fg3m)
  const team_spacing = coverZ(shooterFg3, C.RHO_COV, cov)

  // size_archetype_balance: did distinct archetype roles get filled? (height-aware once available)
  const isBig = t => t.pos_bucket === 'C' || t.pos_bucket === 'F-C'
  const isGuard = t => t.pos_bucket === 'G' || t.pos_bucket === 'G-F'
  const slots = [
    T.some(t => isBig(t) && t.blk > 0.5), // rim protector
    T.some(t => isGuard(t) && t.stl > 0.3), // perimeter quickness
    T.some(t => t.reb > 0.7), // rebounder
    T.some(t => t.ast > 0.7), // creator
    T.some(isBig) && T.some(isGuard), // size spread
  ]
  let size_archetype = (slots.filter(Boolean).length / slots.length) * 100
  const buckets = {}
  for (const t of T) if (t.pos_bucket) buckets[t.pos_bucket] = (buckets[t.pos_bucket] || 0) + 1
  if (Math.max(0, ...Object.values(buckets)) >= N - 1) size_archetype -= C.SAME_POS_PEN
  size_archetype = clip(size_archetype, 0, 100)

  const w = C.weights
  const score = w.skill_coverage * skill_coverage + w.size_archetype * size_archetype + w.usage_fit * usage_fit + w.team_spacing * team_spacing
  return { score, subcomponents: { usage_fit, skill_coverage, team_spacing, size_archetype_balance: size_archetype } }
}

// ── public API ────────────────────────────────────────────────────────────────
export function gradeRoster(picks, shardsBySeason, config = GRADING_CONFIG) {
  const cfg = config
  const z = makeZ(cfg)
  const squash = makeSquash(cfg)
  const N = picks.length

  // slot weights (design §6): gentle monotonic decay, normalized to sum 1
  const wRaw = picks.map(p => cfg.slot.RHO_SLOT ** ((p.roster_slot || 1) - 1))
  const wSum = wRaw.reduce((s, x) => s + x, 0) || 1
  const slotW = wRaw.map(w => w / wSum)

  const pg = picks.map(p => gradePlayer(p, shardsBySeason[p.season], cfg, z, squash))

  // availability discount (design §1b/§4): regress the *upside* of limited play toward 50
  // (a half-season star counts a bit less), but never LIFT a below-average score — being
  // unavailable doesn't make a liability better, and must not reward deep-bench scrubs.
  const avail = (score, a) => (score > 50 ? 50 + a * (score - 50) : score)
  const effOff = pg.map(p => avail(p.offense, p.availability))
  const effDef = pg.map(p => avail(p.defense, p.availability))
  const roster_offense = effOff.reduce((s, v, i) => s + slotW[i] * v, 0)
  const roster_defense = effDef.reduce((s, v, i) => s + slotW[i] * v, 0)

  const comp = complementarity(pg, cfg, squash)

  // overall blend + two-way balance penalty (design §9)
  const O = cfg.overall
  const overallRaw = O.W_OFF * roster_offense + O.W_DEF * roster_defense + O.W_COMP * comp.score
  const twoWayPen = Math.min(O.KAPPA * Math.abs(roster_offense - roster_defense), O.TWP_CAP)
  const overall = clip(overallRaw - twoWayPen, 0, 100)

  // presentation stretch (averaging compresses elite scores). Only lifts >50 so it makes
  // strong rosters feel strong without crushing weak ones below their floor. Monotonic.
  const gain = x => (x > 50 ? clip(50 + (O.OUTPUT_GAIN ?? 1) * (x - 50), 0, 100) : x)
  const round = x => Math.round(x * 10) / 10
  return {
    overall: round(gain(overall)),
    components: {
      offense: { score: round(gain(roster_offense)), subcomponents: avgSubs(pg.map(p => p.offSubs), slotW, round) },
      defense: { score: round(gain(roster_defense)), subcomponents: avgSubs(pg.map(p => p.defSubs), slotW, round) },
      complementarity: { score: round(gain(comp.score)), subcomponents: mapRound(comp.subcomponents, round) },
    },
    two_way_balance_adjustment: round(-twoWayPen),
    players: picks.map((p, i) => ({
      nba_id: p.nba_id, canonical_id: shardsBySeason[p.season]?.players?.[p.nba_id]?.canonical_id ?? `nba_${p.nba_id}`,
      season: p.season, team: p.team, roster_slot: p.roster_slot,
      availability_factor: round(pg[i].availability), offense_contribution: round(effOff[i]), defense_contribution: round(effDef[i]),
      missing: pg[i].missing || false,
    })),
  }
}

// slot-weighted average of each displayed subcomponent across players (for the breakdown)
function avgSubs(list, slotW, round) {
  const keys = Object.keys(list[0])
  const out = {}
  for (const k of keys) out[k] = round(list.reduce((s, subs, i) => s + slotW[i] * subs[k], 0))
  return out
}
function mapRound(obj, round) { const o = {}; for (const k of Object.keys(obj)) o[k] = round(obj[k]); return o }
