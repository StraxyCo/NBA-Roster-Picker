import { useState, useRef } from 'react'
import styles from './SeasonDrawScreen.module.css'

const REEL_DURATION = 2800
const TICK_START    = 60
const TICK_END      = 220

// Generic season-draw reel. Spins through seasons and auto-calls onDrawn(season)
// 1.2 s after locking. No repeated text shown after landing.
export default function SeasonDrawScreen({ eyebrow, seasons, onDrawn }) {
  const [drawAnim, setDrawAnim]       = useState('ready')
  const [displaySeason, setDisplay]   = useState(null)
  const timerRef = useRef(null)

  function startSpin() {
    const chosen = seasons[Math.floor(Math.random() * seasons.length)]
    setDrawAnim('spinning')
    const startTime = Date.now()

    function tick() {
      const elapsed  = Date.now() - startTime
      const progress = Math.min(elapsed / REEL_DURATION, 1)
      const interval = TICK_START + (TICK_END - TICK_START) * Math.pow(progress, 2)
      if (progress < 1) {
        setDisplay(seasons[Math.floor(Math.random() * seasons.length)])
        timerRef.current = setTimeout(tick, interval)
      } else {
        setDisplay(chosen)
        setDrawAnim('done')
        timerRef.current = setTimeout(() => onDrawn(chosen), 1200)
      }
    }
    tick()
  }

  return (
    <div className={styles.screen}>
      <div className={styles.drawBox}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <div className={[
          styles.seasonCard,
          drawAnim === 'spinning' ? styles.seasonCardSpinning : '',
          drawAnim === 'done'     ? styles.seasonCardLocked   : '',
        ].join(' ')}>
          {drawAnim === 'ready' ? (
            <span className={styles.questionMark}>?</span>
          ) : (
            <span className={styles.seasonText}>
              {displaySeason ? displaySeason.replace('-', '/') : ''}
            </span>
          )}
        </div>
        {drawAnim === 'ready' && (
          <button className={styles.drawBtn} onClick={startSpin}>Draw Season</button>
        )}
      </div>
    </div>
  )
}
