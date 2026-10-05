import { FolderIcon, TerminalIcon, WarningIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef } from "react";
import styles from "../projects-workspace.module.css";
import type { FlowScreen } from "./use-add-repository.js";

const steps = ["Folder", "Trust", "Git version", "Git access", "Confirm"] as const;

const queries = [
  ["--is-inside-work-tree", "Is this a working folder?"],
  ["--is-bare-repository", "Is it a bare repository?"],
  ["--is-inside-git-dir", "Is it inside a .git folder?"],
  ["--path-format=absolute --show-toplevel", "Where does the working folder start?"],
  ["--absolute-git-dir", "Where is this folder's .git data?"],
  ["--path-format=absolute --git-common-dir", "Which repository does it share history with?"],
] as const;

/** The step heading; it takes focus whenever a new step or state is shown. */
export function StepHeading({
  children,
  focusKey,
}: Readonly<{ children: ReactNode; focusKey: string }>) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [focusKey]);
  return (
    <h2 id="ws-heading" tabIndex={-1} ref={heading}>
      {children}
    </h2>
  );
}

function StepsBar({ current }: Readonly<{ current: number }>) {
  return (
    <ol className={styles["steps"]} aria-label="Progress">
      {steps.map((label, index) => {
        const done = index < current;
        if (index === current)
          return (
            <li key={label} aria-current="step">
              {label}
              <span className={styles["srOnly"]}> (current, step {index + 1} of 5)</span>
            </li>
          );
        return (
          <li key={label}>
            {label}
            {done ? <span className={styles["srOnly"]}> (done)</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** The frame of a flow step: title, progress, and Esc as Cancel while the step is idle. */
export function StepFrame(
  props: Readonly<{
    current: number;
    cancellable: boolean;
    onCancel(): void;
    children: ReactNode;
  }>,
) {
  const { cancellable, onCancel } = props;
  useEffect(() => {
    if (!cancellable) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [cancellable, onCancel]);
  return (
    <div className={styles["step"]}>
      <p className={styles["flowTitle"]}>Add existing repository</p>
      <StepsBar current={props.current} />
      {props.children}
    </div>
  );
}

export function StepActions(
  props: Readonly<{ primary: string; busy: boolean; onPrimary(): void; onCancel(): void }>,
) {
  return (
    <div className={styles["actions"]}>
      <button type="button" disabled={props.busy} onClick={props.onPrimary}>
        {props.primary}
      </button>
      <button type="button" disabled={props.busy} onClick={props.onCancel}>
        Cancel
      </button>
      <span>{props.busy ? "Running — cannot be cancelled" : "Esc cancels"}</span>
    </div>
  );
}

export function BusyLine({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className={styles["busyLine"]} role="status">
      {children}
    </p>
  );
}

export function Target(
  props: Readonly<{ label: string; name: string; path: string; kind: "folder" | "program" }>,
) {
  const Icon = props.kind === "folder" ? FolderIcon : TerminalIcon;
  return (
    <div className={styles["target"]}>
      <span>{props.label}</span>
      <strong>
        <Icon size={16} aria-hidden="true" /> {props.name}
      </strong>
      <code>{props.path}</code>
    </div>
  );
}

export function Warning({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className={styles["warning"]}>
      <WarningIcon size={18} aria-hidden="true" />
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

export function QueryList() {
  return (
    <ol className={styles["queries"]}>
      {queries.map(([query, meaning]) => (
        <li key={query}>
          <code>git rev-parse {query}</code> {meaning}
        </li>
      ))}
    </ol>
  );
}

export type ScreenOf<Kind extends FlowScreen["kind"]> = Extract<FlowScreen, { kind: Kind }>;
