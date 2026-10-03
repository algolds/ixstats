import { Bank, Community, GraduationCap, City, Suitcase } from "iconoir-react";
import { Progress } from "~/components/ui/progress";
import { cn } from "~/lib/utils/cn";
import type { ConditionKey, ConditionPillar } from "./derive";

const ICON: Record<ConditionKey, typeof Bank> = {
  employment: Suitcase,
  approval: Community,
  stability: Bank,
  literacy: GraduationCap,
  urban: City,
};

/**
 * ConditionMatrix — the national condition grid on real readings: one tile per domain for each 0–100 figure the nation has (employment, approval, stability,
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
          <li key={p.key} className="bg-surface-secondary rounded-row flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="bg-fill-3 text-label-secondary rounded-control-sm flex size-8 shrink-0 items-center justify-center"
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-headline text-label truncate">{p.label}</p>
                  <p className="text-footnote text-label-secondary">{p.area}</p>
                </div>
              </div>
              <span className="text-title-3 text-label tabular-nums">{p.display}</span>
            </div>
            <Progress value={p.value} aria-hidden className="h-1.5" />
            {p.detail && <p className="text-footnote text-label-secondary">{p.detail}</p>}
          </li>
        );
      })}
    </ul>
  );
}
