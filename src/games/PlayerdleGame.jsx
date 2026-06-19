import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PlayerdleSetupScreen from '../screens/PlayerdleSetupScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import PlayerdleGameScreen from '../screens/PlayerdleGameScreen.jsx'
import { filterPool, getAllNames, compareGuess } from '../utils/playerdle.js'
import styles from './WhosThatGuyGame.module.css'

const PHASES = { SETUP: 'setup', ORDER: 'order', PLAYING: 'playing', FINAL: 'final' }

function FinalScreen({ scores, turnOrder, onFinish }) {
  const sorted = [...turnOrder].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
  const top = scores[sorted[0]] || 0
  const winners = sorted.filter(n => (scores[n] || 0) === top)
  return (
    <div className={styles.finalScreen}>
      <div className={styles.finalContent}>
        <div className={styles.eyebrow}>Game Over</div>
        <h2 className={styles.winnerName}>{winners.length === 1 ? `${winners[0]} wins!` : `Tie — ${winners.join(' & ')}`}</h2>
        <div className={styles.scoreList || ''}>
          {sorted.map((n, i) => (
            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--navy-3)', borderRadius: 'var(--radius)', marginBottom: 6 }}>
              <span>#{i + 1} {n}</span><span style={{ color: 'var(--gold)', fontWeight: 700 }}>{scores[n] || 0}</span>
            </div>
          ))}
        </div>
        <button className={styles.finishBtn} onClick={onFinish}>New Game</button>
      </div>
    </div>
  )
}

export default function PlayerdleGame() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState(PHASES.SETUP)
  const [profiles, setProfiles] = useState(null)
  const [config, setConfig] = useState(null)

  const [pool, setPool] = useState([])
  const [turnOrder, setTurnOrder] = useState([])
  const [round, setRound] = useState(1)
  const [startIdx, setStartIdx] = useState(0)
  const [guesserIdx, setGuesserIdx] = useState(0)
  const [mystery, setMystery] = useState(null)
  const [usedIds, setUsedIds] = useState(new Set())
  const [guesses, setGuesses] = useState([])
  const [scores, setScores] = useState({})
  const [boardPhase, setBoardPhase] = useState('guessing') // guessing | reveal
  const [result, setResult] = useState(null)

  useEffect(() => {
    fetch('/playerdle.json').then(r => r.json()).then(setProfiles).catch(e => console.error('playerdle load', e))
  }, [])

  const allNames = useMemo(() => (profiles ? getAllNames(profiles) : []), [profiles])

  function handleStart(cfg) {
    setConfig(cfg)
    setPool(filterPool(profiles, cfg.seasons, cfg.minSeasons))
    setPhase(PHASES.ORDER)
  }

  function startRound(roundNum, order, startAt, used) {
    const remaining = pool.filter(p => !used.has(p.id))
    if (!remaining.length) { setPhase(PHASES.FINAL); return }
    const pick = remaining[Math.floor(Math.random() * remaining.length)]
    const nextUsed = new Set(used); nextUsed.add(pick.id)
    setMystery(pick)
    setUsedIds(nextUsed)
    setRound(roundNum)
    setStartIdx(startAt)
    setGuesserIdx(startAt)
    setGuesses([])
    setResult(null)
    setBoardPhase('guessing')
  }

  function handleOrderDrawn(order) {
    setTurnOrder(order)
    setScores(Object.fromEntries(order.map(n => [n, 0])))
    setPhase(PHASES.PLAYING)
    startRound(1, order, 0, new Set())
  }

  function handleGuess(picked) {
    const guesser = turnOrder[guesserIdx]
    const guessProfile = { id: picked.id, ...profiles[picked.id] }
    const feedback = compareGuess(mystery, guessProfile, config.attributes)
    const correct = String(picked.id) === String(mystery.id)
    const next = [...guesses, { id: picked.id, name: picked.name, guesser, feedback, correct }]
    setGuesses(next)

    if (correct) {
      setScores(prev => ({ ...prev, [guesser]: (prev[guesser] || 0) + 1 }))
      setResult({ win: guesser })
      setBoardPhase('reveal')
    } else if (next.length >= config.maxAttempts) {
      setResult({ draw: true })
      setBoardPhase('reveal')
    } else {
      setGuesserIdx((guesserIdx + 1) % turnOrder.length)
    }
  }

  function handleNext() {
    if (round >= config.rounds) { setPhase(PHASES.FINAL); return }
    startRound(round + 1, turnOrder, (startIdx + 1) % turnOrder.length, usedIds)
  }

  return (
    <>
      {phase === PHASES.SETUP && <PlayerdleSetupScreen onBack={() => navigate('/')} onStart={handleStart} />}

      {phase === PHASES.ORDER && (
        <OrderDrawScreen players={config.players.map(p => p.name)} onOrderDrawn={handleOrderDrawn} />
      )}

      {phase === PHASES.PLAYING && mystery && (
        <PlayerdleGameScreen
          allNames={allNames}
          guesses={guesses}
          currentGuesser={turnOrder[guesserIdx]}
          scores={scores}
          turnOrder={turnOrder}
          round={round}
          totalRounds={config.rounds}
          attemptsUsed={guesses.length}
          maxAttempts={config.maxAttempts}
          phase={boardPhase}
          result={result}
          answer={mystery.name}
          timerKey={`${round}-${guesses.length}`}
          onGuess={handleGuess}
          onNext={handleNext}
          onBack={() => setPhase(PHASES.SETUP)}
        />
      )}

      {phase === PHASES.FINAL && (
        <FinalScreen scores={scores} turnOrder={turnOrder} onFinish={() => setPhase(PHASES.SETUP)} />
      )}
    </>
  )
}
