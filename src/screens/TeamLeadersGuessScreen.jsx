import { useState, useMemo } from 'react'
import { getLogoUrl } from '../data/teams.js'
import styles from './TeamLeadersGuessScreen.module.css'

function getLeader(roster, stat) {
  return roster.reduce((best, p) => (!best || (p[stat] ?? 0) > (best[stat] ?? 0)) ? p : best, null)
}

function computeScore(picks, leaders, categories) {
  let correct = 0
  for (const { key, stat } of categories) {
    if (picks[key]?.id === leaders[stat]?.id) correct++
  }
  return correct + (correct === categories.length ? 1 : 0)
}

export default function TeamLeadersGuessScreen({ team, season, roster, categories, currentPlayer, onResult }) {
  const [phase, setPhase] = useState('guessing')
  const [selectedNbaPlayer, setSelectedNbaPlayer] = useState(null)
  const [picks, setPicks] = useState(() => Object.fromEntries(categories.map(c => [c.key, null])))

  const leaders = useMemo(
    () => Object.fromEntries(categories.map(c => [c.stat, getLeader(roster, c.stat)])),
    [roster, categories]
  )

  const allSlotsFilled = categories.every(c => picks[c.key] !== null)

  function handleRosterPlayerClick(player) {
    if (phase !== 'guessing') return
    setSelectedNbaPlayer(prev => prev?.id === player.id ? null : player)
  }

  function handleSlotClick(catKey) {
    if (phase !== 'guessing') return
    if (selectedNbaPlayer) {
      setPicks(prev => ({ ...prev, [catKey]: selectedNbaPlayer }))
      setSelectedNbaPlayer(null)
    } else if (picks[catKey]) {
      setPicks(prev => ({ ...prev, [catKey]: null }))
    }
  }

  function handleClearSlot(catKey, e) {
    e.stopPropagation()
    setPicks(prev => ({ ...prev, [catKey]: null }))
    setSelectedNbaPlayer(null)
  }

  function handleValidate() {
    setSelectedNbaPlayer(null)
    setPhase('recap')
  }

  function handleNext() {
    const score = computeScore(picks, leaders, categories)
    onResult({ picks, leaders, score })
  }

  const sortedRoster = [...roster].sort((a, b) => a.name.localeCompare(b.name))

  // ── Recap phase ────────────────────────────────────────────────────────────
  if (phase === 'recap') {
    const score   = computeScore(picks, leaders, categories)
    const perfect = score === categories.length + 1
    const maxPts  = categories.length + 1
    return (
      <div className={styles.screen}>
        <div className={styles.content}>
          <div className={styles.teamHeader}>
            <img src={getLogoUrl(team.slug)} alt={team.name} className={styles.teamLogo} onError={e => { e.target.style.opacity = '0.2' }} />
            <div>
              <div className={styles.teamName}>{team.name}</div>
              <div className={styles.teamSeason}>{season}</div>
            </div>
          </div>

          <div className={styles.playerTurnLabel}>{currentPlayer}'s results</div>

          <div className={styles.recapList}>
            {categories.map(({ key, label, stat, unit }) => {
              const pick    = picks[key]
              const correct = leaders[stat]
              const isRight = pick?.id === correct?.id
              return (
                <div key={key} className={`${styles.recapRow} ${isRight ? styles.recapCorrect : styles.recapWrong}`}>
                  <div className={styles.recapCatLabel}>{label}</div>
                  <div className={styles.recapPick}>
                    <span className={styles.recapResult}>{isRight ? '✓' : '✗'}</span>
                    <div className={styles.recapPickInfo}>
                      <span className={styles.recapPickName}>{pick?.name ?? '—'}</span>
                      <span className={styles.recapPickStat}>{pick ? `${pick[stat]} ${unit}` : ''}</span>
                    </div>
                  </div>
                  {!isRight && correct && (
                    <div className={styles.recapAnswer}>
                      <span className={styles.recapAnswerLabel}>Correct:</span>
                      <span className={styles.recapAnswerName}>{correct.name}</span>
                      <span className={styles.recapAnswerStat}>{correct[stat]} {unit}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className={styles.scoreBox}>
            <span className={styles.scoreNum}>{score}</span>
            <span className={styles.scoreDenom}>/{maxPts} points</span>
            {perfect && <span className={styles.perfectBadge}>Perfect round! +1 bonus</span>}
          </div>

          <button className={styles.nextBtn} onClick={handleNext}>Next →</button>
        </div>
      </div>
    )
  }

  // ── Guessing phase ─────────────────────────────────────────────────────────
  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.teamHeader}>
          <img src={getLogoUrl(team.slug)} alt={team.name} className={styles.teamLogo} onError={e => { e.target.style.opacity = '0.2' }} />
          <div>
            <div className={styles.teamName}>{team.name}</div>
            <div className={styles.teamSeason}>{season}</div>
          </div>
        </div>

        <div className={styles.playerTurnLabel}>{currentPlayer}'s turn</div>

        <div className={styles.gameLayout}>
          {/* Roster list */}
          <div className={styles.rosterPanel}>
            <div className={styles.panelLabel}>Roster</div>
            <div className={styles.rosterList}>
              {sortedRoster.map(player => (
                <button
                  key={player.id}
                  className={`${styles.rosterRow} ${selectedNbaPlayer?.id === player.id ? styles.rosterRowSelected : ''}`}
                  onClick={() => handleRosterPlayerClick(player)}
                >
                  <span className={styles.rosterNum}>#{player.number}</span>
                  <span className={styles.rosterName}>{player.name}</span>
                  <span className={styles.rosterPos}>{player.position}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Leader slots */}
          <div className={styles.slotsPanel}>
            <div className={styles.panelLabel}>
              {selectedNbaPlayer
                ? <span className={styles.panelLabelHint}>Click a slot to place <strong>{selectedNbaPlayer.name}</strong></span>
                : 'Click a player, then a slot'}
            </div>
            <div className={styles.slotsList}>
              {categories.map(({ key, label }) => {
                const filled = picks[key]
                return (
                  <div
                    key={key}
                    className={`${styles.leaderSlot} ${filled ? styles.leaderSlotFilled : styles.leaderSlotEmpty} ${selectedNbaPlayer && !filled ? styles.leaderSlotHighlight : ''}`}
                    onClick={() => handleSlotClick(key)}
                  >
                    <div className={styles.slotCatLabel}>{label}</div>
                    {filled ? (
                      <div className={styles.slotFilledContent}>
                        <span className={styles.slotFilledName}>{filled.name}</span>
                        <button className={styles.slotClearBtn} onClick={e => handleClearSlot(key, e)}>✕</button>
                      </div>
                    ) : (
                      <div className={styles.slotPlaceholder}>— pick a player —</div>
                    )}
                  </div>
                )
              })}
            </div>

            <button className={styles.validateBtn} disabled={!allSlotsFilled} onClick={handleValidate}>
              Validate picks →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
