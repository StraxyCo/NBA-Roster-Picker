import { useState, useEffect, useRef } from 'react'
import styles from './OrderDrawScreen.module.css'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function OrderDrawScreen({ players, onOrderDrawn }) {
  const [phase, setPhase]             = useState('idle')   // idle | rolling | revealed
  const [rollingNames, setRollingNames] = useState([])     // random names shown during roll
  const [order, setOrder]             = useState([])
  const intervalRef = useRef(null)

  function startDraw() {
    const finalOrder = shuffle(players)
    setOrder(finalOrder)
    setPhase('rolling')

    // Rapidly shuffle all slots simultaneously for 1.4s, then snap to result
    let ticks = 0
    const totalTicks = 18
    intervalRef.current = setInterval(() => {
      // Show random names in all slots at once
      setRollingNames(finalOrder.map(() => players[Math.floor(Math.random() * players.length)]))
      ticks++
      if (ticks >= totalTicks) {
        clearInterval(intervalRef.current)
        setPhase('revealed')
      }
    }, 80)
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <header className={styles.header}>
          <div className={styles.eyebrow}>Pick Order Draw</div>
          <h1 className={styles.title}>Who picks<br />first?</h1>
        </header>

        {phase === 'idle' && (
          <div className={`${styles.idleState} fade-up`}>
            <p className={styles.desc}>
              {players.length} player{players.length > 1 ? 's' : ''} registered.<br />
              Draw to decide the pick order.
            </p>
            <div className={styles.playerPills}>
              {players.map((p, i) => (
                <div key={i} className={styles.pill}>{p}</div>
              ))}
            </div>
            <button className={styles.drawBtn} onClick={startDraw}>
              Draw Order
            </button>
          </div>
        )}

        {phase === 'rolling' && (
          <div className={styles.rollingState}>
            <div className={styles.slotMachine}>
              {order.map((_, i) => (
                <div key={i} className={`${styles.slot} ${styles.slotActive}`}>
                  <span className={styles.slotPos}>{i + 1}</span>
                  <span className={styles.slotName}>
                    {rollingNames[i] || '…'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === 'revealed' && (
          <div className={`${styles.revealedState} fade-up`}>
            <div className={styles.slotMachine}>
              {order.map((name, i) => (
                <div
                  key={i}
                  className={`${styles.slot} ${styles.slotRevealed}`}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <span className={styles.slotPos}>{i + 1}</span>
                  <span className={styles.slotName}>{name}</span>
                  {i === 0 && <span className={styles.firstBadge}>First pick</span>}
                </div>
              ))}
            </div>
            <button
              className={styles.drawBtn}
              onClick={() => onOrderDrawn(order)}
              style={{ marginTop: '32px' }}
            >
              Start Drafting →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
