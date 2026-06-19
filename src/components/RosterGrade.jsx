import { useState } from 'react'
import styles from './RosterGrade.module.css'

// Display order + friendly labels for the engine's meta-components and subcomponents.
const META = [
  { key: 'offense', label: 'Offense', subs: [
    ['scoring_power', 'Scoring'], ['efficiency', 'Efficiency'], ['spacing', 'Spacing'],
    ['playmaking', 'Playmaking'], ['rim_pressure', 'Rim pressure'], ['offensive_rebounding', 'Off. rebounding'],
  ] },
  { key: 'defense', label: 'Defense', subs: [
    ['perimeter', 'Perimeter'], ['interior', 'Interior'], ['defensive_rebounding', 'Def. rebounding'],
  ] },
  { key: 'complementarity', label: 'Complementarity', subs: [
    ['usage_fit', 'Usage fit'], ['skill_coverage', 'Skill coverage'],
    ['team_spacing', 'Team spacing'], ['size_archetype_balance', 'Size / archetype'],
  ] },
]

// 0–100 → letter grade (meta-components only).
function letter(score) {
  const s = Math.round(score)
  if (s >= 90) return 'A+'
  if (s >= 85) return 'A'
  if (s >= 80) return 'A−'
  if (s >= 75) return 'B+'
  if (s >= 70) return 'B'
  if (s >= 65) return 'B−'
  if (s >= 60) return 'C+'
  if (s >= 55) return 'C'
  if (s >= 50) return 'C−'
  if (s >= 45) return 'D+'
  if (s >= 40) return 'D'
  if (s >= 35) return 'D−'
  return 'F'
}
// Coarse colour tier for the letter grade.
function tier(score) {
  if (score >= 80) return 'a'
  if (score >= 65) return 'b'
  if (score >= 50) return 'c'
  if (score >= 40) return 'd'
  return 'f'
}

export default function RosterGrade({ grade }) {
  const [open, setOpen] = useState({})
  if (!grade) return null

  return (
    <div className={styles.block}>
      <div className={styles.overall}>
        <span className={styles.overallLabel}>Roster grade</span>
        <span className={styles.overallScore}>{Math.round(grade.overall)}</span>
      </div>

      <div className={styles.metas}>
        {META.map(m => {
          const comp = grade.components[m.key]
          if (!comp) return null
          const isOpen = !!open[m.key]
          return (
            <div key={m.key} className={styles.meta}>
              <button
                className={styles.metaRow}
                onClick={() => setOpen(o => ({ ...o, [m.key]: !o[m.key] }))}
                aria-expanded={isOpen}
              >
                <span className={styles.caret}>{isOpen ? '▾' : '▸'}</span>
                <span className={styles.metaLabel}>{m.label}</span>
                <span className={`${styles.metaGrade} ${styles['t_' + tier(comp.score)]}`}>{letter(comp.score)}</span>
              </button>

              {isOpen && (
                <div className={styles.subGrid}>
                  {m.subs.map(([k, label]) => (
                    <div key={k} className={styles.subRow}>
                      <span className={styles.subLabel}>{label}</span>
                      <span className={styles.subVal}>{Math.round(comp.subcomponents[k])}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
