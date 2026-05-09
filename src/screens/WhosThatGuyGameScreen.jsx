import { useState, useMemo } from 'react'
import styles from './WhosThatGuyGameScreen.module.css'

function fmtSeason(s) { return s.slice(2) }
function fmtStat(key, val) {
  if (val == null) return '—'
  if (key === 'gp') return String(Math.round(val))
  return Number(val).toFixed(1)
}

// mysteryPlayer: { id, name, seasons: [{season, teamAbbr, gp, pts, reb, ast, fg3m, ...}] }
// allPlayers: [{ id, name }] sorted alphabetically
export default function WhosThatGuyGameScreen({ mysteryPlayer, allPlayers, showTeams, currentPlayer, onResult }) {
  const [phase, setPhase]               = useState('picking')
  const [query, setQuery]               = useState('')
  const [pickedPlayer, setPickedPlayer] = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allPlayers
    return allPlayers.filter(p => p.name.toLowerCase().includes(q))
  }, [allPlayers, query])

  function handlePickPlayer(p) {
    setPickedPlayer({ id: p.id, name: p.name })
  }

  function handleValidate() {
    setPhase('recap')
  }

  function handleNext() {
    const correct = pickedPlayer && String(pickedPlayer.id) === String(mysteryPlayer.id)
    onResult({ score: correct ? 1 : 0, guess: pickedPlayer, mystery: { id: mysteryPlayer.id, name: mysteryPlayer.name } })
  }

  const isCorrect = pickedPlayer && String(pickedPlayer.id) === String(mysteryPlayer.id)

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <span className={styles.eyebrow}>{currentPlayer}'s turn</span>
        {phase === 'recap' && (
          <span className={`${styles.resultBadge} ${isCorrect ? styles.badgeCorrect : styles.badgeWrong}`}>
            {isCorrect ? '✓ Correct' : '✗ Wrong'}
          </span>
        )}
      </div>

      <div className={styles.layout}>
        {/* ── Stat table ─────────────────────────────────────────────── */}
        <div className={styles.statPanel}>
          <div className={styles.panelLabel}>Career stats</div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <span className={styles.colYear}>Year</span>
              {showTeams && <span className={styles.colTeam}>Team</span>}
              <span className={styles.colStat}>GP</span>
              <span className={styles.colStat}>PTS</span>
              <span className={styles.colStat}>REB</span>
              <span className={styles.colStat}>AST</span>
              <span className={styles.colStat}>3PM</span>
            </div>
            {mysteryPlayer.seasons.map((s, i) => (
              <div key={i} className={styles.statRow}>
                <span className={styles.colYear}>{fmtSeason(s.season)}</span>
                {showTeams && <span className={styles.colTeam}>{s.teamAbbr}</span>}
                <span className={styles.colStat}>{fmtStat('gp', s.gp)}</span>
                <span className={styles.colStat}>{fmtStat('pts', s.pts)}</span>
                <span className={styles.colStat}>{fmtStat('reb', s.reb)}</span>
                <span className={styles.colStat}>{fmtStat('ast', s.ast)}</span>
                <span className={styles.colStat}>{fmtStat('fg3m', s.fg3m)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Picker panel ───────────────────────────────────────────── */}
        <div className={styles.pickerPanel}>
          {phase === 'picking' ? (
            <>
              <div className={styles.panelLabel}>Your pick</div>

              <div className={`${styles.slot} ${pickedPlayer ? styles.slotFilled : styles.slotEmpty}`}>
                {pickedPlayer ? (
                  <>
                    <span className={styles.slotName}>{pickedPlayer.name}</span>
                    <button className={styles.slotClear} onClick={() => setPickedPlayer(null)}>✕</button>
                  </>
                ) : (
                  <span className={styles.slotPlaceholder}>Search and select a player</span>
                )}
              </div>

              <input
                className={styles.searchInput}
                type="text"
                placeholder="Search player…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />

              <div className={styles.rosterList}>
                {filtered.map(p => (
                  <button
                    key={p.id}
                    className={`${styles.rosterBtn} ${pickedPlayer?.id === p.id ? styles.rosterBtnActive : ''}`}
                    onClick={() => handlePickPlayer(p)}
                  >
                    {p.name}
                  </button>
                ))}
                {filtered.length === 0 && query && (
                  <p className={styles.hint}>No players match "{query}"</p>
                )}
              </div>

              {pickedPlayer && (
                <button className={styles.validateBtn} onClick={handleValidate}>
                  Validate pick →
                </button>
              )}
            </>
          ) : (
            /* Recap panel */
            <>
              <div className={styles.panelLabel}>Result</div>

              <div className={`${styles.resultCard} ${isCorrect ? styles.resultCorrect : styles.resultWrong}`}>
                <span className={styles.resultIcon}>{isCorrect ? '✓' : '✗'}</span>
                <div className={styles.resultBody}>
                  <span className={styles.resultLabel}>Your pick</span>
                  <span className={styles.resultName}>{pickedPlayer?.name || '—'}</span>
                </div>
              </div>

              {!isCorrect && (
                <div className={styles.correctCard}>
                  <span className={styles.correctLabel}>Correct answer</span>
                  <span className={styles.correctName}>{mysteryPlayer.name}</span>
                </div>
              )}

              <button className={styles.nextBtn} onClick={handleNext}>Next →</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
