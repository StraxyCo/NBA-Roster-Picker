import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NicknameSetupScreen from '../screens/NicknameSetupScreen.jsx'
import NicknameGameScreen from '../screens/NicknameGameScreen.jsx'
import { useNicknameGames } from '../hooks/useProfiles.js'

const PHASES = { SETUP: 'setup', PLAYING: 'playing' }

export default function NicknameGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useNicknameGames()
  const [phase, setPhase] = useState(PHASES.SETUP)
  const [config, setConfig] = useState(null)

  function handleStart(cfg) {
    setConfig(cfg)
    setPhase(PHASES.PLAYING)
  }

  return (
    <>
      {phase === PHASES.SETUP && (
        <NicknameSetupScreen
          onBack={() => navigate('/')}
          onStart={handleStart}
          savedGames={games}
          onDeleteGame={deleteGame}
        />
      )}
      {phase === PHASES.PLAYING && config && (
        <NicknameGameScreen
          players={config.players}
          rounds={config.rounds}
          onBack={() => navigate('/')}
          onSaveGame={saveGame}
        />
      )}
    </>
  )
}
