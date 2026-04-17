import { useState } from 'react'
import { SLOT_LABELS } from '../data/teams.js'
import styles from './FinalScreen.module.css'

export default function FinalScreen({ rosters, turnOrder, rosterSize, multiSeason, gameMode, statMode, onDeclareWinner, onRestart }) {
  const [winner, setWinner]     = useState(null)
  const [declared, setDeclared] = useState(false)
  const [saving, setSaving]     = useState(false)

  async function declareWinner(player) {
    setWinner(player)
    setDeclared(true)
    setSaving(true)
    try { await onDeclareWinner(player) } catch (e) { console.error(e) }
    setSaving(false)
  }

  function getStatKey() {
    if (statMode === 'wins')   return 'w'
    if (statMode === 'losses') return 'l'
    return statMode // pts, reb, ast, stl, blk, fg3m
  }

  function statLabel() {
    const m = { pts: 'PPG Total', reb: 'RPG Total', ast: 'APG Total', stl: 'SPG Total', blk: 'BPG Total', fg3m: '3PM Total', wins: 'Total Wins', losses: 'Total Losses' }
    return m[statMode] || ''
  }

  function rosterTotal(roster) {
    if (!statMode || statMode === 'standard') return null
    const key = getStatKey()
    return roster.filter(Boolean).reduce((sum, p) => sum + (parseFloat(p[key]) || 0), 0)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <header className={styles.header}>
          {declared ? (
            <div className={styles.winnerHero}>
              <div className={styles.trophy}>🏆</div>
              <div className={styles.winnerEyebrow}>Winner</div>
              <h1 className={styles.winnerName}>{winner}</h1>
              <div className={styles.confetti} aria-hidden="true">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span key={i} className={styles.confettiPiece} style={{
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 0.8}s`,
                    animationDuration: `${0.8 + Math.random() * 0.6}s`,
                    background: i % 3 === 0 ? 'var(--gold)' : i % 3 === 1 ? '#fff' : '#4a9eff',
                  }} />
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className={styles.eyebrow}>Draft Complete</div>
              <h1 className={styles.title}>Final<br />Rosters</h1>
            </>
          )}
        </header>

        <div className={styles.rostersGrid}>
          {turnOrder.map((player) => {
            const roster = rosters[player] || []
            const isWinner = declared && winner === player
            return (
              <div key={player} className={`${styles.rosterCard} ${isWinner ? styles.rosterCardWinner : ''}`}>
                <div className={styles.rosterHeader}>
                  <span className={styles.rosterName}>{player}</span>
                  <span className={styles.rosterPicks}>{roster.filter(Boolean).length} / {rosterSize}</span>
                </div>
                <div className={styles.rosterSlots}>
                  {Array.from({ length: rosterSize }).map((_, i) => {
                    const entry = roster[i]
                    return (
                      <div key={i} className={`${styles.slot} ${entry ? styles.slotFilled : styles.slotEmpty}`}>
                        {gameMode === 'teams' ? (
                          // Teams mode: show team name + season
                          <>
                            <span className={styles.slotLabel}>{i + 1}</span>
                            <span className={styles.slotPlayer}>
                              {entry
                                ? <>{entry.name}<span className={styles.slotSeasonTag}>{entry.season}</span></>
                                : <em>—</em>
                              }
                            </span>
                            {entry && statMode !== 'standard' && (
                              <span className={styles.slotPos}>
                                {statMode === 'wins' ? entry.w : statMode === 'losses' ? entry.l : ''}
                              </span>
                            )}
                          </>
                        ) : (
                          // Players mode
                          <>
                            <span className={styles.slotLabel}>{SLOT_LABELS[i] || i + 1}</span>
                            <span className={styles.slotPlayer}>
                              {entry
                                ? <>{entry.name}{multiSeason && entry.season && <span className={styles.slotSeasonTag}>{entry.season}</span>}</>
                                : <em>—</em>
                              }
                            </span>
                            {entry && <span className={styles.slotPos}>{entry.position}</span>}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Stat total */}
                {statMode !== 'standard' && (() => {
                  const total = rosterTotal(roster)
                  return total !== null ? (
                    <div className={styles.rosterTotal}>
                      <span className={styles.rosterTotalLabel}>{statLabel()}</span>
                      <span className={styles.rosterTotalValue}>
                        {Number.isInteger(total) ? total : total.toFixed(1)}
                      </span>
                    </div>
                  ) : null
                })()}
                {!declared && (
                  <button className={styles.declareBtn} onClick={() => declareWinner(player)}>
                    🏆 {player} wins!
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.actions}>
          {declared && (
            <div className={styles.wonMessage}>
              Congratulations, <strong>{winner}</strong>! 🎉
              {saving && <span className={styles.savingNote}> Saving…</span>}
            </div>
          )}
          <button className={styles.restartBtn} onClick={onRestart}>New Game</button>
        </div>
      </div>
    </div>
  )
}
