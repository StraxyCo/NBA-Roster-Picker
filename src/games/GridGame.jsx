import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import GridSetupScreen from '../screens/GridSetupScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import GridGameScreen from '../screens/GridGameScreen.jsx'
import { useGridGames } from '../hooks/useProfiles.js'
import { generateCategories, buildRosterIndex, getAllPlayers } from '../utils/gridCategories.js'
import styles from './WhosThatGuyGame.module.css'  // reuse between-turns + final CSS

const PHASES = { SETUP: 'setup', ORDER_DRAW: 'order_draw', PLAYING: 'playing', FINAL: 'final' }

function FinalScreen({ cells, rowCats, colCats, scores, turnOrder, onFinish }) {
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

        {/* Quick grid summary */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' }}>
          {cells.map((row, r) => row.map((cell, c) => cell?.correct ? (
            <div key={`${r}-${c}`} style={{ display: 'flex', gap: 8, padding: '4px 12px', background: 'rgba(34,197,94,0.06)', borderRadius: 6, fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--white-40)', flex: 1 }}>{rowCats[r].label} × {colCats[c].label}</span>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>{cell.playerName}</span>
              <span style={{ color: 'var(--white-30)', fontSize: '0.7rem' }}>({cell.pickedBy})</span>
            </div>
          ) : null))}
        </div>

        <button className={styles.finishBtn} onClick={onFinish}>New Game</button>
      </div>
    </div>
  )
}

export default function GridGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useGridGames()

  const [phase, setPhase]         = useState(PHASES.SETUP)
  const [config, setConfig]       = useState(null)
  const [careers, setCareers]     = useState(null)
  const [rosters, setRosters]     = useState(null)
  const [allstars, setAllstars]   = useState(null)

  const [turnOrder, setTurnOrder]   = useState([])
  const [playerObjects, setPlayerObjects] = useState([])
  const [turnIndex, setTurnIndex]   = useState(0)
  const [scores, setScores]         = useState({})
  const [cells, setCells]           = useState([])       // cells[r][c]
  const [rowCats, setRowCats]       = useState([])
  const [colCats, setColCats]       = useState([])

  useEffect(() => {
    Promise.all([
      fetch('/careers.json').then(r => r.json()),
      fetch('/rosters.json').then(r => r.json()),
      fetch('/allstars.json').then(r => r.json()),
    ]).then(([c, r, a]) => { setCareers(c); setRosters(r); setAllstars(a) })
      .catch(e => console.error('data load', e))
  }, [])

  const rosterIndex = useMemo(() => rosters ? buildRosterIndex(rosters) : null, [rosters])
  const allPlayers  = useMemo(() => careers ? getAllPlayers(careers) : [], [careers])
  const dataLoaded  = careers !== null && rosters !== null && allstars !== null

  function handleStart(cfg) { setConfig(cfg); setPhase(PHASES.ORDER_DRAW) }

  function handleOrderDrawn(order) {
    const size = config.gridSize
    const ri = rosterIndex

    // Generate categories
    const allCats = generateCategories(size * 2, allstars, ri, config.seasons)
    const rows = allCats.slice(0, size)
    const cols = allCats.slice(size, size * 2)
    setRowCats(rows)
    setColCats(cols)
    setCells(Array.from({ length: size }, () => Array(size).fill(null)))

    setTurnOrder(order)
    setPlayerObjects(config.players.filter(p => order.includes(p.name)).sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)))
    setTurnIndex(0)
    setScores(Object.fromEntries(order.map(n => [n, 0])))
    setPhase(PHASES.PLAYING)
  }

  const currentPlayerName = turnOrder[turnIndex % (turnOrder.length || 1)] || ''

  function handleCellSubmit(r, c, { player, correct }) {
    const nextCells = cells.map(row => [...row])
    nextCells[r][c] = { playerName: player.name, pickedBy: currentPlayerName, correct }
    if (correct) {
      setScores(s => ({ ...s, [currentPlayerName]: (s[currentPlayerName] || 0) + 1 }))
    }
    setCells(nextCells)

    // Check if all cells filled
    const allFilled = nextCells.every(row => row.every(cell => cell !== null))
    if (allFilled) {
      setPhase(PHASES.FINAL)
    } else {
      // Advance to next player
      setTurnIndex(turnIndex + 1)
    }
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
        <GridSetupScreen
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
      {phase === PHASES.PLAYING && (
        <GridGameScreen
          rowCats={rowCats}
          colCats={colCats}
          allPlayers={allPlayers}
          careers={careers || {}}
          currentPlayer={currentPlayerName}
          scores={scores}
          turnOrder={turnOrder}
          cells={cells}
          onCellSubmit={handleCellSubmit}
          onBack={() => setPhase(PHASES.SETUP)}
        />
      )}
      {phase === PHASES.FINAL && (
        <FinalScreen
          cells={cells}
          rowCats={rowCats}
          colCats={colCats}
          scores={scores}
          turnOrder={turnOrder}
          onFinish={handleFinish}
        />
      )}
    </>
  )
}
