import { useState } from 'react'
import { SLOT_LABELS } from '../data/teams.js'
import styles from './FinalScreen.module.css'

const STAT_LABELS = {
  pts: 'PPG', reb: 'RPG', ast: 'APG', stl: 'SPG', blk: 'BPG', fg3m: '3PM',
  wins: 'W', losses: 'L',
}

const STAT_TOTAL_LABELS = {
  pts: 'Total PPG', reb: 'Total RPG', ast: 'Total APG',
  stl: 'Total SPG', blk: 'Total BPG', fg3m: 'Total 3PM',
  wins: 'Total Wins', losses: 'Total Losses',
}

function getStatKey(statMode) {
  if (statMode === 'wins')   return 'w'
  if (statMode === 'losses') return 'l'
  return statMode
}

function formatStat(val, statMode) {
  if (val === undefined || val === null) return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  // fg3m, wins, losses are integers
  if (['fg3m', 'wins', 'losses'].includes(statMode)) return Math.round(n)
  return n.toFixed(1)
}

function rosterTotal(roster, statMode) {
  if (!statMode || statMode === 'standard') return null
  const key = getStatKey(statMode)
  return roster.filter(Boolean).reduce((sum, p) => sum + (parseFloat(p[key]) || 0), 0)
}

export default function FinalScreen({ rosters, turnOrder, rosterSize, multiSeason, gameMode, statMode, keepHidden, onDeclareWinner, onRestart }) {
  const [winner, setWinner]     = useState(null)
  const [declared, setDeclared] = useState(false)
  const [saving, setSaving]     = useState(false)

  const showStats   = statMode && statMode !== 'standard'
  // Stats visible in roster view: only if not hidden
  const statsInView = showStats && !keepHidden
  // Stats revealed once winner is declared (always, even if was hidden)
  const statsRevealed = showStats && declared

  async function declareWinner(player) {
    setWinner(player)
    setDeclared(true)
    setSaving(true)
    try { await onDeclareWinner(player) } catch (e) { console.error(e) }
    setSaving(false)
  }

  const statKey = getStatKey(statMode)

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
            const total = (statsInView || statsRevealed) ? rosterTotal(roster, statMode) : null

            return (
              <div key={player} className={`${styles.rosterCard} ${isWinner ? styles.rosterCardWinner : ''}`}>
                <div className={styles.rosterHeader}>
                  <span className={styles.rosterName}>{player}</span>
                  <span className={styles.rosterPicks}>{roster.filter(Boolean).length} / {rosterSize}</span>
                </div>

                <div className={styles.rosterSlots}>
                  {Array.from({ length: rosterSize }).map((_, i) => {
                    const entry = roster[i]
                    const statVal = (statsInView || statsRevealed) && entry
                      ? entry[statKey]
                      : undefined

                    return (
                      <div key={i} className={`${styles.slot} ${entry ? styles.slotFilled : styles.slotEmpty}`}>
                        {gameMode === 'teams' ? (
                          <>
                            <span className={styles.slotLabel}>{i + 1}</span>
                            <span className={styles.slotPlayer}>
                              {entry
                                ? <>{entry.name}<span className={styles.slotSeasonTag}>{entry.season}</span></>
                                : <em>—</em>
                              }
                            </span>
                            {(statsInView || statsRevealed) && entry && (
                              <span className={styles.slotStatVal}>
                                {formatStat(statVal, statMode)} {STAT_LABELS[statMode]}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className={styles.slotLabel}>{SLOT_LABELS[i] || i + 1}</span>
                            <span className={styles.slotPlayer}>
                              {entry
                                ? <>{entry.name}{multiSeason && entry.season && <span className={styles.slotSeasonTag}>{entry.season}</span>}</>
                                : <em>—</em>
                              }
                            </span>
                            {(statsInView || statsRevealed) && entry ? (
                              <span className={styles.slotStatVal}>
                                {formatStat(statVal, statMode)} {STAT_LABELS[statMode]}
                              </span>
                            ) : entry ? (
                              <span className={styles.slotPos}>{entry.position}</span>
                            ) : null}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Total — shown when stats visible */}
                {total !== null && (
                  <div className={styles.rosterTotal}>
                    <span className={styles.rosterTotalLabel}>{STAT_TOTAL_LABELS[statMode]}</span>
                    <span className={styles.rosterTotalValue}>
                      {formatStat(total, statMode)}
                    </span>
                  </div>
                )}

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
