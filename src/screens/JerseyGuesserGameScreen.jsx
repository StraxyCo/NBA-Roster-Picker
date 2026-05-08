import { useState, useEffect, useRef } from 'react'
import styles from './JerseyGuesserGameScreen.module.css'

const CURRENT_SEASON = '2025-26'

function getHeadshotUrl(id) {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function playerWeight(p) {
  const total = (p.min ?? 0) * (p.gp ?? 0)
  return total > 0 ? total : 1
}

function weightedShuffle(arr, weights) {
  const items = [...arr], ws = [...weights], result = []
  while (items.length > 0) {
    const total = ws.reduce((a, b) => a + b, 0)
    let r = Math.random() * total, i = 0
    while (i < ws.length - 1) { r -= ws[i]; if (r <= 0) break; i++ }
    result.push(items[i])
    items.splice(i, 1); ws.splice(i, 1)
  }
  return result
}

function weightedPick(players, weights) {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < players.length; i++) {
    r -= weights[i]
    if (r <= 0) return players[i]
  }
  return players[players.length - 1]
}

function buildWrongChoices(correct, players, weights) {
  const chosen = new Set()
  let attempts = 0
  while (chosen.size < 3 && attempts < 200) {
    attempts++
    const p = weightedPick(players, weights)
    if (p.number && p.number !== correct && !chosen.has(p.number)) {
      chosen.add(p.number)
    }
  }
  for (let i = 0; chosen.size < 3; i++) {
    const n = String(i)
    if (n !== correct && !chosen.has(n)) chosen.add(n)
  }
  return [...chosen]
}

export default function JerseyGuesserGameScreen({ players, rounds, onBack }) {
  const [phase, setPhase] = useState('loading') // loading | guess | success | hint | hint_result | recap
  const [currentNbaPlayer, setCurrentNbaPlayer] = useState(null)
  const [turnIdx, setTurnIdx] = useState(0)
  const [scores, setScores] = useState(() => Object.fromEntries(players.map(p => [p.name, 0])))
  const [inputVal, setInputVal] = useState('')
  const [choices, setChoices] = useState([])
  const [hintResult, setHintResult] = useState(null) // 'correct' | 'wrong'
  const [imgError, setImgError] = useState(false)
  const inputRef = useRef(null)
  const playerQueue = useRef([])
  const allPlayers = useRef([])
  const allWeights = useRef([])

  const activePlayers = players.filter(Boolean)
  const totalTurns = rounds * activePlayers.length
  const currentParticipant = activePlayers[turnIdx % activePlayers.length]
  const currentRound = Math.floor(turnIdx / activePlayers.length) + 1

  useEffect(() => {
    fetch('/rosters.json')
      .then(r => r.json())
      .then(data => {
        const seasonData = data[CURRENT_SEASON] || {}
        const seen = new Set()
        const all = []
        for (const teamPlayers of Object.values(seasonData)) {
          for (const p of teamPlayers) {
            if (!seen.has(p.id) && p.number !== undefined && p.number !== '') {
              seen.add(p.id)
              all.push(p)
            }
          }
        }
        const weights = all.map(playerWeight)
        allPlayers.current = all
        allWeights.current = weights
        playerQueue.current = weightedShuffle(all, weights)
        advanceTurn()
      })
  }, [])

  useEffect(() => {
    if (phase === 'guess') inputRef.current?.focus()
  }, [phase, currentNbaPlayer])

  function advanceTurn() {
    const next = playerQueue.current.pop()
    if (!next) { setPhase('recap'); return }
    setCurrentNbaPlayer(next)
    setInputVal('')
    setImgError(false)
    setPhase('guess')
  }

  function handleInputChange(e) {
    setInputVal(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))
  }

  function handleSubmit(e) {
    e?.preventDefault()
    if (!inputVal) return
    if (inputVal === currentNbaPlayer.number) {
      setScores(prev => ({ ...prev, [currentParticipant.name]: prev[currentParticipant.name] + 2 }))
      setPhase('success')
    } else {
      setChoices(shuffle([currentNbaPlayer.number, ...buildWrongChoices(currentNbaPlayer.number, allPlayers.current, allWeights.current)]))
      setPhase('hint')
    }
  }

  function handleHintClick(num) {
    const isCorrect = num === currentNbaPlayer.number
    if (isCorrect) {
      setScores(prev => ({ ...prev, [currentParticipant.name]: prev[currentParticipant.name] + 1 }))
    }
    setHintResult(isCorrect ? 'correct' : 'wrong')
    setPhase('hint_result')
  }

  function handleNext() {
    const next = turnIdx + 1
    if (next >= totalTurns) {
      setPhase('recap')
    } else {
      setTurnIdx(next)
      advanceTurn()
    }
  }

  if (phase === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading players…</div>
      </div>
    )
  }

  if (phase === 'recap') {
    const sorted = [...activePlayers].sort((a, b) => scores[b.name] - scores[a.name])
    const topScore = scores[sorted[0]?.name] ?? 0
    const isTie = sorted.length > 1 && scores[sorted[1].name] === topScore
    return (
      <div className={styles.container}>
        <div className={styles.recap}>
          <div className={styles.recapEyebrow}>Game Over</div>
          <div className={styles.recapHeadline}>
            {isTie ? "It's a tie!" : `${sorted[0].name} wins!`}
          </div>
          <div className={styles.recapList}>
            {sorted.map((p, i) => (
              <div key={p.id} className={`${styles.recapRow} ${i === 0 && !isTie ? styles.recapRowTop : ''}`}>
                <span className={styles.recapRank}>{i === 0 && !isTie ? '🏆' : `#${i + 1}`}</span>
                <span className={styles.recapPlayerName}>{p.name}</span>
                <span className={styles.recapPts}>{scores[p.name]} <span className={styles.recapPtsLabel}>pts</span></span>
              </div>
            ))}
          </div>
          <div className={styles.recapInfo}>Max possible: {totalTurns * 2} pts ({rounds} round{rounds !== 1 ? 's' : ''} × 2 pts)</div>
          <button className={styles.primaryBtn} onClick={onBack}>Play Again</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backArrow} onClick={onBack} aria-label="Back">←</button>
        <div className={styles.roundInfo}>Round {currentRound} / {rounds}</div>
        <div className={styles.scorePills}>
          {activePlayers.map(p => (
            <span
              key={p.id}
              className={`${styles.scorePill} ${p.name === currentParticipant?.name ? styles.scorePillActive : ''}`}
            >
              {p.name} · {scores[p.name]}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.turnLabel}>{currentParticipant?.name}'s turn</div>

      <div className={styles.playerCard}>
        {!imgError ? (
          <img
            src={getHeadshotUrl(currentNbaPlayer.id)}
            alt={currentNbaPlayer.name}
            className={styles.headshot}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.headshotFallback}>
            {currentNbaPlayer.name[0]}
          </div>
        )}
        <div className={styles.playerName}>{currentNbaPlayer.name}</div>
      </div>

      {phase === 'guess' && (
        <form className={styles.guessArea} onSubmit={handleSubmit}>
          <div className={styles.guessLabel}>What's his jersey number?</div>
          <input
            ref={inputRef}
            className={styles.numberInput}
            type="text"
            inputMode="numeric"
            value={inputVal}
            onChange={handleInputChange}
            placeholder="##"
            autoComplete="off"
          />
          <button type="submit" className={styles.primaryBtn} disabled={!inputVal}>
            Submit
          </button>
        </form>
      )}

      {phase === 'success' && (
        <div className={styles.feedbackArea}>
          <div className={`${styles.feedbackIcon} ${styles.feedbackIconCorrect}`}>✓</div>
          <div className={styles.feedbackHeading}>Correct!</div>
          <div className={styles.feedbackSub}>+2 points for {currentParticipant?.name}</div>
          <div className={styles.jerseyReveal}>#{currentNbaPlayer.number}</div>
          <button className={styles.primaryBtn} onClick={handleNext}>Next →</button>
        </div>
      )}

      {phase === 'hint' && (
        <div className={styles.hintArea}>
          <div className={styles.hintLabel}>Not quite! Pick the right number:</div>
          <div className={styles.choicesGrid}>
            {choices.map(num => (
              <button key={num} className={styles.choiceBtn} onClick={() => handleHintClick(num)}>
                #{num}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'hint_result' && (
        <div className={styles.feedbackArea}>
          {hintResult === 'correct' ? (
            <>
              <div className={`${styles.feedbackIcon} ${styles.feedbackIconCorrect}`}>✓</div>
              <div className={styles.feedbackHeading}>Correct!</div>
              <div className={styles.feedbackSub}>+1 point for {currentParticipant?.name}</div>
            </>
          ) : (
            <>
              <div className={`${styles.feedbackIcon} ${styles.feedbackIconWrong}`}>✗</div>
              <div className={styles.feedbackHeading}>Wrong!</div>
              <div className={styles.feedbackSub}>The correct answer was:</div>
            </>
          )}
          <div className={styles.jerseyReveal}>#{currentNbaPlayer.number}</div>
          <button className={styles.primaryBtn} onClick={handleNext}>Next →</button>
        </div>
      )}
    </div>
  )
}
