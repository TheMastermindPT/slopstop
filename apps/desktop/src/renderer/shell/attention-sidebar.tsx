import seixo from "../theme/seixo.module.css";
import styles from "./attention-sidebar.module.css";

/** The heading the rail focuses when Attention becomes current. */
export const attentionHeadingId = "attention-heading";

/**
 * The Attention sidebar, as far as this slice goes: its heading and a line that says no source
 * feeds it yet. The typed items, the rune rule and the diamond arrive with `sh-s2-attention-sidebar`.
 */
export function AttentionSidebar() {
  return (
    <aside aria-label="Attention" className={`${seixo["seixo"]} ${styles["sidebar"]}`}>
      <h2 id={attentionHeadingId} className={styles["heading"]} tabIndex={-1}>
        Attention
      </h2>
      <p className={styles["empty"]}>Attention has no sources yet.</p>
    </aside>
  );
}
