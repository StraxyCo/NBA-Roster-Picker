import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import JerseyGuesserScreen from '../screens/JerseyGuesserScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import JerseyGuesserGameScreen from '../screens/JerseyGuesserGameScreen.jsx'
import { useJerseyGames } from '../hooks/useProfiles.js'

const PHASES = { SETUP: 'setup', ORDER_DRAW: 'order_draw', PLAYING: 'playing' }

export default function JerseyGuesserGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useJerseyGames()
  const [phase, setPhase] = useState(PHASES.SETUP)
  const [config, setConfig] = useState(null)

  function handleStart(cfg) {
    setConfig(cfg)
    setPhase(PHASES.ORDER_DRAW)
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
        <JerseyGuesserScreen
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
        <JerseyGuesserGameScreen
          players={config.players}
          rounds={config.rounds}
          onBack={() => setPhase(PHASES.SETUP)}
          onSaveGame={saveGame}
        />
      )}
    </>
  )
}
