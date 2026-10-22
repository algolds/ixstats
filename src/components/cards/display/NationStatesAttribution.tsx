/**
 * NationStates attribution + disclaimer
 *
 * Shown wherever NationStates-imported card data is displayed so users can
 * see where the data comes from and its licensing status.
 */
import { NationStatesLogo } from "./NationStatesLogo";

/** The attribution every surface with NationStates card data shows: the data's source and the disclaimer. */
export function NationStatesDataCredit({ linkClassName }: { linkClassName?: string }) {
  return (
    <>
      Data via official{" "}
      <a
        href="https://www.nationstates.net/pages/api.html#cards"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        NationStates API
      </a>
      . Not affiliated with or endorsed by NationStates. All artwork, flags, and logos remain the
      copyright of their respective owners.
    </>
  );
}

/** The boxed credit, with NationStates' logo, for the NationStates import and its takedown form. */
export function NationStatesAttribution({ className }: { className?: string }) {
  return (
    <div
      className={`border-separator bg-surface text-label-secondary rounded-control text-footnote flex shrink-0 items-center justify-between gap-2 border px-3 py-2 leading-tight ${className ?? ""}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <NationStatesLogo size="xs" className="mt-0.5 shrink-0" />
        <p className="min-w-0 flex-1">
          <NationStatesDataCredit linkClassName="text-blue font-medium hover:underline" />
        </p>
      </div>
    </div>
  );
}
