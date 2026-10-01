import { Bank, Community, GraduationCap, City, Suitcase } from "iconoir-react";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils/cn";
import { facetAccentStyle, type FacetAccent } from "~/lib/design/identity";
import type { ConditionKey, ConditionPillar } from "./derive";

const ICON: Record<ConditionKey, typeof Bank> = {
  employment: Suitcase,
  approval: Community,
  stability: Bank,
  literacy: GraduationCap,
  urban: City,
};

/**
 * The concept's per-pillar hue (Macro sky, Demographics emerald, Institutions amber…), as system
 * colour roles. It re-tints the tile: icon chip, figure, meter and the category radiance wash.
 */
const HUE: Record<ConditionKey, FacetAccent> = {
  employment: "blue",
  approval: "green",
  stability: "yellow",
  literacy: "indigo",
  urban: "purple",
};

/**
 * ConditionMatrix — the Sovereign Command OS "national condition" grid on real readings: one
 * tile per domain for each 0–100 figure the nation has (employment, approval, stability,
 * literacy, urbanisation), with a meter and the reading as text. Opaque inset tiles inside the
 * parent card; renders nothing with fewer than two pillars.
 */
export function ConditionMatrix({
  pillars,
  className,
}: {
  pillars: readonly ConditionPillar[];
  className?: string;
}) {
  if (pillars.length < 2) return null;
  return (
    <ul className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {pillars.map((p) => {
        const Icon = ICON[p.key];
        return (
          <li
            key={p.key}
            style={facetAccentStyle(HUE[p.key])}
            className="facet-retint bg-surface-secondary border-separator hover:border-facet-accent/40 rounded-row duration-fast ease-out-facet relative isolate flex flex-col gap-3 overflow-hidden border p-4 transition-colors"
          >
            {/* Concept tile wash (`from-<hue>/20 to-<hue>/5`): the sanctioned category radiance. */}
            <span
              aria-hidden
              data-interactive="true"
              className="facet-radiance absolute inset-0 -z-10 rounded-[inherit]"
            />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="bg-facet-accent-fill text-facet-accent border-facet-accent/20 rounded-control-sm flex size-8 shrink-0 items-center justify-center border"
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-headline text-label truncate">{p.label}</p>
                  <p className="text-footnote text-label-secondary">{p.area}</p>
                </div>
              </div>
              <span className="text-title-3 text-label font-data tabular-nums">{p.display}</span>
            </div>
            <Progress value={p.value} aria-hidden className="h-1.5" />
            {p.detail && <p className="text-footnote text-label-secondary">{p.detail}</p>}
          </li>
        );
      })}
    </ul>
  );
}
