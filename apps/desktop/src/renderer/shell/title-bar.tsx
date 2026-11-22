import { RaidhoMark } from "../brand/raidho-mark.js";
import seixo from "../theme/seixo.module.css";
import styles from "./title-bar.module.css";

/**
 * The rune title bar at the top of the window: the mark, the page's one level-1 heading and, while
 * a Project is open, one button with its name. The bar drags the window; the button does not.
 * Rendered with no name, it holds no control. The brand carries `data-title-bar-brand`, the name
 * the skip button's rule finds it by (`skip-link.module.css`), wherever it sits in the bar.
 */
export function TitleBar(
  props: Readonly<{ projectName?: string | undefined; onShowProjects?: (() => void) | undefined }>,
) {
  return (
    <header className={styles["bar"]}>
      <div className={styles["brand"]} data-title-bar-brand="">
        <RaidhoMark className={styles["mark"]} />
        <h1 className={styles["wordmark"]}>Ragnarok</h1>
      </div>
      {props.projectName === undefined ? null : (
        <div className={`${seixo["seixo"]} ${styles["project"]}`}>
          <button
            type="button"
            className={styles["name"]}
            aria-label={`Project ${props.projectName}`}
            onClick={props.onShowProjects}
          >
            {props.projectName}
          </button>
        </div>
      )}
    </header>
  );
}
