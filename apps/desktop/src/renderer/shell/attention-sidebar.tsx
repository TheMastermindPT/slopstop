import seixo from "../theme/seixo.module.css";
import styles from "./attention-sidebar.module.css";
import { attentionHeading } from "./focus-headings.js";

/**
 * The Attention sidebar while no source feeds it: its head, the rune rule (decoration, hidden from
 * assistive technology) and a line that says so in words. No count and no list until a source
 * exists (Q2, Q7, Q11).
 */
export function AttentionSidebar() {
  return (
    <aside aria-label="Attention" className={`${seixo["seixo"]} ${styles["sidebar"]}`}>
      <div className={styles["head"]}>
        <h2 {...attentionHeading} className={styles["heading"]} tabIndex={-1}>
          Attention
        </h2>
      </div>
      <div aria-hidden="true" className={styles["rule"]}>
        <span className={styles["diamond"]} />
      </div>
      <p className={styles["empty"]}>Attention has no sources yet.</p>
    </aside>
  );
}
