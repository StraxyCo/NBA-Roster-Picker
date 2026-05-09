import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import StatsOverUnderSetupScreen, { ALL_STATS } from '../screens/StatsOverUnderSetupScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import StatsOverUnderGameScreen from '../screens/StatsOverUnderGameScreen.jsx'
import { useStatsOverUnderGames } from '../hooks/useProfiles.js'
import styles from './StatsOverUnderGame.module.css'

const PHASES = {
  SETUP: 'setup',
  ORDER_DRAW: 'order_draw',
  BETWEEN_TURNS: 'between_turns',
  QUESTIONING: 'questioning',
  FINAL: 'final',
}

function generateThreshold(statKey, actual) {
  if (!actual || actual <= 0) return statKey === 'gp' ? 10 : 0.5
  const pct = 0.10 + Math.random() * 0.15
  const direction = Math.random() < 0.5 ? 1 : -1
  const raw = Math.max(0, actual + direction * actual * pct)
  if (statKey === 'gp') return Math.max(1, Math.round(raw))
  return Math.max(0.1, Math.round(raw * 2) / 2)
}

function pickRandomEntry(careers, seasons, selectedStats) {
  const pool = []
  for (const data of Object.values(careers)) {
    for (const s of data.seasons) {
      if (!seasons.includes(s.season)) continue
      if (selectedStats.some(key => (s[key] || 0) > 0)) {
        pool.push({ name: data.name, ...s })
      }
    }
  }
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
}

// ── Between-turns interstitial ──────────────────────────────────────────────
function BetweenTurns({ currentPlayer, currentRound, totalRounds, scores, turnOrder, onDraw, careersLoaded }) {
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

        <button className={styles.drawBtn} onClick={onDraw} disabled={!careersLoaded}>
          {careersLoaded ? 'Draw Player →' : 'Loading data…'}
        </button>
      </div>
    </div>
  )
}

// ── Final screen ────────────────────────────────────────────────────────────
function FinalScreen({ scores, turnOrder, onFinish }) {
  const sorted   = [...turnOrder].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
  const topScore = scores[sorted[0]] || 0
  const winners  = sorted.filter(n => (scores[n] || 0) === topScore)
  const label    = winners.length === 1 ? winners[0] : `Tie — ${winners.join(' & ')}`

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.eyebrow}>Game Over</div>
        <h2 className={styles.winnerName}>{label}</h2>
        <p className={styles.winnerSub}>{winners.length > 1 ? 'tied for the win!' : 'wins!'}</p>

        <div className={styles.finalScores}>
          {sorted.map((n, i) => (
            <div
              key={n}
              className={`${styles.finalScoreRow} ${(scores[n] || 0) === topScore ? styles.finalScoreWinner : ''}`}
            >
              <span className={styles.finalRank}>#{i + 1}</span>
              <span className={styles.finalPlayerName}>{n}</span>
              <span className={styles.finalPoints}>{scores[n] || 0} pts</span>
            </div>
          ))}
        </div>

        <button className={styles.finishBtn} onClick={onFinish}>Finish</button>
      </div>
    </div>
  )
}

// ── Main orchestrator ───────────────────────────────────────────────────────
export default function StatsOverUnderGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useStatsOverUnderGames()

  const [phase, setPhase]     = useState(PHASES.SETUP)
  const [config, setConfig]   = useState(null)
  const [careers, setCareers] = useState(null)

  const [turnOrder, setTurnOrder]               = useState([])
  const [playerObjects, setPlayerObjects]       = useState([])
  const [turnIndex, setTurnIndex]               = useState(0)
  const [scores, setScores]                     = useState({})
  const [currentEntry, setCurrentEntry]         = useState(null)
  const [currentQuestions, setCurrentQuestions] = useState([])

  useEffect(() => {
    fetch('/careers.json')
      .then(r => r.json())
      .then(d => setCareers(d))
      .catch(e => console.error('careers load error', e))
  }, [])

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
    setPhase(PHASES.BETWEEN_TURNS)
  }

  function handleDraw() {
    const entry = pickRandomEntry(careers, config.seasons, config.selectedStats)
    if (!entry) return

    const statDefs = ALL_STATS.filter(s => config.selectedStats.includes(s.key))
    const questions = statDefs.map(({ key, label, unit }) => ({
      key, label, unit,
      actual: entry[key] ?? 0,
      threshold: generateThreshold(key, entry[key] ?? 0),
    }))

    setCurrentEntry(entry)
    setCurrentQuestions(questions)
    setPhase(PHASES.QUESTIONING)
  }

  function handleResult({ score }) {
    const playerName = turnOrder[turnIndex % turnOrder.length]
    setScores(prev => ({ ...prev, [playerName]: (prev[playerName] || 0) + score }))

    const next = turnIndex + 1
    if (next >= config.rounds * turnOrder.length) {
      setTurnIndex(next)
      setPhase(PHASES.FINAL)
    } else {
      setTurnIndex(next)
      setCurrentEntry(null)
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
    navigate('/')
  }

  const currentPlayerName = turnOrder[turnIndex % turnOrder.length] || ''
  const currentRound      = Math.floor(turnIndex / (turnOrder.length || 1)) + 1

  return (
    <>
      {phase === PHASES.SETUP && (
        <StatsOverUnderSetupScreen
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
          careersLoaded={careers !== null}
        />
      )}

      {phase === PHASES.QUESTIONING && currentEntry && (
        <StatsOverUnderGameScreen
          nbaPlayerName={currentEntry.name}
          season={currentEntry.season}
          teamAbbr={currentEntry.teamAbbr}
          questions={currentQuestions}
          currentPlayer={currentPlayerName}
          onResult={handleResult}
        />
      )}

      {phase === PHASES.FINAL && (
        <FinalScreen
          scores={scores}
          turnOrder={turnOrder}
          onFinish={handleFinish}
        />
      )}
    </>
  )
}
