/**
 * The headings that take focus in the window, one owner for their ids (standing decision
 * `shared-vocab-union`): Projects and Attention in the sidebar, and the work area's heading, which
 * the add flow's steps and the open conversation draw too. F6, the rail and the hand-backs find
 * them by these ids. Each heading spreads its props object, so its id and the ring's attribute go
 * together; `shell-frame.module.css` draws the ring on that attribute, the one place it is text
 * outside this file (a style sheet cannot import a name).
 */
export const projectsHeadingId = "projects-heading";
export const attentionHeadingId = "attention-heading";
export const workHeadingId = "ws-heading";

/** The attribute the ring's rule selects. */
export const focusHeadingAttribute = "data-focus-heading";

/** What a heading that takes focus spreads: its id and the ring's attribute. */
type FocusHeadingProps = Readonly<{ id: string; "data-focus-heading": "" }>;

const focusHeading = (id: string): FocusHeadingProps => ({ id, "data-focus-heading": "" });

export const projectsHeading = focusHeading(projectsHeadingId);
export const attentionHeading = focusHeading(attentionHeadingId);
export const workHeading = focusHeading(workHeadingId);
