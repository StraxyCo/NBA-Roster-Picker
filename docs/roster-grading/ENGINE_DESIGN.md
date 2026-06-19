# Roster Grading Engine — Design Spec

**Status:** Draft for validation (Step 0). No engine code until this is signed off.
**Scope:** Players mode only. Augments the Final screen (overall + 3 meta-grades, expandable). Humans still declare the winner.

This doc pins the math, the constants, and the data/runtime architecture. Companion: `roster-grading-spec.md` (product brief) and `test-rosters.md` (sanity fixtures). Where this doc and the brief disagree, this doc wins for *math*; the brief wins for *intent*.

---

## 0. Guiding invariants (what the math must guarantee)

From `test-rosters.md` (ordering amended per the validated decision below):

1. **Ordering:** `Dream Team (A) ≥ Balanced (C) > All-Defense (D) ≳ 3-Alpha (B) > Deep Bench (E)`.
   > **Decision (validated):** the original spec asserted B (all-offense / no-defense / redundant) > D (elite-defense / good-fit). A *balanced* engine correctly ranks D ≳ B — a no-defense, redundant roster does not beat an elite-defense roster with good fit. We kept the engine balanced (offense weight 0.42) and amended the invariant to `D ≳ B`. Forcing B > D would have required offense weight ~0.55–0.60, making defense near-cosmetic.
2. **Cap:** A's overall **< 97** (flag failure ≥ 97). Achieved *structurally* — see §9.
3. **Floor:** E is the lowest; the GP discount is visibly active.
4. B: offense high, complementarity + overall mid (redundancy bites).
5. D: overall ≪ defense (two-way penalty bites).
6. Availability is smooth (Embiid '23 > '25, no `GP/82` cliff).
7. Era-fair: equal raw 3PM grades **above** average in 2005‑06, **below** in 2025‑26.

Every constant below is a tunable in one config object (`GRADING_CONFIG`). Defaults are starting points; Step 5 tunes them against the fixtures.

---

## 1. Two structural choices that drive everything

**(a) Blend in z-space, squash once.** Each subcomponent is a weighted sum of *z-scores*, squashed to 0–100 a single time at the subcomponent level. We never squash-then-average (that compounds the nonlinearity and inflates outliers). One squash = one bounded, smooth map.

**(b) Discount toward the neutral baseline (50), never toward 0.** Availability and any shrink pulls a score *toward league-average 50*, not toward zero. A half-season MVP becomes "very good, counts a bit less," not "average." Formula everywhere:
```
effective = 50 + factor · (score − 50)
```

---

## 2. Normalization (the era layer)

For raw stat `x` of player `p` in season `s`:

```
z = clip( (x − mean[s]) / sd[s] , −Z_CLIP, +Z_CLIP )     Z_CLIP = 3.0
```

`mean[s]`, `sd[s]` come from `benchmarks.json` (per-season, over the qualified population: ≥15 MPG & ≥30 GP, lockout/bubble scaled to ~40% of scheduled games — Step 3).

**Squash** (z → 0–100), logistic, smooth, symmetric around 50:
```
squash(z) = 100 / (1 + exp(−K_SQUASH · z))          K_SQUASH = 0.85
```
Check: z=0→50, z=1→70, z=2→85, z=3→92.7, z=−3→7.3. So a best-in-era stat caps ~93, not 100. This single curve is the backbone of the cap (§9).

This era layer **auto-solves invariant 7**: 1.5 3PM/game z-scores positive against a 2005‑06 mean, negative against a 2025‑26 mean — opposite signs, same raw value, zero hand-coded era multipliers.

---

## 3. Player subcomponents

Notation: `z(STAT)` = clipped season z-score. Each subcomponent = weighted z-blend → (position nudge, §5) → `squash`.

### 3.1 Offense (6 subcomponents)

| Subcomponent | z-blend | Notes |
|---|---|---|
| `scoring_power` | `0.65·z(PTS) + 0.35·z(USG%)` | volume + load. USG here = scoring load; usage *distribution* is graded separately in complementarity (different read, not double-count). |
| `efficiency` | `z(TS%)` | rolls 2s/3s/FTs. Kept fully separate from volume. |
| `spacing` | `0.55·z(3PM) + 0.45·z(adj3P%)` | individual gravity. **Volume-shrunk efficiency** (no hard threshold): see §3.1.1. |
| `playmaking` | `0.45·z(AST%) + 0.35·z(AST/TO) − 0.20·z(TOV%)` | ball security folded in. USG **not** graded here. |
| `rim_pressure` | `0.50·z(FTr) + 0.30·z(2PA_share) + 0.20·z(2P%)` | "gets downhill / draws fouls," NOT rim FG% (no tracking pre-2014). |
| `offensive_rebounding` | `z(OREB%)` | extra possessions; also feeds complementarity coverage. |

#### 3.1.1 Spacing — volume-shrunk 3P% (no threshold, sliding scale)

A hard 3PA cutoff creates a cliff and the wrong ordering: a 44% shooter on 1.1 3PA/g must **not** outrank a 42% shooter on 4.2 3PA/g. Fix: shrink each player's 3P% toward the league mean in proportion to how few attempts they take (empirical-Bayes / pseudo-count), so low-volume percentages regress to ~average and can't fake gravity:

```
adj3P% = (FG3M + PRIOR_3PA · p_league3P) / (FG3A + PRIOR_3PA)      PRIOR_3PA = 2.0 (per-game-equivalent attempts)
```
`p_league3P`, and the mean/sd used to z-score `adj3P%`, come from the season benchmark. Then `spacing` blends volume **and** shrunk efficiency, both continuous — there is no on/off threshold.

Worked check (league 3P% ≈ 36%, PRIOR_3PA = 2.0):
- 44% on 1.1/g → adj3P% = (0.48 + 0.72)/(1.1+2.0) = **38.7%** (heavily regressed) + **low** z(3PM) → spacing ≈ average.
- 42% on 4.2/g → adj3P% = (1.76 + 0.72)/(4.2+2.0) = **40.0%** (barely regressed) + **high** z(3PM) → spacing well above average.

The high-volume shooter wins on both terms, as it should. `PRIOR_3PA` is the sliding-scale strength (higher = more regression for low-volume), tunable.

---

Offense meta default weights: `scoring 0.24, efficiency 0.22, playmaking 0.20, spacing 0.16, rim_pressure 0.10, oreb 0.08`.
Optional stabilizer: `offense_z_meta = (1−A_OBPM)·blend_z + A_OBPM·z(OBPM)`, `A_OBPM = 0.15`. (Anchors offense lightly on a holistic metric; tunable, can be 0.)

### 3.2 Defense (3 displayed subcomponents, DBPM-anchored meta)

| Subcomponent | z-blend | Notes |
|---|---|---|
| `perimeter` | `0.60·z(STL%) + 0.40·(−z(PF_per36))` | forcing TOs merged in (steals would double-count). Low fouls rewarded. Don't over-weight steals (gamblers). **PF source:** NBA.com if cleanly exposed, else **Basketball-Reference** per-game/totals (PF is on bref's standard tables) — grafted via the crosswalk like BPM. Stat-loss fallback (`z(STL%)` only) is now a last resort, not the plan. |
| `interior` | `0.60·z(BLK%) + 0.40·z(DREB%)` | best box defensive signal. |
| `defensive_rebounding` | `z(DREB%)` | own axis — a rim protector who doesn't board still leaks 2nd chances. |

**Meta leans on DBPM** (brief §4.2/§7.4):
```
box_z   = 0.40·perimeter_z + 0.35·interior_z + 0.25·dreb_z
def_z   = D_ANCHOR·z(DBPM) + (1−D_ANCHOR)·box_z      D_ANCHOR = 0.55
defense_score = squash(def_z)
```
The three subcomponents are still squashed individually for display. DBPM is the backbone; box pieces flavor + feed complementarity. A player with **no bref match has no DBPM → data-completeness gate (Step 1), never a box-only fallback.**

---

## 4. Availability discount (weighting layer, not a component)

Smooth, saturating on **GP** (per-game stats already bake in minutes — don't re-multiply by MP):
```
raw(GP)  = 1 − exp(−GP / TAU_GP)                     TAU_GP = 25
avail    = raw(GP) / raw(GP_FULL[s])                 GP_FULL[s] = scheduled games (82, or lockout/bubble actual)
```
Check (82-game season): GP 82→1.00, 66→0.965, 40→0.829, 19→0.553, 10→0.34. Embiid 66 vs 19 → 0.965 vs 0.553, clear margin, no cliff (invariant 6).

Applied to **offense & defense contributions only**, toward baseline 50 (§1b) — **asymmetric**: it
regresses the *upside* of limited play but never *lifts* a below-average score (being unavailable
must not make a liability better, nor reward deep-bench scrubs who barely played):
```
eff_i = score_i > 50 ? 50 + avail_i·(score_i − 50) : score_i     // for offense_i and defense_i
```
Complementarity uses slot weights, not avail (it's distributional; avail would double-penalize presence).

---

## 5. Position nudge (gentle, bounded, capped — §5.3 guardrail)

Goal: 2 APG means more from a center than a guard — a *small additive* in z-space, **never compounding**, must NOT deify Jokić/Westbrook.

For the four position-sensitive subcomponents (`playmaking`, `offensive_rebounding`, `defensive_rebounding`, `interior`):
```
nudge = clip( LAMBDA_POS · (z_pos − z_league) , −NUDGE_CAP, +NUDGE_CAP )
        LAMBDA_POS = 0.25   NUDGE_CAP = 0.30
blend_z := blend_z + nudge        (added before squash, once)
```
`z_pos` = z-score within the player's **position group** (G / G‑F / F / F‑C / C), from per-position mean/SD in the benchmark file. So a center passing well gets a small bump vs centers; a guard who boards gets a small bump vs guards. Capped at ±0.30 z (≈ ±6 squashed points) so it can flavor, never dominate. "When in doubt, under-power it: 2 APG is still 2 APG."

---

## 6. Slot weighting (§6)

Gentle monotonic decay, slot 1 (best pick) heaviest, last slot still meaningful:
```
w(i) = RHO_SLOT^(i−1)         RHO_SLOT = 0.92,  i = 1..N
ŵ(i) = w(i) / Σ w             (normalized to sum 1)
```
N=7 → first/last weight ratio ≈ 1.65 (not steep). Tunable.

---

## 7. Roster aggregation (Offense, Defense)

```
roster_offense = Σ_i ŵ_i · off_eff_i
roster_defense = Σ_i ŵ_i · def_eff_i
```
Both 0–100 (convex combos of 0–100 values).

---

## 8. Complementarity (distributional — never a sum of grades)

Reads the *distribution* of the same individual traits. Every aggregation uses **diminishing returns** (a saturating sort) so the 2nd/3rd provider of a skill counts less, and **gap-fill** falls out naturally (first provider of an empty category counts full).

Saturating coverage of a trait across players:
```
cover(trait) = squash( Σ_rank  z_(rank) · RHO_COV^(rank−1) )    RHO_COV = 0.55
               (z sorted descending; only positive z contribute to "coverage")
```

| Subcomponent | Construction |
|---|---|
| `usage_fit` | Reward a usage *hierarchy*; penalize stacked high-usage non-passers. `base = squash(spread_z)` where spread rewards 1–2 high USG + moderate rest. `penalty = PEN_USG · Σ_{rank≥2} [high-USG & low-AST]_(rank) · RHO_COV^(rank−1)` (diminishing). `usage_fit = clip(base − penalty, 0, 100)`. `PEN_USG = 14`. This is where USG earns its keep. |
| `skill_coverage` | Categories = {scoring, playmaking, rebounding, rim_protection, shooting}. `coverage_cat = cover(cat_trait)`. `skill_coverage = mean_cat(coverage_cat) − GAP_PEN · n_holes`, where a *hole* = category with no player at z>0. `GAP_PEN = 8`. Entropy-flavored: balanced coverage beats a tall spike + holes. |
| `team_spacing` | Roster-level read of individual spacing. `team_spacing = cover(3PM)` gated by credibility (`3PAr z>0`). Diminishing past ~3 credible shooters (built into RHO_COV). |
| `size_archetype_balance` | Uses height + 5-bucket position. Reward filled archetype slots: rim protector (C/F‑C w/ BLK+DREB), perimeter quickness (G w/ STL), a rebounder, a creator, size spread. `= mean(archetype_slot_filled) · 100`, penalize all-same-position rosters (`SAME_POS_PEN = 10` if ≥ N−1 share one bucket). |

Complementarity meta default weights: `skill_coverage 0.30, size_archetype 0.25, usage_fit 0.25, team_spacing 0.20`. Output 0–100.

---

## 9. Overall blend + two-way penalty + the cap

```
overall_raw  = W_OFF·roster_offense + W_DEF·roster_defense + W_COMP·complementarity
               W_OFF = 0.40, W_DEF = 0.30, W_COMP = 0.30
two_way_pen  = min( KAPPA · |roster_offense − roster_defense| , TWP_CAP )
               KAPPA = 0.15, TWP_CAP = 10
overall      = clip( overall_raw − two_way_pen , 0, 100 )
```

**Presentation gain** (`OUTPUT_GAIN = 1.2`): averaging many subcomponents compresses the scale, so the
final `overall` and the three component scores are stretched around 50 — **only upward** (`x>50`), so
elite rosters feel elite without crushing weak rosters below their floor. Monotonic: preserves all
ordering, and the upward-only form keeps a real ceiling so the < 97 cap still holds (A = 88).

**Why the cap holds without a hard clamp (invariant 2):** every layer is bounded and averaging —
- per-stat squash maxes ~93 (z clipped at 3);
- subcomponents *average* stats (a player elite at everything still lands low-90s, not 100);
- slot weights and avail are ≤ 1 and pull toward 50;
- Dream Team's four high-usage creators cost complementarity (`usage_fit` penalty);
- the offense/defense gap on any real roster triggers a small two-way penalty.

A stack of MVP seasons therefore lands **high-80s/low-90s**. We assert `< 97` and verify in Step 5; the cap is emergent, not a `min(x, 96)` hack. **Floor (invariant 3):** squash floor ~7 + averaging + avail-toward-50 puts replacement-level rosters in the 40s.

---

## 10. Output shape (brief §8)

```json
{
  "overall": 0,
  "components": {
    "offense": { "score": 0, "subcomponents": { "scoring_power":0,"efficiency":0,"spacing":0,"playmaking":0,"rim_pressure":0,"offensive_rebounding":0 } },
    "defense": { "score": 0, "subcomponents": { "perimeter":0,"interior":0,"defensive_rebounding":0 } },
    "complementarity": { "score": 0, "subcomponents": { "usage_fit":0,"skill_coverage":0,"team_spacing":0,"size_archetype_balance":0 } }
  },
  "two_way_balance_adjustment": 0,
  "players": [
    { "nba_id": 2544, "canonical_id": "lebrjame001", "season": "2012-13", "team": "MIA", "roster_slot": 1,
      "availability_factor": 0, "offense_contribution": 0, "defense_contribution": 0 }
  ]
}
```
Runtime rows keyed by `nba_id` (canonical_id carried as a field — crosswalk stays build-time-only, §11).

---

## 11. Data & runtime architecture

**Build-time (offline scripts, `scripts/fetch-*.mjs` pattern; never runtime):**
- `crosswalk` (Step 1) — build-time only, **does not ship to browser**. Used to graft bref BPM onto each `nba_id`-keyed row during assembly. Keyed by player; carries nba_id, bref_id, full_name, birthdate, listed_height_in (from **NBA.com**, not bref), primary_position (G/G‑F/F/F‑C/C).
- bref **Advanced** season tables: **one request per season** (~4 subset, ~21 full), OBPM/DBPM/BPM/VORP for everyone. Hard-throttle anyway, cache raw HTML/CSV permanently, never re-fetch a historical season. BPM 2.0 is applied retroactively → historical pages already era-consistent.
- Output: **one shard per season** `public/grading/<season>.json` = `{ players: { <nba_id>: {…stats…, canonical_id} }, benchmark: { <stat>: {mean,sd}, byPosition: { <bucket>: { <stat>: {mean,sd} } }, gp_full } }`. Benchmark merged into the shard (one fetch per season, not two).

**Runtime (in-browser, static JSON, no API):**
- **Prefetch at draw time:** the moment a team-season is drawn, fetch that season's shard while the user is still picking. By the Final screen the data is warm — no hang on reveal.
- Only drawn seasons load. A 7-team draw ≈ 7 small shards (tens of KB each). Teams mode loads none. The multi-MB full backfill never loads at once.
- Engine is a **pure module** (`src/grading/`): `gradeRoster(picks, shardsBySeason, GRADING_CONFIG) → output`. No React, no fetch inside. Fully unit-testable.

---

## 12. Config object (all tunables in one place)

```js
export const GRADING_CONFIG = {
  Z_CLIP: 3.0, K_SQUASH: 0.85,
  offense: { weights: { scoring_power:0.24, efficiency:0.22, playmaking:0.20, spacing:0.16, rim_pressure:0.10, offensive_rebounding:0.08 },
             A_OBPM: 0.15, PRIOR_3PA: 2.0 },
  defense: { D_ANCHOR: 0.55, box: { perimeter:0.40, interior:0.35, dreb:0.25 } },
  availability: { TAU_GP: 25 },
  position: { LAMBDA_POS: 0.25, NUDGE_CAP: 0.30 },
  slot: { RHO_SLOT: 0.92 },
  complementarity: { weights: { skill_coverage:0.30, size_archetype:0.25, usage_fit:0.25, team_spacing:0.20 },
                     RHO_COV: 0.55, PEN_USG: 14, GAP_PEN: 8, SAME_POS_PEN: 10 },
  overall: { W_OFF: 0.40, W_DEF: 0.30, W_COMP: 0.30, KAPPA: 0.15, TWP_CAP: 10 },
}
```

---

## 13. Open / to-verify in later steps
- PF (perimeter foul term): pull from NBA.com if cleanly exposed, else from Basketball-Reference standard tables (grafted via crosswalk). `perimeter = z(STL%)` only is a last-resort fallback, not expected.
- `PRIOR_3PA` (spacing shrinkage strength) may need tuning against real low/high-volume shooters in Step 5.
- Benchmark must carry `p_league3P` + mean/sd of `adj3P%` (derivable from the qualified pop) for the spacing shrinkage.
- All §0 invariants are *asserted in Step 5*; constants here are pre-tuning defaults.
