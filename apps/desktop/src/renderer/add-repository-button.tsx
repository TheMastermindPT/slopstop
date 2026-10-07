import { FolderPlusIcon } from "@phosphor-icons/react";
import type { RegistrationCapability } from "@slopstop/protocol";
import { busyAnnouncement } from "./busy-announcement.js";
import type { ListState } from "./projects-list.js";
import styles from "./projects-workspace.module.css";

const registryBroken = new Set([
  "REGISTRY_CORRUPT",
  "REGISTRY_SCHEMA_UNKNOWN",
  "REGISTRY_SCHEMA_NEWER",
]);

/** Whether the saved list says the registry itself is damaged; adding is blocked then. */
export function isRegistryBroken(list: ListState): boolean {
  return list.status === "broken" && registryBroken.has(list.code);
}

function addHint(capability: RegistrationCapability, broken: boolean) {
  if (capability.status !== "available")
    return "Not available on Linux in this version. Adding repositories works on Windows only.";
  if (broken) return "Unavailable while saved Projects can't be read.";
  return "Choose a Git repository folder on this computer.";
}

/**
 * The entry point for adding a repository; blocked reasons stay focusable and readable. While
 * a Project is being opened or updated, the button stays focusable but does nothing.
 */
export function AddRepositoryButton(
  props: Readonly<{
    capability: RegistrationCapability;
    list: ListState;
    busy: boolean;
    onAdd(): void;
    announce(message: string): void;
  }>,
) {
  const broken = isRegistryBroken(props.list);
  const blocked = broken || props.capability.status !== "available";
  return (
    <div className={styles["add"]}>
      <button
        id="add-repository"
        type="button"
        aria-describedby="add-hint"
        aria-disabled={blocked || props.busy ? "true" : undefined}
        onClick={() => {
          if (props.busy) props.announce(busyAnnouncement);
          else if (broken)
            props.announce("Adding is unavailable while saved Projects can't be read.");
          else if (blocked)
            props.announce("Adding repositories isn't available on Linux in this version.");
          else props.onAdd();
        }}
      >
        <FolderPlusIcon size={18} aria-hidden="true" />
        Add existing repository
      </button>
      <p id="add-hint" className={blocked ? styles["blocked"] : undefined}>
        {addHint(props.capability, broken)}
      </p>
    </div>
  );
}
