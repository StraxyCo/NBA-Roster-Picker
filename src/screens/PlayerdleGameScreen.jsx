import { useState, useMemo } from 'react'
import CountdownTimer from '../components/CountdownTimer.jsx'
import { filterNames } from '../utils/playerdle.js'
import styles from './PlayerdleGameScreen.module.css'

export default function PlayerdleGameScreen({
  allNames, guesses, currentGuesser, scores, turnOrder,
  round, totalRounds, attemptsUsed, maxAttempts,
  phase, result, answer, timerKey,
  onGuess, onNext, onBack,
}) {
  const [query, setQuery] = useState('')
  const suggestions = useMemo(() => filterNames(allNames, query), [allNames, query])
  const guessedIds = new Set(guesses.map(g => g.id))

  function pick(p) {
    setQuery('')
    onGuess(p)
  }

  return (
    <div className={styles.screen}>
      {phase === 'guessing' && <CountdownTimer seconds={45} resetKey={timerKey} running={phase === 'guessing'} />}

      <div className={styles.topBar}>
        <button className={styles.back} onClick={onBack}>←</button>
        <span className={styles.round}>Round {round} / {totalRounds}</span>
        <span className={styles.attempts}>{attemptsUsed} / {maxAttempts}</span>
      </div>

      <div className={styles.scorePills}>
        {turnOrder.map(n => (
          <span key={n} className={`${styles.pill} ${n === currentGuesser && phase === 'guessing' ? styles.pillActive : ''}`}>{n} · {scores[n] ?? 0}</span>
        ))}
      </div>

      {phase === 'guessing' ? (
        <div className={styles.turnLine}><strong>{currentGuesser}</strong> — name a player</div>
      ) : (
        <div className={`${styles.banner} ${result?.win ? styles.bannerWin : styles.bannerDraw}`}>
          {result?.win ? `✓ ${result.win} got it!` : '✗ Nobody got it'} — it was <strong>{answer}</strong>
          <button className={styles.nextBtn} onClick={onNext}>{round >= totalRounds ? 'See results →' : 'Next round →'}</button>
        </div>
      )}

      {phase === 'guessing' && (
        <div className={styles.search}>
          <input className={styles.input} autoFocus placeholder="Search a player…" value={query} onChange={e => setQuery(e.target.value)} />
          {suggestions.length > 0 && (
            <div className={styles.suggestions}>
              {suggestions.map(p => (
                <button key={p.id} className={styles.suggestion} disabled={guessedIds.has(p.id)} onClick={() => pick(p)}>{p.name}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.board}>
        {guesses.length === 0 && <p className={styles.empty}>Guesses will appear here with colour clues.</p>}
        {[...guesses].reverse().map((g, i) => (
          <div key={guesses.length - i} className={`${styles.guess} ${g.correct ? styles.guessCorrect : ''}`}>
            <div className={styles.guessHead}>
              <span className={styles.guessName}>{g.correct ? '✓ ' : ''}{g.name}</span>
              <span className={styles.guessBy}>{g.guesser}</span>
            </div>
            <div className={styles.clues}>
              {g.feedback.map(f => (
                <div key={f.key} className={`${styles.clue} ${styles['s_' + f.status]}`}>
                  <span className={styles.clueLabel}>{f.label}</span>
                  <span className={styles.clueVal}>{f.value}{f.arrow && <span className={styles.arrow}>{f.arrow}</span>}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
