import { useState, useRef } from 'react'
import { SLOT_LABELS, getLogoUrl } from '../data/teams.js'
import styles from './PickPlayerScreen.module.css'

export default function PickPlayerScreen({ currentPlayer, team, season, nbaRoster, userRoster, rosterSize, multiSeason, onValidate }) {
  // Working copy of the user's roster for this session
  const [myRoster, setMyRoster] = useState([...userRoster])
  // Track which players from nbaRoster have been picked (by player id)
  const [pickedIds, setPickedIds] = useState(() => {
    const ids = new Set()
    userRoster.forEach(p => { if (p) ids.add(p.id) })
    return ids
  })

  // Click-to-assign state: first click = select source, second click = assign target
  const [selectedSource, setSelectedSource] = useState(null)
  // { type: 'nba', playerId } | { type: 'slot', slotIdx } | null

  // Drag state
  const dragSource = useRef(null)

  function handleNbaPlayerClick(player) {
    if (pickedIds.has(player.id)) return // already placed

    if (!selectedSource) {
      // Select this player as source
      setSelectedSource({ type: 'nba', player })
    } else if (selectedSource.type === 'nba' && selectedSource.player.id === player.id) {
      // Deselect
      setSelectedSource(null)
    } else {
      // Re-select different nba player
      setSelectedSource({ type: 'nba', player })
    }
  }

  function handleSlotClick(slotIdx) {
    if (!selectedSource) {
      // If slot is filled, select it as source (for reassignment)
      if (myRoster[slotIdx]) {
        setSelectedSource({ type: 'slot', slotIdx, player: myRoster[slotIdx] })
      }
      return
    }

    if (selectedSource.type === 'nba') {
      // Place NBA player into slot — attach season
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
      // Move player from one slot to another
      const fromIdx = selectedSource.slotIdx
      if (fromIdx === slotIdx) { setSelectedSource(null); return }

      const newRoster = [...myRoster]
      const displaced = newRoster[slotIdx]
      newRoster[slotIdx] = newRoster[fromIdx]
      newRoster[fromIdx] = displaced  // swap

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

  // ── Drag & Drop ──────────────────────────────────────────

  function onDragStartNba(e, player) {
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
      if (pickedIds.has(src.player.id)) return
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

  const canValidate = myRoster.some(p => p !== null)

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
            <p className={styles.hint}>Click a player, then click a slot — or drag & drop</p>
          </div>
        </div>

        <div className={styles.panels}>
          {/* NBA Roster panel */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Team Roster</span>
              <span className={styles.panelCount}>{nbaRoster.length} players</span>
            </div>
            <div className={styles.nbaList}>
              {nbaRoster.length === 0 && (
                <div className={styles.empty}>No roster data available</div>
              )}
              {nbaRoster.map(player => {
                const isPicked = pickedIds.has(player.id)
                const isSelected = selectedSource?.type === 'nba' && selectedSource.player.id === player.id
                return (
                  <div
                    key={player.id}
                    className={`${styles.nbaPlayer} ${isPicked ? styles.nbaPlayerPicked : ''} ${isSelected ? styles.nbaPlayerSelected : ''}`}
                    onClick={() => handleNbaPlayerClick(player)}
                    draggable={!isPicked}
                    onDragStart={e => onDragStartNba(e, player)}
                  >
                    <span className={styles.playerPos}>{player.position || '—'}</span>
                    <span className={styles.playerName}>{player.name}</span>
                    {isPicked && <span className={styles.pickedBadge}>✓</span>}
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
                const isSelected = selectedSource?.type === 'slot' && selectedSource.slotIdx === i
                const isTarget = selectedSource !== null && !player
                const isTargetFilled = selectedSource !== null && !!player && !(selectedSource.type === 'slot' && selectedSource.slotIdx === i)
                return (
                  <div
                    key={i}
                    className={`${styles.slot}
                      ${player ? styles.slotFilled : ''}
                      ${isSelected ? styles.slotSelected : ''}
                      ${isTarget ? styles.slotTarget : ''}
                      ${isTargetFilled ? styles.slotTargetFilled : ''}
                    `}
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

        {/* Validate button */}
        <button
          className={styles.validateBtn}
          onClick={() => onValidate(myRoster)}
          disabled={!canValidate}
        >
          Validate Picks
        </button>
      </div>
    </div>
  )
}
