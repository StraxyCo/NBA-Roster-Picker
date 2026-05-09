import styles from './WhoHasMoreScreen.module.css'

export default function WhoHasMoreScreen({ onBack }) {
  return (
    <div className={styles.container}>
      <button className={styles.backArrow} onClick={onBack} aria-label="Back to home">←</button>
      <h1 className={styles.title}>Who Has More</h1>
    </div>
  )
}
