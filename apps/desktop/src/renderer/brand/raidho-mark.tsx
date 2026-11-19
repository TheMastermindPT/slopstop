/**
 * The Raidho rune, the Ragnarok mark (`ragnarok-hero/icons/rune.svg`). It strokes with the current
 * colour and is decorative: hidden from assistive technology and never focused.
 */
export function RaidhoMark({ className }: Readonly<{ className?: string | undefined }>) {
  return (
    <svg
      className={className}
      viewBox="-1.5 -1.5 10 19"
      width={11}
      height={21}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <path d="M 0 0 L 0 16 M 0 0 L 7 4 L 0 8 L 7 16" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
