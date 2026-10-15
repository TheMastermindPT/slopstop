/**
 * Path data from the Runa v2 sources (`ragnarok-hero/icons-runa-v2`, accepted by Pedro, decisions
 * log :359). Each stave is drawn on a 24-unit grid with square caps and mitred joins.
 */
const staves = {
  "circle-x": "M12 2.5L21.5 12L12 21.5L2.5 12ZM9 9L15 15M15 9L9 15",
  "triangle-alert": "M12 3L22 20H2ZM12 9V13.5M12 17V17.5",
  "rotate-ccw": "M4.5 9L12 3L21 12L12 21L4.5 13.5M4.5 4.5V9H9",
  check: "M4.5 12L9.5 17L19.5 7",
  lock: "M5 11H19V21H5ZM8 11V6L10 4H14L16 6V11",
  info: "M12 2.5L21.5 12L12 21.5L2.5 12ZM12 7V7.5M10.5 11H12V17H13.5",
  "circle-help": "M12 2.5L21.5 12L12 21.5L2.5 12ZM8.5 9L12 6.5L15.5 9V10.5L12 13V14M12 17V17.5",
} as const;

export type RunaIconName = keyof typeof staves;

/** A decorative Runa icon: hidden from assistive technology and never focusable. */
export function RunaIcon(props: Readonly<{ name: RunaIconName; className?: string | undefined }>) {
  return (
    <svg
      className={props.className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <path d={staves[props.name]} />
    </svg>
  );
}
