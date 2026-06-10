import { useState, useMemo, useRef } from 'react'
import { SLOT_LABELS, getLogoUrl } from '../data/teams.js'
import styles from './PickPlayerScreen.module.css'

// Basketball-Reference team abbreviation differs from NBA API in a few cases
function getBrefUrl(teamAbbr, season) {
  if (!season) return null
  const startYear = parseInt(season)   // parseInt('2009-10') → 2009
  const endYear = startYear + 1
  let a = teamAbbr
  if (teamAbbr === 'PHX') a = 'PHO'
  else if (teamAbbr === 'BKN') a = endYear < 2013 ? 'NJN' : 'BRK'
  else if (teamAbbr === 'CHA') a = endYear < 2015 ? 'CHA' : 'CHO'
  else if (teamAbbr === 'NOP') a = endYear === 2006 ? 'NOK' : endYear < 2014 ? 'NOH' : 'NOP'
  else if (teamAbbr === 'OKC') a = endYear < 2009 ? 'SEA' : 'OKC'
  return `https://www.basketball-reference.com/teams/${a}/${endYear}.html`
}

function fmtN(v, d = 1) {
  if (v == null) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : d === 0 ? Math.round(n).toString() : n.toFixed(d)
}

const COL_HEADERS = [
  { key: 'gp',  label: 'GP' },
  { key: 'min', label: 'MIN' },
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
]

export default function PickPlayerScreen({ currentPlayer, team, season, nbaRoster, userRoster, rosterSize, multiSeason, statMode, keepHidden, bans = 0, bannedPlayers = {}, onValidate, onBanPlayer, globalPickedIds = new Set() }) {
  const [myRoster, setMyRoster] = useState([...userRoster])
  const [pickedIds, setPickedIds] = useState(() => {
    const ids = new Set()
    userRoster.forEach(p => { if (p) ids.add(p.id) })
    return ids
  })
  const [selectedSource, setSelectedSource] = useState(null)
  const [sortBy, setSortBy] = useState('pts')
  const [banMode, setBanMode] = useState(false)
  const dragSource = useRef(null)
  const bansUsedByCurrentPlayer = Object.keys(bannedPlayers[currentPlayer] || {}).length
  const bansRemaining = bans - bansUsedByCurrentPlayer

  const sortedRoster = useMemo(() => {
    const arr = [...nbaRoster]
    if (sortBy === 'alpha') return arr.sort((a, b) => a.name.localeCompare(b.name))
    return arr.sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0))
  }, [nbaRoster, sortBy])

  function isUnavailable(id) {
    const isBanned = Object.values(bannedPlayers).some(userBans => userBans[id])
    return pickedIds.has(id) || globalPickedIds.has(id) || isBanned
  }

  function handleNbaPlayerClick(player) {
    if (banMode) {
      const currentPlayerBans = bannedPlayers[currentPlayer] || {}
      if (bansRemaining > 0 && !currentPlayerBans[player.id] && !pickedIds.has(player.id) && !globalPickedIds.has(player.id)) {
        onBanPlayer(player.id)
        setBanMode(false)
      }
      return
    }
    if (isUnavailable(player.id)) return
    if (!selectedSource) {
      setSelectedSource({ type: 'nba', player })
    } else if (selectedSource.type === 'nba' && selectedSource.player.id === player.id) {
      setSelectedSource(null)
    } else {
      setSelectedSource({ type: 'nba', player })
    }
  }

  function handleSlotClick(slotIdx) {
    if (!selectedSource) {
      if (myRoster[slotIdx]) {
        setSelectedSource({ type: 'slot', slotIdx, player: myRoster[slotIdx] })
      }
      return
    }
    if (selectedSource.type === 'nba') {
      const prev = myRoster[slotIdx]
      const newRoster = [...myRoster]
      newRoster[slotIdx] = { ...selectedSource.player, season }
      const newPicked = new Set(pickedIds)
      newPicked.add(selectedSource.player.id)
      if (prev) newPicked.delete(prev.id)
      setMyRoster(newRoster)
      setPickedIds(newPicked)
      setSelectedSource(null)
    } else if (selectedSource.type === 'slot') {
      const fromIdx = selectedSource.slotIdx
      if (fromIdx === slotIdx) { setSelectedSource(null); return }
      const newRoster = [...myRoster]
      const displaced = newRoster[slotIdx]
      newRoster[slotIdx] = newRoster[fromIdx]
      newRoster[fromIdx] = displaced
      setMyRoster(newRoster)
      setSelectedSource(null)
    }
  }

  function handleRemoveFromSlot(slotIdx) {
    const player = myRoster[slotIdx]
    if (!player) return
    const newRoster = [...myRoster]
    newRoster[slotIdx] = null
    const newPicked = new Set(pickedIds)
    newPicked.delete(player.id)
    setMyRoster(newRoster)
    setPickedIds(newPicked)
    setSelectedSource(null)
  }

  function onDragStartNba(e, player) {
    if (isUnavailable(player.id)) { e.preventDefault(); return }
    dragSource.current = { type: 'nba', player }
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragStartSlot(e, slotIdx) {
    if (!myRoster[slotIdx]) { e.preventDefault(); return }
    dragSource.current = { type: 'slot', slotIdx, player: myRoster[slotIdx] }
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOverSlot(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function onDropSlot(e, slotIdx) {
    e.preventDefault()
    const src = dragSource.current
    if (!src) return
    if (src.type === 'nba') {
      if (isUnavailable(src.player.id)) return
      const prev = myRoster[slotIdx]
      const newRoster = [...myRoster]
      newRoster[slotIdx] = { ...src.player, season }
      const newPicked = new Set(pickedIds)
      newPicked.add(src.player.id)
      if (prev) newPicked.delete(prev.id)
      setMyRoster(newRoster)
      setPickedIds(newPicked)
    } else if (src.type === 'slot') {
      const fromIdx = src.slotIdx
      if (fromIdx === slotIdx) return
      const newRoster = [...myRoster]
      const displaced = newRoster[slotIdx]
      newRoster[slotIdx] = newRoster[fromIdx]
      newRoster[fromIdx] = displaced
      setMyRoster(newRoster)
    }
    dragSource.current = null
    setSelectedSource(null)
  }

  const [showStatReveal, setShowStatReveal] = useState(false)
  const [pendingRoster, setPendingRoster]   = useState(null)

  function countFilledSlots(roster) { return roster.filter(p => p !== null).length }
  const originalCount = countFilledSlots(userRoster)
  const currentCount  = countFilledSlots(myRoster)
  const canValidate   = currentCount === originalCount + 1

  function handleValidate() {
    if (statMode !== 'standard' && !keepHidden) {
      setPendingRoster(myRoster)
      setShowStatReveal(true)
    } else {
      onValidate(myRoster)
    }
  }

  function getStatValue(player) {
    if (!player || !statMode || statMode === 'standard') return null
    const v = player[statMode]
    if (v === undefined || v === null) return '—'
    return statMode === 'fg3m' ? v : v.toFixed(1)
  }

  function statLabel() {
    const labels = { pts: 'PPG', reb: 'RPG', ast: 'APG', stl: 'SPG', blk: 'BPG', fg3m: '3PM (season)' }
    return labels[statMode] || statMode
  }

  const brefUrl = season ? getBrefUrl(team.abbr, season) : null

  return (
    <div className={styles.screen}>
      <div className={styles.content}>

        {/* Team header */}
        <div className={styles.teamHeader}>
          <img
            src={getLogoUrl(team.slug)}
            alt={team.name}
            className={styles.teamLogo}
            onError={e => { e.target.style.opacity = '0.3' }}
          />
          <div className={styles.teamInfo}>
            <div className={styles.eyebrow}>{currentPlayer}'s pick</div>
            <h1 className={styles.teamName}>{team.name}{season ? <span className={styles.teamSeason}> · {season}</span> : ''}</h1>
            {brefUrl && (
              <a href={brefUrl} target="_blank" rel="noreferrer" className={styles.brefBtn}>
                Basketball Reference ↗
              </a>
            )}
          </div>
        </div>

        {bans > 0 && (
          <div className={styles.banSection}>
            <button
              className={`${styles.banBtn} ${banMode ? styles.banBtnActive : ''} ${bansRemaining === 0 ? styles.banBtnDisabled : ''}`}
              onClick={() => setBanMode(!banMode)}
              disabled={bansRemaining === 0}
            >
              {banMode ? 'Cancel ban' : `Ban (${bansRemaining})`}
            </button>
            {banMode && <span className={styles.banHint}>Click a player to ban</span>}
          </div>
        )}

        <div className={styles.panels}>
          {/* NBA Roster panel */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Team Roster</span>
              <span className={styles.panelCount}>{nbaRoster.length} players</span>
            </div>
            {/* Column header — mirrors exact flex structure of player rows */}
            <div className={styles.statsColHeader}>
              <span className={styles.colPosSpacer} />
              <button
                className={`${styles.colHeaderName} ${sortBy === 'alpha' ? styles.colHeaderActive : ''}`}
                onClick={() => setSortBy('alpha')}
              >
                Player
              </button>
              <div className={styles.colHeaderStats}>
                {COL_HEADERS.map(({ key, label }) => (
                  <button
                    key={key}
                    className={`${styles.colStatBtn} ${sortBy === key ? styles.colHeaderActive : ''}`}
                    onClick={() => setSortBy(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.nbaList}>
              {nbaRoster.length === 0 && (
                <div className={styles.empty}>No roster data available</div>
              )}
              {sortedRoster.map(player => {
                const isBanned   = Object.values(bannedPlayers).some(userBans => userBans[player.id])
                const isPicked   = isUnavailable(player.id)
                const isSelected = selectedSource?.type === 'nba' && selectedSource.player.id === player.id
                return (
                  <div
                    key={player.id}
                    className={`${styles.nbaPlayer} ${isBanned ? styles.nbaPlayerBanned : ''} ${isPicked ? styles.nbaPlayerPicked : ''} ${isSelected ? styles.nbaPlayerSelected : ''}`}
                    onClick={() => handleNbaPlayerClick(player)}
                    draggable={!isPicked}
                    onDragStart={e => onDragStartNba(e, player)}
                  >
                    <span className={styles.playerPos}>{player.position || '—'}</span>
                    <span className={styles.playerName}>{player.name}</span>
                    <div className={styles.playerStats}>
                      <span>{fmtN(player.gp, 0)}</span>
                      <span>{fmtN(player.min)}</span>
                      <span>{fmtN(player.pts)}</span>
                      <span>{fmtN(player.reb)}</span>
                      <span>{fmtN(player.ast)}</span>
                    </div>
                    {isPicked  && <span className={styles.pickedBadge}>✓</span>}
                    {isSelected && <span className={styles.selectedArrow}>→</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* User roster panel */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>{currentPlayer}'s Roster</span>
              <span className={styles.panelCount}>
                {myRoster.filter(Boolean).length}/{rosterSize}
              </span>
            </div>
            <div className={styles.slotList}>
              {Array.from({ length: rosterSize }).map((_, i) => {
                const player = myRoster[i]
                const isSelected     = selectedSource?.type === 'slot' && selectedSource.slotIdx === i
                const isTarget       = selectedSource !== null && !player
                const isTargetFilled = selectedSource !== null && !!player && !(selectedSource.type === 'slot' && selectedSource.slotIdx === i)
                return (
                  <div
                    key={i}
                    className={`${styles.slot} ${player ? styles.slotFilled : ''} ${isSelected ? styles.slotSelected : ''} ${isTarget ? styles.slotTarget : ''} ${isTargetFilled ? styles.slotTargetFilled : ''}`}
                    onClick={() => handleSlotClick(i)}
                    onDragOver={onDragOverSlot}
                    onDrop={e => onDropSlot(e, i)}
                    draggable={!!player}
                    onDragStart={e => onDragStartSlot(e, i)}
                  >
                    <span className={styles.slotLabel}>{SLOT_LABELS[i] || i + 1}</span>
                    <span className={styles.slotContent}>
                      {player
                        ? <>
                            {player.name}
                            {multiSeason && player.season && (
                              <span className={styles.slotSeasonTag}>{player.season}</span>
                            )}
                          </>
                        : <em className={styles.slotEmpty}>Drop here</em>
                      }
                    </span>
                    {player && (
                      <button
                        className={styles.removeBtn}
                        onClick={e => { e.stopPropagation(); handleRemoveFromSlot(i) }}
                        title="Remove player"
                      >×</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <button className={styles.validateBtn} onClick={handleValidate} disabled={!canValidate}>
          Validate Picks
        </button>
      </div>

      {showStatReveal && pendingRoster && (
        <div className={styles.revealOverlay}>
          <div className={styles.revealModal}>
            <div className={styles.revealEyebrow}>{statLabel()}</div>
            <h2 className={styles.revealTitle}>{currentPlayer}'s picks</h2>
            <div className={styles.revealList}>
              {pendingRoster.filter(Boolean).map((p, i) => (
                <div key={i} className={styles.revealRow}>
                  <span className={styles.revealName}>{p.name}</span>
                  <span className={styles.revealStat}>{getStatValue(p) ?? '—'}</span>
                </div>
              ))}
            </div>
            <button className={styles.validateBtn} style={{ marginTop: '16px' }} onClick={() => { setShowStatReveal(false); onValidate(pendingRoster) }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
