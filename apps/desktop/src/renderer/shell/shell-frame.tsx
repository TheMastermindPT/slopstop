import type { ReactNode } from "react";
import styles from "./shell-frame.module.css";

/**
 * The frame under the rune bar: the rail, then the work area with the one sidebar place, and beside
 * it the strip's place above the centre. Layout and landmarks only; it holds no state.
 */
export function ShellFrame(
  props: Readonly<{
    rail: ReactNode;
    /** Above the centre, beside the sidebar: the harness status and its strip. */
    strip: ReactNode;
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
        <div className={styles["strip"]}>{props.strip}</div>
        <div className={styles["side"]}>{props.sidebar}</div>
        <div className={styles["centre"]}>{props.children}</div>
      </main>
    </div>
  );
}
