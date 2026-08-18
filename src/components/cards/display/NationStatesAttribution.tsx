/**
 * NationStates attribution + disclaimer
 *
 * Shown wherever NationStates-imported card data is displayed so users can
 * see where the data comes from and its licensing status.
 */
import { NationStatesLogo } from "./NationStatesLogo";
import { ShieldAlert } from "lucide-react";

export function NationStatesAttribution({
  className,
  onRequestTakedown,
}: {
  className?: string;
  onRequestTakedown?: () => void;
}) {
  return (
    <div
      className={`border-border/40 bg-card/40 text-muted-foreground flex shrink-0 items-center justify-between gap-2.5 rounded-lg border px-2.5 py-1.5 text-[10px] leading-tight backdrop-blur-sm ${className ?? ""}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-1.5">
        <NationStatesLogo size="xs" className="mt-0.5 shrink-0" />
        <p className="min-w-0 flex-1">
          Data via official{" "}
          <a
            href="https://www.nationstates.net/pages/api.html#cards"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            NationStates API
          </a>
          . Not affiliated with or endorsed by NationStates. All artwork, flags, and logos remain
          the copyright of their respective owners.
        </p>
      </div>

      {onRequestTakedown && (
        <>
          <div className="bg-border/60 h-4 w-px shrink-0" />
          <button
            type="button"
            onClick={onRequestTakedown}
            className="inline-flex shrink-0 items-center gap-1 font-medium text-rose-500 transition-colors hover:text-rose-600 hover:underline dark:text-rose-400 dark:hover:text-rose-300"
          >
            <ShieldAlert className="h-3 w-3 shrink-0" />
            <span>Verify & Request Takedown</span>
          </button>
        </>
      )}
    </div>
  );
}
