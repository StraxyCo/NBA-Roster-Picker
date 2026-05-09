import React from 'react'
import styles from './HomeScreen.module.css'

export default function HomeScreen({ onSelectGame }) {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>NBA Party Games</h1>
        <p className={styles.subtitle}>Select a game to play</p>
      </header>

      <div className={styles.gameList}>
        <button className={styles.gameCard} onClick={() => onSelectGame('ROSTER_PICKER')}>
          <div className={styles.gameInfo}>
            <h2>Roster Picker</h2>
            <p>Draft your ultimate roster from historical NBA seasons.</p>
          </div>
          <div className={styles.arrow}>→</div>
        </button>
        <button className={styles.gameCard} onClick={() => onSelectGame('JERSEY_GUESSER')}>
          <div className={styles.gameInfo}>
            <h2>Jersey Number Guesser</h2>
            <p>Guess the jersey number of NBA players.</p>
          </div>
          <div className={styles.arrow}>→</div>
        </button>
        <button className={styles.gameCard} onClick={() => onSelectGame('WHO_HAS_MORE')}>
          <div className={styles.gameInfo}>
            <h2>Who Has More</h2>
            <p>Guess which player had higher stats in a given season.</p>
          </div>
          <div className={styles.arrow}>→</div>
        </button>
      </div>
    </div>
  )
}
