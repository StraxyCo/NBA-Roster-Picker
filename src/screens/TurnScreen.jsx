import styles from './TurnScreen.module.css'
import { SLOT_LABELS } from '../data/teams.js'

export default function TurnScreen({ currentPlayer, picksCount, rosterSize, rosters, turnOrder, multiSeason, gameMode, onDraw }) {
  return (
    <div className={styles.screen}>
      <div className={styles.content}>

        <div className={styles.hero}>
          <div className={styles.eyebrow}>It's your turn</div>
          <h1 className={styles.playerName}>{currentPlayer}</h1>
          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${(picksCount / rosterSize) * 100}%` }} />
            </div>
            <span className={styles.progressLabel}>{picksCount} / {rosterSize} picks</span>
          </div>
        </div>

        {turnOrder.length > 0 && (
          <div className={styles.rostersGrid}>
            {turnOrder.map((player) => {
              const roster = rosters[player] || []
              const picks = roster.filter(Boolean).length
              return (
                <div key={player} className={`${styles.rosterCard} ${player === currentPlayer ? styles.rosterCardActive : ''}`}>
                  <div className={styles.rosterHeader}>
                    <span className={styles.rosterPlayerName}>{player}</span>
                    <span className={styles.rosterCount}>{picks}/{rosterSize}</span>
                  </div>
                  <div className={styles.rosterSlots}>
                    {Array.from({ length: rosterSize }).map((_, i) => {
                      const entry = roster[i]
                      return (
                        <div key={i} className={`${styles.rosterSlot} ${entry ? styles.rosterSlotFilled : ''}`}>
                          <span className={styles.rosterSlotLabel}>
                            {gameMode === 'teams' ? i + 1 : (SLOT_LABELS[i] || i + 1)}
                          </span>
                          <span className={styles.rosterSlotPlayer}>
                            {entry ? (
                              gameMode === 'teams'
                                ? <>{entry.name}<span className={styles.seasonTag}>{entry.season}</span></>
                                : <>{entry.name}{multiSeason && entry.season && <span className={styles.seasonTag}>{entry.season}</span>}</>
                            ) : <em>empty</em>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <button className={styles.drawBtn} onClick={onDraw}>
          {gameMode === 'teams' ? 'Draw Franchise' : 'Draw Team'}
        </button>
      </div>
    </div>
  )
}
