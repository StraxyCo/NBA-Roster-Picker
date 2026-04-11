import { useState } from 'react'
import styles from './SetupScreen.module.css'

export default function SetupScreen({ onStart }) {
  const [names, setNames]           = useState(['', '', '', ''])
  const [rosterSize, setRosterSize] = useState(6)
  const [eliminate, setEliminate]   = useState(true)
  const [apiKey, setApiKey]         = useState('')

  const activePlayers = names.filter(n => n.trim() !== '')
  const canStart = activePlayers.length >= 1

  function updateName(i, val) {
    setNames(prev => prev.map((n, idx) => idx === i ? val : n))
  }

  function handleStart() {
    if (!canStart) return
    onStart({
      players: activePlayers,
      rosterSize,
      eliminateTeams: eliminate,
      apiKey: apiKey.trim(),
    })
  }

  return (
    <div className={styles.screen}>
      {/* Background court lines decorative */}
      <div className={styles.courtLines} aria-hidden="true">
        <div className={styles.courtArc} />
        <div className={styles.courtCenter} />
      </div>

      <div className={styles.content}>
        {/* Header */}
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

          {/* Options */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>Options</h2>

            <div className={styles.optionRow}>
              <div className={styles.optionLabel}>
                <span className={styles.optionTitle}>Roster size</span>
                <span className={styles.optionDesc}>Players per team</span>
              </div>
              <div className={styles.stepper}>
                <button
                  className={styles.stepBtn}
                  onClick={() => setRosterSize(s => Math.max(5, s - 1))}
                  disabled={rosterSize <= 5}
                >−</button>
                <span className={styles.stepValue}>{rosterSize}</span>
                <button
                  className={styles.stepBtn}
                  onClick={() => setRosterSize(s => Math.min(12, s + 1))}
                  disabled={rosterSize >= 12}
                >+</button>
              </div>
            </div>

            <div className={styles.optionRow}>
              <div className={styles.optionLabel}>
                <span className={styles.optionTitle}>Eliminate drawn teams</span>
                <span className={styles.optionDesc}>Once drawn, a team can't be picked again</span>
              </div>
              <button
                className={`${styles.toggle} ${eliminate ? styles.toggleOn : ''}`}
                onClick={() => setEliminate(e => !e)}
                aria-pressed={eliminate}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          </section>

          {/* API Key (optional) */}
          <section className={styles.section}>
            <h2 className={styles.sectionLabel}>
              BallDontLie API Key
              <span className={styles.optional}> — optional</span>
            </h2>
            <input
              className={styles.input}
              type="text"
              placeholder="Paste your API key for higher rate limits"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
            <p className={styles.hint}>
              Free at <a href="https://www.balldontlie.io" target="_blank" rel="noreferrer">balldontlie.io</a>.
              Without a key, rate limit is 5 req/min — enough for most games.
            </p>
          </section>
        </div>

        <button
          className={styles.startBtn}
          onClick={handleStart}
          disabled={!canStart}
        >
          Start Game
        </button>
      </div>
    </div>
  )
}
