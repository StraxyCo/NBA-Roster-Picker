import { useState, useEffect, useRef, useMemo } from 'react'
import { loadNicknames } from '../hooks/useNicknames.js'
import { ALL_SEASONS, PRE_2006, FIRST_SEASON } from '../data/seasons.js'
import styles from './NicknameGameScreen.module.css'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildSequence(keys, totalTurns) {
  let pool = shuffle(keys)
  const seq = []
  while (seq.length < totalTurns) {
    if (pool.length === 0) pool = shuffle(keys)
    seq.push(pool.shift())
  }
  return seq
}

// A nickname's player passes the season filters, per career data (via the crosswalk
// -> nickname-meta.json). They pass if they meet the min-seasons gate AND either:
//   - played in any selected modern season, OR
//   - the "Before 2005-06" option is on and they played any pre-2005-06 season.
// Players with NO career data are pure pre-2005 legends → included ONLY when the
// "Before 2005-06" option is on (off by default).
function playerPasses(p, meta, seasons, minSeasons) {
  const sel = seasons && seasons.length ? seasons : ALL_SEASONS
  const includePre = sel.includes(PRE_2006)
  const modern = sel.filter(s => s !== PRE_2006)
  const m = meta && meta[p.player_id]
  if (!m) return includePre // no data => only via the "Before 2005-06" toggle
  if (m.n < (minSeasons || 1)) return false
  if (modern.length && m.seasons.some(s => modern.includes(s))) return true
  if (includePre && m.seasons.some(s => s < FIRST_SEASON)) return true
  return false
}

export default function NicknameGameScreen({ players, rounds, minSeasons = 1, seasons = null, onBack, onSaveGame }) {
  const [nicknames, setNicknames] = useState(null)
  const [sequence, setSequence] = useState([])

  const totalTurns = rounds * players.length
  const [turn, setTurn] = useState(0)
  const [phase, setPhase] = useState('loading') // loading | guessing | feedback | final
  const [scores, setScores] = useState(() => Object.fromEntries(players.map(p => [p.name, 0])))
  const [guess, setGuess] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [lastCorrect, setLastCorrect] = useState(false)
  const [savedGame, setSavedGame] = useState(false)

  const inputRef = useRef(null)

  const currentPlayerIdx = turn % players.length
  const currentPlayer = players[currentPlayerIdx]
  const currentRound = Math.floor(turn / players.length) + 1
  const currentNickname = sequence[turn]

  useEffect(() => {
    Promise.all([
      loadNicknames(),
      fetch('/nickname-meta.json').then(r => (r.ok ? r.json() : {})).catch(() => ({})),
    ]).then(([data, meta]) => {
      setNicknames(data)
      // Real nicknames only (exclude keys that are a player's own name), then apply
      // the season / min-seasons filters (a key is eligible if any of its players passes).
      const isRealNickname = key => !data[key].some(p => p.player_name === key)
      const eligible = Object.keys(data).filter(
        key => isRealNickname(key) && data[key].some(p => playerPasses(p, meta, seasons, minSeasons)),
      )
      // never leave an empty pool — fall back to all real nicknames if filters exclude everything
      const keys = eligible.length ? eligible : Object.keys(data).filter(isRealNickname)
      setSequence(buildSequence(keys, totalTurns))
      setPhase('guessing')
    })
  }, [])

  useEffect(() => {
    if (phase === 'guessing') {
      setGuess('')
      setShowSuggestions(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [turn, phase])

  // All NBA player names for autocomplete, derived once from the nicknames dict
  const allPlayerNames = useMemo(() => {
    if (!nicknames) return []
    return [...new Set(
      Object.values(nicknames).flatMap(ps => ps.map(p => p.player_name))
    )].sort()
  }, [nicknames])

  const suggestions = useMemo(() => {
    if (guess.length < 2) return []
    const lower = guess.toLowerCase()
    return allPlayerNames.filter(n => n.toLowerCase().includes(lower)).slice(0, 8)
  }, [guess, allPlayerNames])

  function handleSubmit(playerName) {
    const trimmed = playerName.trim()
    if (!trimmed || !currentNickname || !nicknames) return
    const correctPlayers = nicknames[currentNickname] || []
    const correct = correctPlayers.some(p => p.player_name.toLowerCase() === trimmed.toLowerCase())
    setLastCorrect(correct)
    setGuess(trimmed)
    setShowSuggestions(false)
    if (correct) {
      setScores(prev => ({ ...prev, [currentPlayer.name]: prev[currentPlayer.name] + 1 }))
    }
    setPhase('feedback')
  }

  function handleNext() {
    const nextTurn = turn + 1
    if (nextTurn >= totalTurns) {
      setPhase('final')
    } else {
      setTurn(nextTurn)
      setPhase('guessing')
    }
  }

  // Save game once when entering final phase
  useEffect(() => {
    if (phase !== 'final' || savedGame) return
    setSavedGame(true)
    const finalScores = scores
    const sorted = [...players].sort((a, b) => (finalScores[b.name] || 0) - (finalScores[a.name] || 0))
    const winner = sorted[0]
    onSaveGame({
      playerIds: players.map(p => p.id),
      playerNames: players.map(p => p.name),
      winnerId: winner.id,
      winnerName: winner.name,
    }).catch(err => console.error('Failed to save game:', err))
  }, [phase])

  if (phase === 'loading' || !currentNickname) {
    return (
      <div className={styles.container}>
        <button className={styles.backArrow} onClick={onBack}>←</button>
        <p className={styles.loading}>Loading nicknames…</p>
      </div>
    )
  }

  if (phase === 'final') {
    const sorted = [...players].sort((a, b) => (scores[b.name] || 0) - (scores[a.name] || 0))
    return (
      <div className={styles.container}>
        <button className={styles.backArrow} onClick={onBack}>←</button>
        <div className={styles.finalContent}>
          <p className={styles.gameOver}>Game Over</p>
          <h1 className={styles.winnerName}>{sorted[0].name} wins!</h1>
          <div className={styles.scoreList}>
            {sorted.map((p, i) => (
              <div key={p.name} className={`${styles.scoreRow} ${i === 0 ? styles.scoreRowFirst : ''}`}>
                <span className={styles.scoreRank}>#{i + 1}</span>
                <span className={styles.scoreName}>{p.name}</span>
                <span className={styles.scoreVal}>{scores[p.name]} / {rounds}</span>
              </div>
            ))}
          </div>
          <button className={styles.actionBtn} onClick={onBack}>New Game</button>
        </div>
      </div>
    )
  }

  const correctPlayers = nicknames[currentNickname] || []

  return (
    <div className={styles.container}>
      <button className={styles.backArrow} onClick={onBack}>←</button>

      <div className={styles.topBar}>
        <div className={styles.roundInfo}>Round {currentRound} / {rounds}</div>
        <div className={styles.scorePills}>
          {players.map(p => (
            <span key={p.name} className={`${styles.scorePill} ${p.name === currentPlayer.name ? styles.scorePillActive : ''}`}>
              {p.name} · {scores[p.name]}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.turnLabel}>{currentPlayer.name}'s turn</div>

      <div className={styles.card}>
        <p className={styles.prompt}>Who goes by…</p>
        <h2 className={styles.nickname}>{currentNickname}</h2>

        {phase === 'guessing' && (
          <div className={styles.inputBlock}>
            <div className={styles.inputWrapper}>
              <input
                ref={inputRef}
                className={styles.input}
                value={guess}
                onChange={e => { setGuess(e.target.value); setShowSuggestions(true) }}
                onKeyDown={e => { if (e.key === 'Enter' && guess.trim()) handleSubmit(guess) }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => guess.length >= 2 && setShowSuggestions(true)}
                placeholder="Type a player name…"
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className={styles.suggestions}>
                  {suggestions.map(name => (
                    <button
                      key={name}
                      className={styles.suggestion}
                      onMouseDown={() => { setGuess(name); setShowSuggestions(false) }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className={styles.actionBtn} onClick={() => handleSubmit(guess)} disabled={!guess.trim()}>
              Submit
            </button>
          </div>
        )}

        {phase === 'feedback' && (
          <div className={styles.feedbackBlock}>
            <p className={`${styles.result} ${lastCorrect ? styles.correct : styles.wrong}`}>
              {lastCorrect ? '✓ Correct!' : '✗ Wrong'}
            </p>
            <p className={styles.guessedName}>{guess}</p>
            {!lastCorrect && (
              <p className={styles.correctAnswer}>
                {correctPlayers.map(p => p.player_name).join(' / ')}
              </p>
            )}
            <button className={styles.actionBtn} onClick={handleNext}>
              {turn + 1 >= totalTurns ? 'See Results' : 'Next →'}
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
