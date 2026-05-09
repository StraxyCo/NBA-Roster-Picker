import { Routes, Route, Navigate } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen.jsx'
import RosterPickerGame from './games/RosterPickerGame.jsx'
import JerseyGuesserGame from './games/JerseyGuesserGame.jsx'
import WhoHasMoreGame from './games/WhoHasMoreGame.jsx'
import TeamLeadersGame from './games/TeamLeadersGame.jsx'
import StatsOverUnderGame from './games/StatsOverUnderGame.jsx'
import AllStarsGame from './games/AllStarsGame.jsx'
import WhosThatGuyGame from './games/WhosThatGuyGame.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/roster-picker" element={<RosterPickerGame />} />
      <Route path="/jersey-guesser" element={<JerseyGuesserGame />} />
      <Route path="/who-has-more" element={<WhoHasMoreGame />} />
      <Route path="/team-leaders" element={<TeamLeadersGame />} />
      <Route path="/stats-over-under" element={<StatsOverUnderGame />} />
      <Route path="/all-stars" element={<AllStarsGame />} />
      <Route path="/whos-that-guy" element={<WhosThatGuyGame />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
