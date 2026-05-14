import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WhoHasMoreScreen from '../screens/WhoHasMoreScreen.jsx'
import WhoHasMoreGameScreen from '../screens/WhoHasMoreGameScreen.jsx'
import { useWhoHasMoreGames } from '../hooks/useProfiles.js'

const PHASES = { SETUP: 'setup', PLAYING: 'playing' }

export default function WhoHasMoreGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useWhoHasMoreGames()
  const [phase, setPhase] = useState(PHASES.SETUP)
  const [config, setConfig] = useState(null)

  function handleStart(cfg) {
    setConfig(cfg)
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
