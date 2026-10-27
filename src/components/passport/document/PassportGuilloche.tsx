import { guillochePaths } from "~/lib/passport/guilloche";
import { cn } from "~/lib/utils";

const VIEW_WIDTH = 1200;
const VIEW_HEIGHT = 630;
const PATHS = guillochePaths(VIEW_WIDTH, VIEW_HEIGHT);

/**
 * Hairline security-print rosettes behind the passport's front face, in the page tint at very low
 * opacity. Decorative only; dropped under Increase Contrast.
 */
export function PassportGuilloche({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.75}
      className={cn(
        "text-tint pointer-events-none absolute inset-0 h-full w-full opacity-10 select-none contrast-more:hidden",
        className
      )}
    >
      {PATHS.map((d, i) => (
        <path key={i} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
