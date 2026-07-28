import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import TeammateChainSetupScreen from '../screens/TeammateChainSetupScreen.jsx'
import TeammateChainGameScreen from '../screens/TeammateChainGameScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import { useTeammateChainGames } from '../hooks/useProfiles.js'
import { validatePick, pickStartingPlayer, getAllPlayers, excludedConnections, hasAvailableOutside, allStarIds } from '../utils/teammateChain.js'
import styles from './WhosThatGuyGame.module.css'

const PHASES = { SETUP: 'setup', ORDER_DRAW: 'order_draw', PLAYING: 'playing', FINAL: 'final' }

function FinalScreen({ winner, soloOut, history, onFinish }) {
  return (
    <div className={styles.finalScreen}>
      <div className={styles.finalContent}>
        <div className={styles.eyebrow}>Game Over</div>
        <h2 className={styles.winnerName}>{soloOut ? 'Out of lives' : `${winner} wins!`}</h2>
        <p className={styles.winnerSub}>{soloOut ? `${winner}'s chain ended.` : 'Last one standing.'}</p>

        {/* Chain history */}
        <div className={styles.chainHistory}>
          <div className={styles.chainHistoryLabel}>The Chain</div>
          {history.map((h, i) => (
            <div key={i} className={`${styles.historyRow} ${h.correct ? styles.historyCorrect : styles.historyWrong}`}>
              <span className={styles.historyNum}>{i + 1}.</span>
              <div className={styles.historyBody}>
                <span className={styles.historyLink}>{h.prevPlayer} → {h.guesser}: {h.guessedPlayer}</span>
                {h.correct ? (
                  <span style={{ color: 'var(--white-40)', fontSize: '0.75rem' }}>
                    via {h.connection.teamName} ({h.connection.season})
                  </span>
                ) : (
                  <span style={{ color: 'var(--white-40)', fontSize: '0.75rem' }}>
                    −1 life · {h.livesLeft} left{h.livesLeft === 0 ? ' — eliminated' : ''}
                  </span>
                )}
              </div>
              <span className={styles.historyIcon}>{h.correct ? '✓' : '✗'}</span>
            </div>
          ))}
        </div>

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
  const [allstars, setAllstars] = useState(null)

  const [players, setPlayers]           = useState([])      // {id, name}[] — human players
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0) // index in players array
  const [chainPlayer, setChainPlayer]   = useState(null)    // current player in chain
  const [excludedKeys, setExcludedKeys] = useState(new Set()) // team-season keys consumed by the last link
  const [lastConnections, setLastConnections] = useState([]) // the last link's team-seasons (display/history)
  const [history, setHistory]           = useState([])      // chain of guesses
  const [lives, setLives]               = useState({})      // player id -> lives left
  const [winner, setWinner]             = useState(null)    // {id, name} — last one standing
  const [lastOutcome, setLastOutcome]   = useState(null)    // feedback banner for the previous guess

  useEffect(() => {
    Promise.all([
      fetch('/careers.json').then(r => r.json()),
      fetch('/rosters.json').then(r => r.json()),
      fetch('/allstars.json').then(r => r.json()),
    ]).then(([c, r, a]) => { setCareers(c); setRosters(r); setAllstars(a) })
      .catch(e => console.error('data load', e))
  }, [])

  const allPlayers = useMemo(() => careers ? getAllPlayers(careers) : [], [careers])
  const allStarIdSet = useMemo(() => allStarIds(allstars), [allstars])
  const dataLoaded = careers !== null && rosters !== null && allstars !== null
  const maxLives = config?.lives ?? 3

  function handleStart(cfg) {
    setConfig(cfg)
    setPhase(PHASES.ORDER_DRAW)
  }

  function handleOrderDrawn(order) {
    // Map the drawn name order back to player objects, consuming each name once
    // so duplicate first names still map 1:1.
    const pool = [...config.players]
    const ordered = order
      .map(name => { const i = pool.findIndex(p => p.name === name); return i >= 0 ? pool.splice(i, 1)[0] : null })
      .filter(Boolean)

    setPlayers(ordered)
    setLives(Object.fromEntries(ordered.map(p => [p.id, maxLives])))
    setCurrentPlayerIdx(0)

    const start = pickStartingPlayer(careers, rosters, allStarIdSet)
    setChainPlayer(start)
    setExcludedKeys(new Set())
    setLastConnections([])
    setHistory([])
    setWinner(null)
    setLastOutcome(null)
    setPhase(PHASES.PLAYING)
  }

  // Next player still holding at least one life, wrapping around. Returns the
  // current index when they are the only survivor, -1 when nobody is left.
  function nextAliveIdx(fromIdx, livesMap) {
    for (let step = 1; step <= players.length; step++) {
      const i = (fromIdx + step) % players.length
      if ((livesMap[players[i].id] || 0) > 0) return i
    }
    return -1
  }

  const currentPlayer = players[currentPlayerIdx] || null
  const currentPlayerName = currentPlayer?.name || ''

  const noSameTeam = !!config?.noSameTeam
  const curExcluded = noSameTeam && chainPlayer && careers
    ? excludedConnections(excludedKeys, careers, chainPlayer.id) : []
  const exceptionActive = noSameTeam && chainPlayer && careers && excludedKeys.size > 0
    && !hasAvailableOutside(chainPlayer.id, careers, excludedKeys)

  function handleSubmit({ guessPlayer }) {
    const result = validatePick(
      chainPlayer.id,
      guessPlayer.id,
      careers,
      config.noSameTeam ? excludedKeys : new Set(),
      config.noSameTeam,
    )
    const correct = result !== null

    if (correct) {
      setHistory(prev => [...prev, {
        prevPlayer: chainPlayer.name,
        guesser: currentPlayerName,
        guessedPlayer: guessPlayer.name,
        correct: true,
        connection: result.connections[0],
      }])
      setLastOutcome({
        correct: true,
        guesser: currentPlayerName,
        prevPlayer: chainPlayer.name,
        guessedPlayer: guessPlayer.name,
        connection: result.connections[0],
      })

      // Chain continues — the team-seasons of this link are now excluded for the next pick.
      setChainPlayer(guessPlayer)
      setExcludedKeys(config.noSameTeam ? new Set(result.connections.map(c => c.key)) : new Set())
      setLastConnections(result.connections)
      setCurrentPlayerIdx(nextAliveIdx(currentPlayerIdx, lives))
      return
    }

    // Wrong guess — the guesser loses a life. The chain player (and its
    // exclusions) stay put, so the next player faces the same link.
    const livesLeft = Math.max(0, (lives[currentPlayer.id] || 0) - 1)
    const newLives = { ...lives, [currentPlayer.id]: livesLeft }
    setLives(newLives)

    setHistory(prev => [...prev, {
      prevPlayer: chainPlayer.name,
      guesser: currentPlayerName,
      guessedPlayer: guessPlayer.name,
      correct: false,
      connection: null,
      livesLeft,
    }])
    setLastOutcome({
      correct: false,
      guesser: currentPlayerName,
      prevPlayer: chainPlayer.name,
      guessedPlayer: guessPlayer.name,
      livesLeft,
    })

    const survivors = players.filter(p => (newLives[p.id] || 0) > 0)
    if (survivors.length <= 1) {
      // Last one standing wins. In a solo game nobody survives — the lone
      // player is still the one whose game we record.
      setWinner(survivors[0] || currentPlayer)
      setPhase(PHASES.FINAL)
      return
    }
    setCurrentPlayerIdx(nextAliveIdx(currentPlayerIdx, newLives))
  }

  async function handleFinish() {
    await saveGame({
      playerIds: players.map(p => p.id),
      playerNames: players.map(p => p.name),
      winnerId: winner.id,
      winnerName: winner.name,
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
          excluded={curExcluded}
          exceptionActive={exceptionActive}
          noSameTeam={noSameTeam}
          allPlayers={allPlayers}
          currentPlayer={currentPlayerName}
          roster={players}
          lives={lives}
          maxLives={maxLives}
          currentPlayerId={currentPlayer?.id}
          lastOutcome={lastOutcome}
          onSubmit={handleSubmit}
          onBack={() => setPhase(PHASES.SETUP)}
        />
      )}
      {phase === PHASES.FINAL && (
        <FinalScreen
          winner={winner?.name || ''}
          soloOut={players.length === 1}
          history={history}
          onFinish={handleFinish}
        />
      )}
    </>
  )
}
