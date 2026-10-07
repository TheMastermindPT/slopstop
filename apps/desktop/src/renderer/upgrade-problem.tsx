import { useEffect, useRef } from "react";
import styles from "./projects-workspace.module.css";
import type { UpgradeProblem as Problem } from "./use-project-upgrade.js";

/**
 * Why the update failed, under the safe-mode view: the sentence, the reason and the reference
 * in one alert, then "Try again" unless the update was refused. Focus moves into the panel.
 */
export function UpgradeProblem(props: Readonly<{ problem: Problem; onRetry(): void }>) {
  const { diagnostic, status } = props.problem.result;
  const first = useRef<HTMLParagraphElement>(null);
  const retry = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    (retry.current ?? first.current)?.focus();
  }, []);
  return (
    <div className={styles["actions"]}>
      <div className={styles["error"]} role="alert">
        <p ref={first} tabIndex={-1}>
          This Project could not be updated. Your data is intact.
        </p>
        <p>{diagnostic.message}</p>
        <p className={styles["codeLine"]}>Reference: {diagnostic.code}</p>
      </div>
      {status === "refused" ? null : (
        <button ref={retry} type="button" onClick={props.onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
