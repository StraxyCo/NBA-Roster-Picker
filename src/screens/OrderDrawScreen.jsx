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
  const [phase, setPhase]           = useState('idle')    // idle | rolling | revealed
  const [rollingName, setRollingName] = useState('')
  const [order, setOrder]           = useState([])
  const [revealedCount, setRevealedCount] = useState(0)
  const intervalRef = useRef(null)
  const finalOrder  = useRef([])

  function startDraw() {
    finalOrder.current = shuffle(players)
    setOrder(finalOrder.current)
    setPhase('rolling')
    setRevealedCount(0)

    let revealIdx = 0
    // Reveal one by one with a rolling effect
    revealNext(revealIdx)
  }

  function revealNext(idx) {
    if (idx >= finalOrder.current.length) {
      setPhase('revealed')
      return
    }

    // Roll for 1.2s then settle
    let ticks = 0
    const totalTicks = 14
    intervalRef.current = setInterval(() => {
      const randomName = players[Math.floor(Math.random() * players.length)]
      setRollingName(randomName)
      ticks++
      if (ticks >= totalTicks) {
        clearInterval(intervalRef.current)
        setRollingName('')
        setRevealedCount(idx + 1)
        setTimeout(() => revealNext(idx + 1), 400)
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
              {finalOrder.current.map((name, i) => (
                <div
                  key={i}
                  className={`${styles.slot} ${i < revealedCount ? styles.slotRevealed : ''} ${i === revealedCount ? styles.slotActive : ''}`}
                >
                  <span className={styles.slotPos}>{i + 1}</span>
                  <span className={styles.slotName}>
                    {i < revealedCount
                      ? name
                      : i === revealedCount
                        ? rollingName || '…'
                        : '?'
                    }
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
                  style={{ animationDelay: `${i * 0.08}s` }}
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
