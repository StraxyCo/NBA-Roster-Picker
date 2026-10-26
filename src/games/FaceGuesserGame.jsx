import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FaceGuesserSetupScreen from '../screens/FaceGuesserSetupScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import FaceGuesserGameScreen from '../screens/FaceGuesserGameScreen.jsx'
import { useFaceGuesserGames } from '../hooks/useProfiles.js'

const PHASES = { SETUP: 'setup', ORDER_DRAW: 'order_draw', PLAYING: 'playing' }

export default function FaceGuesserGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useFaceGuesserGames()
  const [phase, setPhase] = useState(PHASES.SETUP)
  const [config, setConfig] = useState(null)

  function handleStart(cfg) {
    setConfig(cfg)
    // Turn order matters here: within a round the first to answer has not heard
    // anyone else's guess, so who goes first is drawn rather than taken from the
    // setup slots. A solo run has nothing to draw.
    setPhase(cfg.players.length > 1 ? PHASES.ORDER_DRAW : PHASES.PLAYING)
  }

  function handleOrderDrawn(order) {
    setConfig(prev => ({
      ...prev,
      players: [...prev.players].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)),
    }))
    setPhase(PHASES.PLAYING)
  }

  return (
    <>
      {phase === PHASES.SETUP && (
        <FaceGuesserSetupScreen
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
      {phase === PHASES.PLAYING && config && (
        <FaceGuesserGameScreen
          players={config.players}
          startTier={config.startTier}
          onBack={() => setPhase(PHASES.SETUP)}
          onSaveGame={saveGame}
        />
      )}
    </>
  )
}
