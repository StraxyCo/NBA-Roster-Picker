import { useState, useEffect } from 'react'
import styles from './SetupScreen.module.css'
import { getAvailableSeasons } from '../hooks/useRoster.js'

export default function SetupScreen({ onStart }) {
  const [names, setNames]               = useState(['', '', '', ''])
  const [rosterSize, setRosterSize]     = useState(6)
  const [eliminate, setEliminate]       = useState(true)
  const [elimFranch, setElimFranch]     = useState(false)
  const [allSeasons, setAllSeasons]     = useState(['2025-26'])
  const [selectedSeasons, setSelected]  = useState(new Set(['2025-26']))

  useEffect(() => {
    getAvailableSeasons().then(s => {
      setAllSeasons(s)
      setSelected(new Set([s[0]]))
    }).catch(() => {})
  }, [])

  const activePlayers = names.filter(n => n.trim() !== '')
  const canStart = activePlayers.length >= 1
  const multiSeason = selectedSeasons.size >= 2

  function updateName(i, val) {
    setNames(prev => prev.map((n, idx) => idx === i ? val : n))
  }

  function toggleSeason(s) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(s)) {
        if (next.size === 1) return prev // always keep at least one
        next.delete(s)
      } else {
        next.add(s)
      }
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(allSeasons))
  }

  function selectNone() {
    // Keep only the first (most recent)
    setSelected(new Set([allSeasons[0]]))
  }

  function handleStart() {
    if (!canStart) return
    onStart({
      players: activePlayers,
      rosterSize,
      eliminateTeams: eliminate,
      eliminateFranchises: multiSeason ? elimFranch : false,
      seasons: [...selectedSeasons],
    })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.courtLines} aria-hidden="true">
        <div className={styles.courtArc} />
        <div className={styles.courtCenter} />
      </div>

      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.badge}>NBA</div>
          <h1 className={styles.title}>Roster<br />Picker</h1>
          <p className={styles.tagline}>Draft your dream squad</p>
        </header>

        <div className={styles.form}>
          {/* Players */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>Players</h2>
            <div className={styles.playerGrid}>
              {names.map((name, i) => (
                <div key={i} className={styles.playerField}>
                  <span className={styles.playerNum}>{i + 1}</span>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder={`Player ${i + 1} name`}
                    value={name}
                    onChange={e => updateName(i, e.target.value)}
                    maxLength={20}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Seasons */}
          <section className={styles.section}>
            <div className={styles.seasonHeader}>
              <h2 className={styles.sectionLabel} style={{ margin: 0 }}>Seasons</h2>
              <div className={styles.seasonActions}>
                <button className={styles.textBtn} onClick={selectAll}>All</button>
                <span className={styles.textBtnSep}>·</span>
                <button className={styles.textBtn} onClick={selectNone}>Reset</button>
              </div>
            </div>
            <div className={styles.seasonGrid}>
              {allSeasons.map(s => (
                <button
                  key={s}
                  className={`${styles.seasonPill} ${selectedSeasons.has(s) ? styles.seasonPillOn : ''}`}
                  onClick={() => toggleSeason(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* Options */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>Options</h2>

            <div className={styles.optionRow}>
              <div className={styles.optionLabel}>
                <span className={styles.optionTitle}>Roster size</span>
                <span className={styles.optionDesc}>Players per team</span>
              </div>
              <div className={styles.stepper}>
                <button className={styles.stepBtn} onClick={() => setRosterSize(s => Math.max(5, s - 1))} disabled={rosterSize <= 5}>−</button>
                <span className={styles.stepValue}>{rosterSize}</span>
                <button className={styles.stepBtn} onClick={() => setRosterSize(s => Math.min(12, s + 1))} disabled={rosterSize >= 12}>+</button>
              </div>
            </div>

            <div className={styles.optionRow}>
              <div className={styles.optionLabel}>
                <span className={styles.optionTitle}>Eliminate drawn teams</span>
                <span className={styles.optionDesc}>A team+season combo can't be drawn twice</span>
              </div>
              <button
                className={`${styles.toggle} ${eliminate ? styles.toggleOn : ''}`}
                onClick={() => setEliminate(e => !e)}
                aria-pressed={eliminate}
              ><span className={styles.toggleKnob} /></button>
            </div>

            {multiSeason && (
              <div className={styles.optionRow}>
                <div className={styles.optionLabel}>
                  <span className={styles.optionTitle}>Eliminate drawn franchises</span>
                  <span className={styles.optionDesc}>All seasons of a drawn team are removed</span>
                </div>
                <button
                  className={`${styles.toggle} ${elimFranch ? styles.toggleOn : ''}`}
                  onClick={() => setElimFranch(e => !e)}
                  aria-pressed={elimFranch}
                ><span className={styles.toggleKnob} /></button>
              </div>
            )}
          </section>
        </div>

        <button className={styles.startBtn} onClick={handleStart} disabled={!canStart}>
          Start Game
        </button>
      </div>
    </div>
  )
}
