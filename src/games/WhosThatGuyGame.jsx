import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import WhosThatGuySetupScreen from '../screens/WhosThatGuySetupScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import WhosThatGuyGameScreen from '../screens/WhosThatGuyGameScreen.jsx'
import { useWhosThatGuyGames } from '../hooks/useProfiles.js'
import styles from './WhosThatGuyGame.module.css'

const PHASES = {
  SETUP: 'setup',
  ORDER_DRAW: 'order_draw',
  BETWEEN_TURNS: 'between_turns',
  QUESTIONING: 'questioning',
  FINAL: 'final',
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickMysteryPlayer(careers, selectedSeasons, minSeasons) {
  const eligible = Object.entries(careers).filter(([, data]) => {
    const uniqueSeasons = new Set(data.seasons.map(s => s.season)).size
    if (uniqueSeasons < minSeasons) return false
    return data.seasons.some(s => selectedSeasons.includes(s.season))
  })
  if (!eligible.length) return null
  const [id, data] = eligible[Math.floor(Math.random() * eligible.length)]
  return { id, name: data.name, seasons: data.seasons }
}

// ── Between-turns interstitial ──────────────────────────────────────────────
function BetweenTurns({ currentPlayer, currentRound, totalRounds, scores, turnOrder, onDraw, dataLoaded }) {
  const hasScores = turnOrder.some(n => (scores[n] || 0) > 0)
  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.eyebrow}>Round {currentRound} / {totalRounds}</div>
        <h2 className={styles.turnName}>{currentPlayer}</h2>
        <p className={styles.turnSubtitle}>Your turn — draw a player!</p>

        {hasScores && (
          <div className={styles.scoreBoard}>
            <div className={styles.scoreBoardLabel}>Scores</div>
            {[...turnOrder]
              .sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
              .map(n => (
                <div key={n} className={`${styles.scoreRow} ${n === currentPlayer ? styles.scoreRowActive : ''}`}>
                  <span className={styles.scorePlayerName}>{n}</span>
                  <span className={styles.scorePoints}>{scores[n] || 0} pts</span>
                </div>
              ))
            }
          </div>
        )}

        <button className={styles.drawBtn} onClick={onDraw} disabled={!dataLoaded}>
          {dataLoaded ? 'Draw Player →' : 'Loading data…'}
        </button>
      </div>
    </div>
  )
}

// ── Final recap screen ──────────────────────────────────────────────────────
function FinalScreen({ scores, turnOrder, history, onFinish }) {
  const sorted   = [...turnOrder].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
  const topScore = scores[sorted[0]] || 0
  const winners  = sorted.filter(n => (scores[n] || 0) === topScore)
  const label    = winners.length === 1 ? winners[0] : `Tie — ${winners.join(' & ')}`

  return (
    <div className={styles.finalScreen}>
      <div className={styles.finalContent}>
        <div className={styles.eyebrow}>Game Over</div>
        <h2 className={styles.winnerName}>{label}</h2>
        <p className={styles.winnerSub}>{winners.length > 1 ? 'tied for the win!' : 'wins!'}</p>

        {/* Per-player history */}
        {sorted.map(name => {
          const turns = history.filter(h => h.humanPlayer === name)
          return (
            <div key={name} className={styles.playerHistory}>
              <div className={styles.playerHistoryHeader}>
                <span className={styles.playerHistoryName}>{name}</span>
                <span className={styles.playerHistoryScore}>{scores[name] || 0} pts</span>
              </div>
              {turns.map((h, i) => (
                <div key={i} className={`${styles.historyRow} ${h.correct ? styles.historyCorrect : styles.historyWrong}`}>
                  <span className={styles.historyIcon}>{h.correct ? '✓' : '✗'}</span>
                  <div className={styles.historyBody}>
                    <span className={styles.historyMystery}>{h.mystery.name}</span>
                    {!h.correct && h.guess && (
                      <span className={styles.historyGuess}>Guessed: {h.guess.name}</span>
                    )}
                    {!h.guess && (
                      <span className={styles.historyGuess}>No pick</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        <button className={styles.finishBtn} onClick={onFinish}>Finish</button>
      </div>
    </div>
  )
}

// ── Main orchestrator ───────────────────────────────────────────────────────
export default function WhosThatGuyGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useWhosThatGuyGames()

  const [phase, setPhase]     = useState(PHASES.SETUP)
  const [config, setConfig]   = useState(null)
  const [careers, setCareers] = useState(null)

  const [turnOrder, setTurnOrder]         = useState([])
  const [playerObjects, setPlayerObjects] = useState([])
  const [turnIndex, setTurnIndex]         = useState(0)
  const [scores, setScores]               = useState({})
  const [currentMystery, setCurrentMystery] = useState(null)
  const [history, setHistory]             = useState([])

  useEffect(() => {
    fetch('/careers.json').then(r => r.json())
      .then(c => setCareers(c))
      .catch(e => console.error('data load error', e))
  }, [])

  const allPlayers = useMemo(() => {
    if (!careers) return []
    return Object.entries(careers)
      .map(([id, data]) => ({ id, name: data.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [careers])

  function handleStart(cfg) {
    setConfig(cfg)
    setPhase(PHASES.ORDER_DRAW)
  }

  function handleOrderDrawn(order) {
    setTurnOrder(order)
    setPlayerObjects(
      config.players
        .filter(p => order.includes(p.name))
        .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
    )
    setTurnIndex(0)
    setScores(Object.fromEntries(order.map(n => [n, 0])))
    setHistory([])
    setPhase(PHASES.BETWEEN_TURNS)
  }

  function handleDraw() {
    const mystery = pickMysteryPlayer(careers, config.seasons, config.minSeasons)
    if (!mystery) return
    setCurrentMystery(mystery)
    setPhase(PHASES.QUESTIONING)
  }

  function handleResult({ score, guess, mystery }) {
    const playerName = turnOrder[turnIndex % turnOrder.length]
    setScores(prev => ({ ...prev, [playerName]: (prev[playerName] || 0) + score }))
    setHistory(prev => [...prev, {
      humanPlayer: playerName,
      mystery,
      guess,
      correct: score === 1,
    }])

    const next = turnIndex + 1
    if (next >= config.rounds * turnOrder.length) {
      setTurnIndex(next)
      setPhase(PHASES.FINAL)
    } else {
      setTurnIndex(next)
      setCurrentMystery(null)
      setPhase(PHASES.BETWEEN_TURNS)
    }
  }

  async function handleFinish() {
    const sorted   = [...turnOrder].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
    const topScore = scores[sorted[0]] || 0
    const winners  = sorted.filter(n => (scores[n] || 0) === topScore)
    const winner   = winners.length === 1 ? playerObjects.find(p => p.name === winners[0]) : null

    await saveGame({
      playerIds:   playerObjects.map(p => p.id),
      playerNames: playerObjects.map(p => p.name),
      winnerId:    winner?.id ?? null,
      winnerName:  winners.length > 1 ? `Tie (${winners.join(', ')})` : winners[0],
    })
    setPhase(PHASES.SETUP)
  }

  const currentPlayerName = turnOrder[turnIndex % turnOrder.length] || ''
  const currentRound      = Math.floor(turnIndex / (turnOrder.length || 1)) + 1
  const dataLoaded        = careers !== null

  return (
    <>
      {phase === PHASES.SETUP && (
        <WhosThatGuySetupScreen
          onBack={() => navigate('/')}
          onStart={handleStart}
          savedGames={games}
          onDeleteGame={deleteGame}
        />
      )}

      {phase === PHASES.ORDER_DRAW && (
        <OrderDrawScreen
          players={config.players.map(p => p.name)}
          onOrderDrawn={handleOrderDrawn}
        />
      )}

      {phase === PHASES.BETWEEN_TURNS && (
        <BetweenTurns
          currentPlayer={currentPlayerName}
          currentRound={currentRound}
          totalRounds={config.rounds}
          scores={scores}
          turnOrder={turnOrder}
          onDraw={handleDraw}
          dataLoaded={dataLoaded}
        />
      )}

      {phase === PHASES.QUESTIONING && currentMystery && careers && (
        <WhosThatGuyGameScreen
          mysteryPlayer={currentMystery}
          allPlayers={allPlayers}
          showTeams={config.showTeams}
          currentPlayer={currentPlayerName}
          onResult={handleResult}
        />
      )}

      {phase === PHASES.FINAL && (
        <FinalScreen
          scores={scores}
          turnOrder={turnOrder}
          history={history}
          onFinish={handleFinish}
        />
      )}
    </>
  )
}
