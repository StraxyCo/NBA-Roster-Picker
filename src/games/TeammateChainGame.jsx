import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TeammateChainSetupScreen from '../screens/TeammateChainSetupScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import TeammateChainGameScreen from '../screens/TeammateChainGameScreen.jsx'
import { useTeammateChainGames } from '../hooks/useProfiles.js'
import { findTeammateConnection, pickStartingPlayer, getAllPlayers } from '../utils/teammateChain.js'
import styles from './WhosThatGuyGame.module.css'

const PHASES = { SETUP: 'setup', ORDER_DRAW: 'order_draw', PLAYING: 'playing', FINAL: 'final' }

function FinalScreen({ scores, turnOrder, history, onFinish }) {
  const sorted = [...turnOrder].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
  const topScore = scores[sorted[0]] || 0
  const winners = sorted.filter(n => (scores[n] || 0) === topScore)
  const label = winners.length === 1 ? winners[0] : `Tie — ${winners.join(' & ')}`

  return (
    <div className={styles.finalScreen}>
      <div className={styles.finalContent}>
        <div className={styles.eyebrow}>Game Over</div>
        <h2 className={styles.winnerName}>{label}</h2>
        <p className={styles.winnerSub}>{winners.length > 1 ? 'tied for the win!' : 'wins!'}</p>

        <div className={styles.scoreBoard}>
          <div className={styles.scoreBoardLabel}>Final Scores</div>
          {sorted.map(name => (
            <div key={name} className={styles.scoreRow}>
              <span className={styles.scorePlayerName}>{name}</span>
              <span className={styles.scorePoints}>{scores[name] || 0} pts</span>
            </div>
          ))}
        </div>

        {/* Chain history */}
        {sorted.map(name => {
          const turns = history.filter(h => h.human === name)
          if (!turns.length) return null
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
                    <span className={styles.historyMystery}>{h.chainPlayer} → {h.guess}</span>
                    {h.correct && h.connection && (
                      <span className={styles.historyGuess} style={{ color: 'var(--white-40)' }}>
                        via {h.connection.teamName} ({h.connection.season})
                      </span>
                    )}
                    {!h.correct && <span className={styles.historyGuess}>Not a teammate</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        <button className={styles.finishBtn} onClick={onFinish}>New Game</button>
      </div>
    </div>
  )
}

export default function TeammateChainGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useTeammateChainGames()

  const [phase, setPhase]       = useState(PHASES.SETUP)
  const [config, setConfig]     = useState(null)
  const [careers, setCareers]   = useState(null)
  const [rosters, setRosters]   = useState(null)

  const [turnOrder, setTurnOrder]   = useState([])
  const [playerObjects, setPlayerObjects] = useState([])
  const [turnIndex, setTurnIndex]   = useState(0)
  const [scores, setScores]         = useState({})
  const [history, setHistory]       = useState([])

  // Current chain state
  const [chainPlayer, setChainPlayer] = useState(null)    // { id, name }
  const [lastLinkTeam, setLastLinkTeam] = useState(null)  // { teamAbbr, teamName, season }

  useEffect(() => {
    Promise.all([
      fetch('/careers.json').then(r => r.json()),
      fetch('/rosters.json').then(r => r.json()),
    ]).then(([c, r]) => { setCareers(c); setRosters(r) })
      .catch(e => console.error('data load', e))
  }, [])

  const allPlayers = useMemo(() => careers ? getAllPlayers(careers) : [], [careers])
  const dataLoaded = careers !== null && rosters !== null

  function handleStart(cfg) { setConfig(cfg); setPhase(PHASES.ORDER_DRAW) }

  function handleOrderDrawn(order) {
    setTurnOrder(order)
    setPlayerObjects(config.players.filter(p => order.includes(p.name)).sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)))
    setTurnIndex(0)
    setScores(Object.fromEntries(order.map(n => [n, 0])))
    setHistory([])

    const start = pickStartingPlayer(careers, rosters)
    setChainPlayer(start)
    setLastLinkTeam(null)
    setPhase(PHASES.PLAYING)
  }

  const maxTurns = config ? config.rounds * (turnOrder.length || 1) : 0
  const currentPlayerName = turnOrder[turnIndex % (turnOrder.length || 1)] || ''

  function handleSubmit({ guessPlayer }) {
    const connection = findTeammateConnection(
      chainPlayer.id,
      guessPlayer.id,
      careers,
      rosters,
      config.noSameTeam ? lastLinkTeam?.teamAbbr : null
    )
    const correct = connection !== null

    const histEntry = {
      human: currentPlayerName,
      chainPlayer: chainPlayer.name,
      guess: guessPlayer.name,
      correct,
      connection,
    }
    setHistory(prev => [...prev, histEntry])

    if (correct) {
      setScores(prev => ({ ...prev, [currentPlayerName]: (prev[currentPlayerName] || 0) + 1 }))
      // Chain advances to the named player
      setChainPlayer(guessPlayer)
      setLastLinkTeam(connection)
    } else {
      // Chain breaks — reset with a new starting player
      const newStart = pickStartingPlayer(careers, rosters)
      setChainPlayer(newStart)
      setLastLinkTeam(null)
    }

    const nextTurn = turnIndex + 1
    setTurnIndex(nextTurn)
    if (nextTurn >= maxTurns) setPhase(PHASES.FINAL)
  }

  async function handleFinish() {
    const sorted = [...turnOrder].sort((a, b) => (scores[b] || 0) - (scores[a] || 0))
    const topScore = scores[sorted[0]] || 0
    const winners = sorted.filter(n => (scores[n] || 0) === topScore)
    const winner = winners.length === 1 ? playerObjects.find(p => p.name === winners[0]) : null
    await saveGame({
      playerIds: playerObjects.map(p => p.id),
      playerNames: playerObjects.map(p => p.name),
      winnerId: winner?.id ?? null,
      winnerName: winners.length > 1 ? `Tie (${winners.join(', ')})` : winners[0],
    })
    setPhase(PHASES.SETUP)
  }

  return (
    <>
      {phase === PHASES.SETUP && (
        <TeammateChainSetupScreen
          onBack={() => navigate('/')}
          onStart={handleStart}
          savedGames={games}
          onDeleteGame={deleteGame}
        />
      )}
      {phase === PHASES.ORDER_DRAW && config && (
        <OrderDrawScreen
          players={config.players.map(p => p.name)}
          onOrderDrawn={handleOrderDrawn}
        />
      )}
      {phase === PHASES.PLAYING && chainPlayer && (
        <TeammateChainGameScreen
          chainPlayer={chainPlayer}
          linkTeam={lastLinkTeam}
          noSameTeam={config.noSameTeam}
          allPlayers={allPlayers}
          currentPlayer={currentPlayerName}
          scores={scores}
          turnOrder={turnOrder}
          onSubmit={handleSubmit}
          onBack={() => setPhase(PHASES.SETUP)}
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
