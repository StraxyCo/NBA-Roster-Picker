import { useState } from 'react'
import SetupScreen from './screens/SetupScreen.jsx'
import OrderDrawScreen from './screens/OrderDrawScreen.jsx'
import TurnScreen from './screens/TurnScreen.jsx'
import TeamDrawScreen from './screens/TeamDrawScreen.jsx'
import PickPlayerScreen from './screens/PickPlayerScreen.jsx'
import FinalScreen from './screens/FinalScreen.jsx'
import { SLOT_LABELS } from './data/teams.js'

// Screen identifiers
const SCREENS = {
  SETUP:       'SETUP',
  ORDER_DRAW:  'ORDER_DRAW',
  TURN:        'TURN',
  TEAM_DRAW:   'TEAM_DRAW',
  PICK_PLAYER: 'PICK_PLAYER',
  FINAL:       'FINAL',
}

function buildEmptyRoster(size) {
  return Array(size).fill(null)
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SETUP)

  // Config from setup
  const [players, setPlayers]           = useState([])
  const [rosterSize, setRosterSize]     = useState(6)
  const [eliminateTeams, setEliminate]  = useState(true)

  // Game state
  const [turnOrder, setTurnOrder]       = useState([])   // ["Alice", "Bob", ...] shuffled
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0)
  const [rosters, setRosters]           = useState({})   // { "Alice": [null, null, ...], ... }
  const [drawnTeams, setDrawnTeams]     = useState([])   // slugs/ids already drawn
  const [currentTeam, setCurrentTeam]  = useState(null)  // team object drawn this turn
  const [currentRoster, setCurrentRoster] = useState([]) // players from API this turn

  // ── Handlers ──────────────────────────────────────────────

  function handleSetupStart({ players, rosterSize, eliminateTeams }) {
    setPlayers(players)
    setRosterSize(rosterSize)
    setEliminate(eliminateTeams)
    // Init empty rosters
    const emptyRosters = {}
    players.forEach(p => { emptyRosters[p] = buildEmptyRoster(rosterSize) })
    setRosters(emptyRosters)
    setScreen(SCREENS.ORDER_DRAW)
  }

  function handleOrderDrawn(order) {
    setTurnOrder(order)
    setCurrentTurnIdx(0)
    setScreen(SCREENS.TURN)
  }

  function handleDrawTeam() {
    setScreen(SCREENS.TEAM_DRAW)
  }

  function handleTeamDrawn(team, rosterPlayers) {
    setCurrentTeam(team)
    setCurrentRoster(rosterPlayers)
    if (eliminateTeams) {
      setDrawnTeams(prev => [...prev, team.id])
    }
    setScreen(SCREENS.PICK_PLAYER)
  }

  function handlePickValidated(updatedUserRoster) {
    const currentPlayer = turnOrder[currentTurnIdx]
    setRosters(prev => ({ ...prev, [currentPlayer]: updatedUserRoster }))

    const nextIdx = currentTurnIdx + 1

    // Check if everyone has filled their roster
    const updatedRosters = { ...rosters, [currentPlayer]: updatedUserRoster }
    const allFull = turnOrder.every(p =>
      updatedRosters[p]?.every(slot => slot !== null)
    )

    if (allFull) {
      setRosters(updatedRosters)
      setScreen(SCREENS.FINAL)
    } else {
      setCurrentTurnIdx(nextIdx % turnOrder.length)
      setCurrentTeam(null)
      setCurrentRoster([])
      setScreen(SCREENS.TURN)
    }
  }

  // ── Render ─────────────────────────────────────────────────

  const currentPlayer = turnOrder[currentTurnIdx] || ''
  const currentUserRoster = rosters[currentPlayer] || []
  const picksCount = currentUserRoster.filter(Boolean).length

  return (
    <>
      {screen === SCREENS.SETUP && (
        <SetupScreen onStart={handleSetupStart} />
      )}

      {screen === SCREENS.ORDER_DRAW && (
        <OrderDrawScreen
          players={players}
          onOrderDrawn={handleOrderDrawn}
        />
      )}

      {screen === SCREENS.TURN && (
        <TurnScreen
          currentPlayer={currentPlayer}
          picksCount={picksCount}
          rosterSize={rosterSize}
          rosters={rosters}
          turnOrder={turnOrder}
          onDraw={handleDrawTeam}
        />
      )}

      {screen === SCREENS.TEAM_DRAW && (
        <TeamDrawScreen
          drawnTeams={drawnTeams}
          eliminateTeams={eliminateTeams}
          onTeamDrawn={handleTeamDrawn}
        />
      )}

      {screen === SCREENS.PICK_PLAYER && (
        <PickPlayerScreen
          currentPlayer={currentPlayer}
          team={currentTeam}
          nbaRoster={currentRoster}
          userRoster={currentUserRoster}
          rosterSize={rosterSize}
          onValidate={handlePickValidated}
        />
      )}

      {screen === SCREENS.FINAL && (
        <FinalScreen
          rosters={rosters}
          turnOrder={turnOrder}
          rosterSize={rosterSize}
          onRestart={() => {
            setScreen(SCREENS.SETUP)
            setTurnOrder([])
            setCurrentTurnIdx(0)
            setRosters({})
            setDrawnTeams([])
            setCurrentTeam(null)
            setCurrentRoster([])
          }}
        />
      )}
    </>
  )
}
