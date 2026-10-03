/**
 * NationStates attribution + disclaimer
 *
 * Shown wherever NationStates-imported card data is displayed so users can
 * see where the data comes from and its licensing status.
 */
import { NationStatesLogo } from "./NationStatesLogo";
import { ShieldAlert } from "iconoir-react";
import { Button } from "~/components/ui/button";

export function NationStatesAttribution({
  className,
  onRequestTakedown,
}: {
  className?: string;
  onRequestTakedown?: () => void;
}) {
  return (
    <div
      className={`border-separator bg-surface text-label-secondary rounded-control text-footnote flex shrink-0 items-center justify-between gap-2 border px-3 py-2 leading-tight ${className ?? ""}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <NationStatesLogo size="xs" className="mt-0.5 shrink-0" />
        <p className="min-w-0 flex-1">
          Data via official{" "}
          <a
            href="https://www.nationstates.net/pages/api.html#cards"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue font-medium hover:underline"
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
          <Button
            variant="link"
            size="sm"
            onClick={onRequestTakedown}
            className="text-red h-auto shrink-0 gap-1 px-0"
          >
            <ShieldAlert className="h-3 w-3 shrink-0" />
            <span>Verify & request takedown</span>
          </Button>
        </>
      )}
    </div>
  );
}
