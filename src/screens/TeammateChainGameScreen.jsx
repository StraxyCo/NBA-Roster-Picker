import { useState, useMemo } from 'react'
import { filterPlayers } from '../utils/teammateChain.js'
import styles from './TeammateChainGameScreen.module.css'

export default function TeammateChainGameScreen({
  chainPlayer,        // { id, name } — current player in the chain
  linkTeam,           // { teamAbbr, teamName, season } | null — last link's team (for "no same team" hint)
  noSameTeam,
  allPlayers,
  currentPlayer,      // human player's name
  scores, turnOrder,
  onSubmit,           // ({ guessPlayer, connection }) => void — connection: { season, teamAbbr } | null
  onBack,
}) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(null)
  const filtered = useMemo(() => filterPlayers(allPlayers, query), [allPlayers, query])

  function handleValidate() {
    if (!picked) return
    onSubmit({ guessPlayer: picked })
    setQuery('')
    setPicked(null)
  }

  return (
    <div className={styles.screen}>
      {/* Top bar */}
      <div className={styles.topBar}>
        {onBack && <button className={styles.backArrow} onClick={onBack}>←</button>}
        <div className={styles.scorePills}>
          {(turnOrder || []).map(name => (
            <span key={name} className={`${styles.scorePill} ${name === currentPlayer ? styles.scorePillActive : ''}`}>
              {name} · {scores?.[name] ?? 0}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {/* Chain player card */}
        <div className={styles.eyebrow}>{currentPlayer}'s turn</div>
        <div className={styles.chainCard}>
          <div className={styles.chainLabel}>Name a teammate of</div>
          <h2 className={styles.chainName}>{chainPlayer.name}</h2>
          {linkTeam && noSameTeam && (
            <div className={styles.chainConstraint}>
              Can't use {linkTeam.teamName} ({linkTeam.season})
            </div>
          )}
        </div>

        {/* Player search */}
        <div className={styles.pickerPanel}>
          <div className={`${styles.slot} ${picked ? styles.slotFilled : styles.slotEmpty}`}>
            {picked
              ? <><span className={styles.slotName}>{picked.name}</span><button className={styles.slotClear} onClick={() => { setPicked(null); setQuery('') }}>✕</button></>
              : <span className={styles.slotPlaceholder}>Search and select a player</span>
            }
          </div>

          <input
            className={styles.searchInput}
            autoFocus
            placeholder="Search player…"
            value={query}
            onChange={e => { setQuery(e.target.value); setPicked(null) }}
          />

          {filtered.length > 0 && !picked && (
            <div className={styles.searchList}>
              {filtered.map(p => (
                <button key={p.id} className={styles.searchItem} onClick={() => { setPicked(p); setQuery('') }}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {query.trim().length >= 2 && filtered.length === 0 && (
            <p className={styles.hint}>No players match "{query}"</p>
          )}

          {picked && (
            <button className={styles.validateBtn} onClick={handleValidate}>
              Submit →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
