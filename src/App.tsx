// Top-level shell. In M0/M1 the only screen is the local-pvp match.
// Future milestones add routing for mode-select / shop / reward / etc.

import { Match } from "./components/Match";

import styles from "./App.module.css";

export function App() {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>choss</h1>
        <span className={styles.tag}>vs Stockfish · M2 prototype</span>
      </header>
      <main className={styles.main}>
        <Match />
      </main>
    </div>
  );
}
