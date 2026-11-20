import { RunaIcon, type RunaIconName } from "../icons/runa-icon.js";
import seixo from "../theme/seixo.module.css";
import styles from "./rail.module.css";

/** A destination the rail offers (Q3: Projects and Attention only). */
export type Destination = "projects" | "attention";

const items: readonly Readonly<{ destination: Destination; label: string; icon: RunaIconName }>[] =
  [
    { destination: "projects", label: "Projects", icon: "folder" },
    { destination: "attention", label: "Attention", icon: "flame" },
  ];

/**
 * The activity rail: one button per destination, the current one pressed. The label hides below
 * 1280px; `aria-label` keeps the button's name then.
 */
export function Rail(
  props: Readonly<{ current: Destination; onSelect: (destination: Destination) => void }>,
) {
  return (
    <nav aria-label="Activity" className={`${seixo["seixo"]} ${styles["rail"]}`}>
      {items.map((item) => (
        <button
          key={item.destination}
          type="button"
          className={styles["item"]}
          aria-label={item.label}
          aria-pressed={props.current === item.destination}
          onClick={() => props.onSelect(item.destination)}
        >
          <RunaIcon name={item.icon} className={styles["icon"]} />
          <span className={styles["label"]}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
