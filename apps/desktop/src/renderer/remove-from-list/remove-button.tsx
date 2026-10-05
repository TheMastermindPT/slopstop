import type { Entry, RowProps } from "../projects-list.js";
import styles from "../projects-workspace.module.css";

// Why Remove is blocked for this row: the open Project, or one that still needs recovery (Q23).
function removeBlock(project: Entry, selected: boolean) {
  if (selected)
    return {
      reason: "Open now. Switch to another Project first to remove it.",
      announcement: "This Project is open. Switch to another Project first to remove it.",
    };
  if (project.registration === "incomplete")
    return {
      reason: "Needs recovery; it stays visible until recovered.",
      announcement: "This Project needs recovery; it stays visible until recovered.",
    };
  return undefined;
}

/** The row's Remove action; blocked rows keep it focusable with their reason. */
export function RemoveButton({
  project,
  selected,
  ...props
}: RowProps & Readonly<{ project: Entry; selected: boolean }>) {
  if (project.registration === "unbound") return null;
  const block = removeBlock(project, selected);
  const reasonId = `reason-${project.projectId}`;
  return (
    <>
      <button
        type="button"
        data-remove={project.projectId}
        aria-label={`Remove ${project.name} from list`}
        aria-disabled={block === undefined ? undefined : "true"}
        aria-describedby={block === undefined ? undefined : reasonId}
        onClick={() =>
          block === undefined ? props.onRemove(project) : props.announce(block.announcement)
        }
      >
        Remove
      </button>
      {block === undefined ? null : (
        <p className={styles["rowReason"]} id={reasonId}>
          {block.reason}
        </p>
      )}
    </>
  );
}
