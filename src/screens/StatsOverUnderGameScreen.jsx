import { useState } from 'react'
import styles from './StatsOverUnderGameScreen.module.css'

function fmt(key, val) {
  if (val == null) return '—'
  if (key === 'gp') return String(Math.round(val))
  return Number(val).toFixed(1)
}

export default function StatsOverUnderGameScreen({
  nbaPlayerName,
  season,
  teamAbbr,
  questions,
  currentPlayer,
  scores,
  turnOrder,
  onResult,
  onBack,
}) {
  const [phase, setPhase] = useState('reveal')
  const [answers, setAnswers] = useState({})

  const allAnswered = questions.every(q => answers[q.key] !== undefined)
  const answeredCount = Object.keys(answers).length

  function handleToggle(key, choice) {
    setAnswers(prev => ({ ...prev, [key]: choice }))
  }

  function handleValidate() { setPhase('recap') }

  function handleFinish() {
    const score = questions.filter(q => {
      const correct = q.actual > q.threshold ? 'over' : 'under'
      return answers[q.key] === correct
    }).length
    onResult({ score })
  }

  // Shared top bar shown on all phases
  const topBar = (
    <div className={styles.topBar}>
      {onBack && <button className={styles.backArrow} onClick={onBack}>←</button>}
      {turnOrder && turnOrder.length > 0 && (
        <div className={styles.scorePills}>
          {turnOrder.map(name => (
            <span key={name} className={`${styles.scorePill} ${name === currentPlayer ? styles.scorePillActive : ''}`}>
              {name} · {scores?.[name] ?? 0}
            </span>
          ))}
        </div>
      )}
    </div>
  )

  // ── Reveal ────────────────────────────────────────────────────────────────
  if (phase === 'reveal') {
    return (
      <div className={styles.screen}>
        {topBar}
        <div className={styles.content}>
          <div className={styles.eyebrow}>{currentPlayer}'s turn</div>
          <div className={styles.playerCard}>
            <span className={styles.playerCardMeta}>{teamAbbr} · {season}</span>
            <h2 className={styles.playerCardName}>{nbaPlayerName}</h2>
            <span className={styles.playerCardCount}>
              {questions.length} question{questions.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button className={styles.primaryBtn} onClick={() => setPhase('picking')}>Start →</button>
        </div>
      </div>
    )
  }

  // ── Picking ───────────────────────────────────────────────────────────────
  if (phase === 'picking') {
    return (
      <div className={styles.screen}>
        {topBar}
        <div className={styles.contentWide}>
          <div className={styles.questionHeader}>
            <span className={styles.questionMeta}>{nbaPlayerName} · {season}</span>
            <span className={styles.questionProgress}>{answeredCount}/{questions.length}</span>
          </div>

          <div className={styles.questionList}>
            {questions.map(q => {
              const chosen = answers[q.key]
              return (
                <div key={q.key} className={`${styles.questionItem} ${chosen ? styles.questionItemAnswered : ''}`}>
                  <span className={styles.qiLabel}>{q.label}</span>
                  <span className={styles.qiThreshold}>{fmt(q.key, q.threshold)}</span>
                  <span className={styles.qiUnit}>{q.unit}</span>
                  <div className={styles.qiBtns}>
                    <button
                      className={`${styles.qiBtn} ${styles.qiBtnUnder} ${chosen === 'under' ? styles.qiBtnUnderActive : ''}`}
                      onClick={() => handleToggle(q.key, 'under')}
                    >Under</button>
                    <button
                      className={`${styles.qiBtn} ${styles.qiBtnOver} ${chosen === 'over' ? styles.qiBtnOverActive : ''}`}
                      onClick={() => handleToggle(q.key, 'over')}
                    >Over</button>
                  </div>
                </div>
              )
            })}
          </div>

          <button className={styles.validateBtn} onClick={handleValidate} disabled={!allAnswered}>
            Validate picks →
          </button>
        </div>
      </div>
    )
  }

  // ── Recap ─────────────────────────────────────────────────────────────────
  if (phase === 'recap') {
    const score = questions.filter(q => {
      const correct = q.actual > q.threshold ? 'over' : 'under'
      return answers[q.key] === correct
    }).length

    return (
      <div className={styles.screen}>
        {topBar}
        <div className={styles.contentWide}>
          <div className={styles.eyebrow}>{currentPlayer}</div>
          <div className={styles.recapScoreWrap}>
            <span className={styles.recapScoreNum}>{score}</span>
            <span className={styles.recapScoreOf}>/ {questions.length}</span>
          </div>
          <div className={styles.recapTable}>
            <div className={styles.recapHeader}>
              <span className={styles.recapColStat}>Stat</span>
              <span className={styles.recapColLine}>Line</span>
              <span className={styles.recapColActual}>Actual</span>
              <span className={styles.recapColResult}></span>
            </div>
            {questions.map(q => {
              const correctAnswer = q.actual > q.threshold ? 'over' : 'under'
              const correct = answers[q.key] === correctAnswer
              return (
                <div key={q.key} className={`${styles.recapRow} ${correct ? styles.recapCorrect : styles.recapWrong}`}>
                  <span className={styles.recapColStat}>{q.label}</span>
                  <span className={styles.recapColLine}>{fmt(q.key, q.threshold)}</span>
                  <span className={styles.recapColActual}>{fmt(q.key, q.actual)} <small>{q.unit}</small></span>
                  <span className={styles.recapColResult}>{correct ? '✓' : '✗'}</span>
                </div>
              )
            })}
          </div>
          <button className={styles.primaryBtn} onClick={handleFinish}>Continue →</button>
        </div>
      </div>
    )
  }

  return null
}
