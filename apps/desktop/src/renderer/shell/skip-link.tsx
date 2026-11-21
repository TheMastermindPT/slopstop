import seixo from "../theme/seixo.module.css";
import styles from "./skip-link.module.css";

/**
 * "Skip to Attention": the window's first Tab stop. Unseen until it has focus, then drawn over the
 * bar with the Seixo ring. A press shows Attention and moves focus to its heading. A button, not a
 * link: the page denies navigation (Q19).
 */
export function SkipLink(props: Readonly<{ onSkip: () => void }>) {
  return (
    <div className={`${seixo["seixo"]} ${styles["place"]}`}>
      <button
        id="skip-to-attention"
        type="button"
        className={styles["skip"]}
        onClick={props.onSkip}
      >
        Skip to Attention
      </button>
    </div>
  );
}
