import { RaidhoMark } from "../brand/raidho-mark.js";
import styles from "./title-bar.module.css";

/**
 * The rune title bar at the top of the window: the mark and the page's one level-1 heading. The
 * whole bar drags the window and holds no control.
 */
export function TitleBar() {
  return (
    <header className={styles["bar"]}>
      <div className={styles["brand"]}>
        <RaidhoMark className={styles["mark"]} />
        <h1 className={styles["wordmark"]}>Ragnarok</h1>
      </div>
    </header>
  );
}
