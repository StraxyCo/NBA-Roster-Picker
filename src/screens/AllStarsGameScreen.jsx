import { useState, useRef, useMemo } from 'react'
import styles from './AllStarsGameScreen.module.css'

export default function AllStarsGameScreen({
  season,
  eastAllStars,
  westAllStars,
  eastPicks,
  westPicks,
  rosters,
  currentPlayer,
  onPick,
  onFinishEarly,
}) {
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [guess, setGuess] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef(null)

  const allStarIds = useMemo(() => {
    const ids = new Set()
    eastAllStars.forEach(p => ids.add(String(p.id)))
    westAllStars.forEach(p => ids.add(String(p.id)))
    return ids
  }, [eastAllStars, westAllStars])

  const allSeasonPlayers = useMemo(() => {
    const seasonRosters = rosters[season] || {}
    const seen = new Set()
    const players = []
    Object.values(seasonRosters).forEach(teamPlayers => {
      teamPlayers.forEach(p => {
        if (!seen.has(String(p.id))) {
          seen.add(String(p.id))
          players.push(p)
        }
      })
    })
    return players.sort((a, b) => a.name.localeCompare(b.name))
  }, [rosters, season])

  const pickedIds = useMemo(() => {
    const ids = new Set()
    eastPicks.forEach(p => ids.add(String(p.playerId)))
    westPicks.forEach(p => ids.add(String(p.playerId)))
    return ids
  }, [eastPicks, westPicks])

  const suggestions = useMemo(() => {
    if (guess.length < 2) return []
    const lower = guess.toLowerCase()
    return allSeasonPlayers
      .filter(p => !pickedIds.has(String(p.id)) && p.name.toLowerCase().includes(lower))
      .slice(0, 8)
  }, [guess, allSeasonPlayers, pickedIds])

  const eastFull = eastPicks.length >= eastAllStars.length
  const westFull = westPicks.length >= westAllStars.length
  const allFull  = eastFull && westFull

  function handleSelectSuggestion(player) {
    setSelectedPlayer(player)
    setGuess(player.name)
    setShowSuggestions(false)
  }

  function handleInputChange(e) {
    setGuess(e.target.value)
    setSelectedPlayer(null)
    setShowSuggestions(true)
  }

  function handlePlace(conference) {
    if (!selectedPlayer) return
    onPick({ playerId: selectedPlayer.id, playerName: selectedPlayer.name, conference })
    setSelectedPlayer(null)
    setGuess('')
    setShowSuggestions(false)
    setTimeout(() => inputRef.current?.focus(), 50)
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
        {/* ── Left panel: player search ───────────────────────────── */}
        <div className={styles.leftPanel}>
          <div className={styles.panelLabel}>Find player</div>

          <div className={styles.inputWrapper}>
            <input
              ref={inputRef}
              className={styles.input}
              value={guess}
              onChange={handleInputChange}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => guess.length >= 2 && setShowSuggestions(true)}
              placeholder="Type a player name…"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className={styles.suggestions}>
                {suggestions.map(p => (
                  <button
                    key={p.id}
                    className={styles.suggestion}
                    onMouseDown={() => handleSelectSuggestion(p)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

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
