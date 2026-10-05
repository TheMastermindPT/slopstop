import { ClockIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { isRegistryBroken } from "./add-repository-button.js";
import type { ListState } from "./projects-list.js";
import styles from "./projects-workspace.module.css";

/** Why the saved list is not shown; a busy registry and a damaged one stay distinct. */
export function ListProblem({ list }: Readonly<{ list: ListState }>) {
  if (list.status === "unavailable" && list.code === "REGISTRY_BUSY")
    return (
      <div className={styles["busyProblem"]} role="status">
        <ClockIcon size={18} aria-hidden="true" />
        <strong>Saved Projects are busy</strong>
        <p>Another Ragnarok window is updating them. Use Refresh in a moment.</p>
        <code>Reference: {list.code}</code>
      </div>
    );
  if (list.status === "broken" && isRegistryBroken(list))
    return (
      <div className={styles["brokenProblem"]} role="alert">
        <WarningCircleIcon size={18} aria-hidden="true" />
        <strong>Saved Projects can't be read</strong>
        <p>
          The Project registry is damaged or was written by a newer Ragnarok. Nothing was changed or
          reset.
        </p>
        <code>Reference: {list.code}</code>
      </div>
    );
  return (
    <p role="alert">
      Projects could not be read. {"code" in list ? list.code : "Request cancelled"}. Use Refresh to
      try again.
    </p>
  );
}
