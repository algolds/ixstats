import { useId, type SVGProps } from "react";
import { cn } from "~/lib/utils/cn";

/** The BNB glyph from DominicTobias/ccy-icons; CurrencyIcon's ccy set reads it from here. */
export const BNB_GLYPH = {
  viewBox: "0 0 384 381",
  path: "M117.512 159.61l73.765-73.762 73.801 73.8L308 116.727 191.277 0 74.594 116.688zm-73.23-12.618l42.917 42.918-42.918 42.918L1.36 189.91zm73.23 73.23l73.765 73.762 73.801-73.796 42.945 42.898-116.746 116.746L74.59 263.148l-.063-.058zm263.687-30.292l-42.918 42.922-42.926-42.918 42.922-42.926zm0 0M234.813 189.895h.019l-43.555-43.555-32.187 32.187h-.004l-3.695 3.7-7.688 7.687.059.063 43.515 43.515 43.555-43.554.02-.024zm0 0",
};

/** A portrait collectible card, 14 × 20 with rounded corners. */
const CARD =
  "M7.5 2h9A2.5 2.5 0 0 1 19 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 19.5v-15A2.5 2.5 0 0 1 7.5 2Z";

/**
 * The Vault mark: a solid collectible card with the ccy-icons BNB glyph cut out of it, for the Vault's
 * cards and IxCredits. Solid with a cut-out like the Realms and Maps marks, in the row's tint
 * (`currentColor`). It lives in `src/lib` so the navigation map (which must not import from components)
 * can use it. Decorative by default; the app row carries the label. Each instance gets its own mask id.
 */
export function VaultLogomark({ className, ...props }: SVGProps<SVGSVGElement>) {
  const maskId = `vault-mark-${useId()}`;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("size-[1em] shrink-0", className)}
      {...props}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <svg x="7.5" y="6.5" width="9" height="11" viewBox={BNB_GLYPH.viewBox}>
            <path d={BNB_GLYPH.path} fill="black" />
          </svg>
        </mask>
      </defs>
      <path
        d={CARD}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
