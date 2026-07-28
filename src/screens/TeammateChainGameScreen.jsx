import { useState, useMemo } from 'react'
import { filterPlayers } from '../utils/teammateChain.js'
import styles from './TeammateChainGameScreen.module.css'

export default function TeammateChainGameScreen({
  chainPlayer,        // { id, name } — current player in the chain
  excluded,           // [{ teamName, season }] — team-seasons consumed by the last link
  exceptionActive,    // bool — exclusion lifted (chain player only played the excluded team-seasons)
  noSameTeam,
  allPlayers,
  currentPlayer,      // human player guessing now
  roster,             // [{ id, name }] — all human players, in turn order
  lives,              // { [playerId]: livesLeft }
  maxLives,
  currentPlayerId,
  lastOutcome,        // result of the previous guess (banner), or null
  onSubmit,           // ({ guessPlayer }) => void
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
        <div className={styles.players}>
          {(roster || []).map(p => {
            const left = lives?.[p.id] ?? 0
            const out = left === 0
            return (
              <div key={p.id} className={`${styles.playerChip} ${p.id === currentPlayerId ? styles.playerActive : ''} ${out ? styles.playerOut : ''}`}>
                <span className={styles.playerName}>{p.name}</span>
                <span className={styles.playerLives}>
                  {Array.from({ length: maxLives }, (_, i) => (
                    <span key={i} className={i < left ? styles.lifeFull : styles.lifeLost}>♥</span>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.content}>
        {lastOutcome && (
          <div className={`${styles.outcome} ${lastOutcome.correct ? styles.outcomeCorrect : styles.outcomeWrong}`}>
            {lastOutcome.correct ? (
              <>✓ {lastOutcome.guessedPlayer} played with {lastOutcome.prevPlayer} — {lastOutcome.connection.teamName} {lastOutcome.connection.season}</>
            ) : (
              <>✗ {lastOutcome.guessedPlayer} doesn't link to {lastOutcome.prevPlayer} — {lastOutcome.livesLeft === 0 ? `${lastOutcome.guesser} is out` : `${lastOutcome.livesLeft} ${lastOutcome.livesLeft === 1 ? 'life' : 'lives'} left, try again`}</>
            )}
          </div>
        )}

        {/* Chain player card */}
        <div className={styles.eyebrow}>{currentPlayer}'s turn</div>
        <div className={styles.chainCard}>
          <div className={styles.chainLabel}>Name a teammate of</div>
          <h2 className={styles.chainName}>{chainPlayer.name}</h2>
          {noSameTeam && exceptionActive && (
            <div className={styles.chainConstraint}>
              No exclusion — {chainPlayer.name} only played the excluded team-season(s)
            </div>
          )}
          {noSameTeam && !exceptionActive && excluded && excluded.length > 0 && (
            <div className={styles.chainConstraint}>
              Can't reuse: {excluded.map(c => `${c.teamName} ${c.season}`).join(' · ')}
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
