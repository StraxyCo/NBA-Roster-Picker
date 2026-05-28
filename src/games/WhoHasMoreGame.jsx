import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WhoHasMoreScreen from '../screens/WhoHasMoreScreen.jsx'
import OrderDrawScreen from '../screens/OrderDrawScreen.jsx'
import WhoHasMoreGameScreen from '../screens/WhoHasMoreGameScreen.jsx'
import { useWhoHasMoreGames } from '../hooks/useProfiles.js'

const PHASES = { SETUP: 'setup', ORDER_DRAW: 'order_draw', PLAYING: 'playing' }

export default function WhoHasMoreGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useWhoHasMoreGames()
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
        <WhoHasMoreScreen
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
        <WhoHasMoreGameScreen
          players={config.players}
          seasons={config.seasons}
          stats={config.stats}
          rounds={config.rounds}
          optionsPerQuestion={config.optionsPerQuestion}
          onBack={() => setPhase(PHASES.SETUP)}
          onSaveGame={saveGame}
        />
      )}
    </>
  )
}
