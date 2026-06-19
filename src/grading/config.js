// Grading engine tunables — single source of truth (design doc §12).
// Every constant the engine uses lives here so tuning never touches logic.

export const GRADING_CONFIG = {
  Z_CLIP: 3.0,
  K_SQUASH: 0.85,

  offense: {
    weights: { scoring_power: 0.24, efficiency: 0.22, playmaking: 0.20, spacing: 0.16, rim_pressure: 0.10, offensive_rebounding: 0.08 },
    A_OBPM: 0.15,
    PRIOR_3PA: 2.0, // spacing volume-shrink strength (pseudo-attempts)
  },

  defense: {
    D_ANCHOR: 0.55, // weight on z(DBPM) vs box blend
    box: { perimeter: 0.40, interior: 0.35, dreb: 0.25 },
  },

  availability: { TAU_GP: 25 },

  position: { LAMBDA_POS: 0.25, NUDGE_CAP: 0.30 },

  slot: { RHO_SLOT: 0.92 },

  complementarity: {
    weights: { skill_coverage: 0.30, size_archetype: 0.25, usage_fit: 0.25, team_spacing: 0.20 },
    RHO_COV: 0.55,
    PEN_USG: 14,
    GAP_PEN: 8,
    SAME_POS_PEN: 10,
  },

  overall: { W_OFF: 0.40, W_DEF: 0.30, W_COMP: 0.30, KAPPA: 0.15, TWP_CAP: 10 },
}

// Stats that get a positional benchmark for the (capped) position nudge (design §5).
export const NUDGE_STATS = ['ast_pct', 'orb_pct', 'drb_pct', 'blk_pct']
