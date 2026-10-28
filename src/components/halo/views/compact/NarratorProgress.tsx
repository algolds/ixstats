interface NarratorProgressProps {
  /** 0-100. */
  value: number;
  color: string;
}

/**
 * Read-only narration progress under the compact Halo icons. A 2px line cannot be a
 * 44px touch target, so scrubbing lives in the narrator view's transport instead.
 */
export function NarratorProgress({ value, color }: NarratorProgressProps) {
  return (
    <div
      role="progressbar"
      aria-label="Narration progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="bg-fill-2 mt-0.5 h-0.5 w-full overflow-hidden rounded-full"
    >
      <div
        className="duration-fast h-full rounded-full transition-[width]"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  );
}
