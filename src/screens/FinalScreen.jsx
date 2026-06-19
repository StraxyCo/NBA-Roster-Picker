import { useState, useEffect, useMemo } from 'react'
import { SLOT_LABELS } from '../data/teams.js'
import { gradeRoster } from '../grading/engine.js'
import { loadShards } from '../grading/shards.js'
import RosterGrade from '../components/RosterGrade.jsx'
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

function fmtN(v, d = 1) {
  if (v == null) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : d === 0 ? Math.round(n).toString() : n.toFixed(d)
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

  const showStats = statMode && statMode !== 'standard'
  // On the final screen, stats are always visible — keepHidden only hides them during the game
  const statsInView = showStats

  // ── Roster grading (players mode only) ──────────────────────────────────────
  const gradingEnabled = gameMode === 'players'
  const [shards, setShards] = useState(null)

  useEffect(() => {
    if (!gradingEnabled) return
    const seasons = []
    for (const p of turnOrder) for (const e of rosters[p] || []) if (e?.season) seasons.push(e.season)
    let alive = true
    loadShards(seasons).then(s => { if (alive) setShards(s) })
    return () => { alive = false }
  }, [gradingEnabled])

  const grades = useMemo(() => {
    if (!gradingEnabled || !shards) return null
    const out = {}
    for (const p of turnOrder) {
      const picks = (rosters[p] || [])
        .map((e, i) => (e ? { nba_id: e.id, season: e.season, team: e.team, roster_slot: i + 1 } : null))
        .filter(Boolean)
      if (picks.length) out[p] = gradeRoster(picks, shards)
    }
    return out
  }, [gradingEnabled, shards, rosters, turnOrder])

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
            const total = statsInView ? rosterTotal(roster, statMode) : null

            return (
              <div key={player} className={`${styles.rosterCard} ${isWinner ? styles.rosterCardWinner : ''}`}>
                <div className={styles.rosterHeader}>
                  <span className={styles.rosterName}>{player}</span>
                  <span className={styles.rosterPicks}>{roster.filter(Boolean).length} / {rosterSize}</span>
                </div>

                <div className={styles.rosterSlots}>
                  {Array.from({ length: rosterSize }).map((_, i) => {
                    const entry = roster[i]
                    const statVal = statsInView && entry
                      ? entry[statKey]
                      : undefined

                    return (
                      <div key={i} className={`${styles.slot} ${entry ? styles.slotFilled : styles.slotEmpty}`}>
                        {gameMode === 'teams' ? (
                          <>
                            <span className={styles.slotLabel}>{i + 1}</span>
                            <div className={styles.slotBody}>
                              <span className={styles.slotPlayer}>
                                {entry
                                  ? <>{entry.name}<span className={styles.slotSeasonTag}>{entry.season}</span></>
                                  : <em>—</em>
                                }
                              </span>
                              {entry && (
                                <span className={styles.slotStatLine}>
                                  {fmtN(entry.gp, 0)}G · {fmtN(entry.min)}m · {fmtN(entry.pts)} · {fmtN(entry.reb)}r · {fmtN(entry.ast)}a
                                </span>
                              )}
                            </div>
                            {statsInView && entry && (
                              <span className={styles.slotStatVal}>
                                {formatStat(statVal, statMode)} {STAT_LABELS[statMode]}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className={styles.slotLabel}>{SLOT_LABELS[i] || i + 1}</span>
                            <div className={styles.slotBody}>
                              <span className={styles.slotPlayer}>
                                {entry
                                  ? <>{entry.name}{multiSeason && entry.season && <span className={styles.slotSeasonTag}>{entry.season}</span>}</>
                                  : <em>—</em>
                                }
                              </span>
                              {entry && (
                                <span className={styles.slotStatLine}>
                                  {fmtN(entry.gp, 0)}G · {fmtN(entry.min)}m · {fmtN(entry.pts)} · {fmtN(entry.reb)}r · {fmtN(entry.ast)}a
                                </span>
                              )}
                            </div>
                            {statsInView && entry ? (
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

                {/* Computed roster grade (players mode) */}
                {gradingEnabled && grades?.[player] && <RosterGrade grade={grades[player]} />}

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
