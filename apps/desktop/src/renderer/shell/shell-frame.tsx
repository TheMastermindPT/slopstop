import type { ReactNode } from "react";
import styles from "./shell-frame.module.css";

/**
 * The frame under the rune bar: the rail, then the work area with a top place, the one sidebar
 * place and the centre. Layout and landmarks only; it holds no state.
 */
export function ShellFrame(
  props: Readonly<{
    rail: ReactNode;
    /** Above the sidebar and the centre: the old header until Q5 moves the harness status. */
    top: ReactNode;
    sidebar: ReactNode;
    children: ReactNode;
    /** The work area's look while the old shell's styles still apply to it. */
    workClassName?: string | undefined;
  }>,
) {
  return (
    <div className={styles["frame"]}>
      {props.rail}
      <main className={[styles["work"], props.workClassName].filter(Boolean).join(" ")}>
        <div className={styles["top"]}>{props.top}</div>
        <div className={styles["side"]}>{props.sidebar}</div>
        <div className={styles["centre"]}>{props.children}</div>
      </main>
    </div>
  );
}
