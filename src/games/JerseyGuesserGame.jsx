import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import JerseyGuesserScreen from '../screens/JerseyGuesserScreen.jsx'
import JerseyGuesserGameScreen from '../screens/JerseyGuesserGameScreen.jsx'
import { useJerseyGames } from '../hooks/useProfiles.js'

export default function JerseyGuesserGame() {
  const navigate = useNavigate()
  const { games, saveGame, deleteGame } = useJerseyGames()
  const [phase, setPhase] = useState('setup')
  const [players, setPlayers] = useState([])
  const [rounds, setRounds] = useState(5)

  if (phase === 'setup') {
    return (
      <JerseyGuesserScreen
        onBack={() => navigate('/')}
        onStart={({ players, rounds }) => {
          setPlayers(players)
          setRounds(rounds)
          setPhase('game')
        }}
        savedGames={games}
        onDeleteGame={deleteGame}
      />
    )
  }

  return (
    <JerseyGuesserGameScreen
      players={players}
      rounds={rounds}
      onBack={() => setPhase('setup')}
      onSaveGame={saveGame}
    />
  )
}
