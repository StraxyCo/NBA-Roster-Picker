import { useState, useMemo } from 'react'
import { NBA_TEAMS } from '../data/teams.js'
import styles from './AllStarsGameScreen.module.css'

const TEAM_BY_ID = Object.fromEntries(NBA_TEAMS.map(t => [String(t.id), t]))
const TEAMS_SORTED = [...NBA_TEAMS].sort((a, b) => a.name.localeCompare(b.name))

function fmtStat(val) {
  if (val == null || val === 0) return '—'
  return Number(val).toFixed(1)
}

export default function AllStarsGameScreen({
  season,
  eastAllStars,
  westAllStars,
  eastPicks,
  westPicks,
  rosters,
  config,
  currentPlayer,
  onPick,
  onFinishEarly,
}) {
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const allStarIds = useMemo(() => {
    const ids = new Set()
    eastAllStars.forEach(p => ids.add(String(p.id)))
    westAllStars.forEach(p => ids.add(String(p.id)))
    return ids
  }, [eastAllStars, westAllStars])

  const teamAllStarCount = useMemo(() => {
    if (!config.showTeamHints) return {}
    const seasonRosters = rosters[season] || {}
    const counts = {}
    Object.entries(seasonRosters).forEach(([teamId, players]) => {
      const n = players.filter(p => allStarIds.has(String(p.id))).length
      if (n > 0) counts[teamId] = n
    })
    return counts
  }, [rosters, season, allStarIds, config.showTeamHints])

  const rosterPlayers = useMemo(() => {
    if (!selectedTeamId) return []
    return [...(rosters[season]?.[selectedTeamId] || [])].sort((a, b) => a.name.localeCompare(b.name))
  }, [rosters, season, selectedTeamId])

  const pickedIds = useMemo(() => {
    const ids = new Set()
    eastPicks.forEach(p => ids.add(String(p.playerId)))
    westPicks.forEach(p => ids.add(String(p.playerId)))
    return ids
  }, [eastPicks, westPicks])

  const eastFull = eastPicks.length >= eastAllStars.length
  const westFull = westPicks.length >= westAllStars.length
  const allFull  = eastFull && westFull

  function handlePlayerClick(player) {
    if (pickedIds.has(String(player.id))) return
    setSelectedPlayer(prev => prev?.id === player.id ? null : player)
  }

  function handlePlace(conference) {
    if (!selectedPlayer) return
    onPick({ playerId: selectedPlayer.id, playerName: selectedPlayer.name, conference })
    setSelectedPlayer(null)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <span className={styles.eyebrow}>{currentPlayer}'s pick</span>
        <span className={styles.seasonBadge}>{season} All-Stars</span>
        {!allFull && (
          <button className={styles.finishEarlyBtn} onClick={onFinishEarly}>End game →</button>
        )}
      </div>

      <div className={styles.layout}>
        {/* ── Left panel: team picker + roster ───────────────────────────── */}
        <div className={styles.leftPanel}>
          <div className={styles.panelLabel}>Browse roster</div>

          <select
            className={styles.select}
            value={selectedTeamId}
            onChange={e => { setSelectedTeamId(e.target.value); setSelectedPlayer(null) }}
          >
            <option value="">Select a team…</option>
            {TEAMS_SORTED.map(t => {
              const count = teamAllStarCount[String(t.id)]
              return (
                <option key={t.id} value={String(t.id)}>
                  {t.abbr} — {t.name}{count ? ` (${count} ★)` : ''}
                </option>
              )
            })}
          </select>

          {rosterPlayers.length > 0 && (
            <div className={styles.rosterList}>
              {config.showPlayerStats && (
                <div className={styles.rosterHeader}>
                  <span className={styles.rosterHeaderName}>Player</span>
                  <span className={styles.rosterHeaderStat}>GP</span>
                  <span className={styles.rosterHeaderStat}>PTS</span>
                  <span className={styles.rosterHeaderStat}>REB</span>
                  <span className={styles.rosterHeaderStat}>AST</span>
                </div>
              )}
              {rosterPlayers.map(p => {
                const isPicked  = pickedIds.has(String(p.id))
                const isSelected = selectedPlayer?.id === p.id
                const isAllStar  = allStarIds.has(String(p.id))
                return (
                  <button
                    key={p.id}
                    className={`${styles.rosterBtn}
                      ${isSelected ? styles.rosterBtnSelected : ''}
                      ${isPicked   ? styles.rosterBtnPicked : ''}
                      ${isAllStar && !isPicked ? styles.rosterBtnAllStar : ''}`}
                    onClick={() => handlePlayerClick(p)}
                    disabled={isPicked}
                  >
                    <span className={styles.rosterBtnName}>{p.name}</span>
                    {config.showPlayerStats && (
                      <>
                        <span className={styles.rosterBtnStat}>{p.gp != null ? Math.round(p.gp) : '—'}</span>
                        <span className={styles.rosterBtnStat}>{fmtStat(p.pts)}</span>
                        <span className={styles.rosterBtnStat}>{fmtStat(p.reb)}</span>
                        <span className={styles.rosterBtnStat}>{fmtStat(p.ast)}</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {!selectedTeamId && (
            <p className={styles.hint}>Select a team to browse its roster.</p>
          )}

          {/* Place buttons */}
          {selectedPlayer && (
            <div className={styles.placeBar}>
              <span className={styles.placeName}>{selectedPlayer.name}</span>
              <div className={styles.placeBtns}>
                <button
                  className={`${styles.placeBtn} ${styles.placeBtnEast}`}
                  onClick={() => handlePlace('east')}
                  disabled={eastFull}
                >East{eastFull ? ' (full)' : ''}</button>
                <button
                  className={`${styles.placeBtn} ${styles.placeBtnWest}`}
                  onClick={() => handlePlace('west')}
                  disabled={westFull}
                >West{westFull ? ' (full)' : ''}</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel: East + West slots ─────────────────────────────── */}
        <div className={styles.rightPanel}>
          {/* East */}
          <div className={styles.confSection}>
            <div className={`${styles.confSectionHeader} ${styles.confHeaderEast}`}>
              EAST <span className={styles.confCount}>{eastPicks.length}/{eastAllStars.length}</span>
            </div>
            <div className={styles.slotList}>
              {Array.from({ length: eastAllStars.length }).map((_, i) => {
                const pick = eastPicks[i]
                return pick ? (
                  <div key={i} className={styles.slotFilled}>
                    <span className={styles.slotPlayerName}>{pick.playerName}</span>
                    <span className={styles.slotPicker}>{pick.pickedBy}</span>
                  </div>
                ) : (
                  <div key={i} className={styles.slotEmpty}>
                    <span className={styles.slotPlaceholder}>—</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* West */}
          <div className={styles.confSection}>
            <div className={`${styles.confSectionHeader} ${styles.confHeaderWest}`}>
              WEST <span className={styles.confCount}>{westPicks.length}/{westAllStars.length}</span>
            </div>
            <div className={styles.slotList}>
              {Array.from({ length: westAllStars.length }).map((_, i) => {
                const pick = westPicks[i]
                return pick ? (
                  <div key={i} className={styles.slotFilled}>
                    <span className={styles.slotPlayerName}>{pick.playerName}</span>
                    <span className={styles.slotPicker}>{pick.pickedBy}</span>
                  </div>
                ) : (
                  <div key={i} className={styles.slotEmpty}>
                    <span className={styles.slotPlaceholder}>—</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
