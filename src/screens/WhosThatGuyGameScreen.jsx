import { useState, useMemo } from 'react'
import { NBA_TEAMS } from '../data/teams.js'
import styles from './WhosThatGuyGameScreen.module.css'

const TEAM_BY_ID = Object.fromEntries(NBA_TEAMS.map(t => [String(t.id), t]))

function fmtSeason(s) { return s.slice(2) } // "2005-06" → "05-06"
function fmtStat(key, val) {
  if (val == null) return '—'
  if (key === 'gp') return String(Math.round(val))
  return Number(val).toFixed(1)
}

// mysteryPlayer: { id, name, seasons: [{season, teamAbbr, gp, pts, reb, ast, fg3m, ...}] }
// rosters: { [season]: { [teamId]: [{id, name, ...}] } }
export default function WhosThatGuyGameScreen({ mysteryPlayer, rosters, showTeams, currentPlayer, onResult }) {
  const [phase, setPhase]               = useState('picking')
  const [selectedSeason, setSelectedSeason] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [pickedPlayer, setPickedPlayer] = useState(null)

  const rosterSeasons = useMemo(() => Object.keys(rosters).sort(), [rosters])

  const teamsForSeason = useMemo(() => {
    if (!selectedSeason || !rosters[selectedSeason]) return []
    return Object.keys(rosters[selectedSeason])
      .map(id => TEAM_BY_ID[id])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rosters, selectedSeason])

  const rosterPlayers = useMemo(() => {
    if (!selectedSeason || !selectedTeamId) return []
    return rosters[selectedSeason]?.[selectedTeamId] || []
  }, [rosters, selectedSeason, selectedTeamId])

  function handleSeasonChange(s) {
    setSelectedSeason(s)
    setSelectedTeamId('')
  }

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

              {/* Slot */}
              <div className={`${styles.slot} ${pickedPlayer ? styles.slotFilled : styles.slotEmpty}`}>
                {pickedPlayer ? (
                  <>
                    <span className={styles.slotName}>{pickedPlayer.name}</span>
                    <button className={styles.slotClear} onClick={() => setPickedPlayer(null)}>✕</button>
                  </>
                ) : (
                  <span className={styles.slotPlaceholder}>Select a player below</span>
                )}
              </div>

              {/* Dropdowns */}
              <div className={styles.dropdownRow}>
                <select
                  className={styles.select}
                  value={selectedSeason}
                  onChange={e => handleSeasonChange(e.target.value)}
                >
                  <option value="">Season…</option>
                  {rosterSeasons.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  className={styles.select}
                  value={selectedTeamId}
                  onChange={e => setSelectedTeamId(e.target.value)}
                  disabled={!selectedSeason}
                >
                  <option value="">Team…</option>
                  {teamsForSeason.map(t => <option key={t.id} value={String(t.id)}>{t.abbr} — {t.name}</option>)}
                </select>
              </div>

              {/* Roster list */}
              {rosterPlayers.length > 0 && (
                <div className={styles.rosterList}>
                  {rosterPlayers
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(p => (
                      <button
                        key={p.id}
                        className={`${styles.rosterBtn} ${pickedPlayer?.id === p.id ? styles.rosterBtnActive : ''}`}
                        onClick={() => handlePickPlayer(p)}
                      >
                        {p.name}
                      </button>
                    ))
                  }
                </div>
              )}

              {!selectedSeason && (
                <p className={styles.hint}>Select a season and team to browse rosters.</p>
              )}

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
