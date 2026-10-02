import { CheckCircle, TriangleFlag as Flag, Globe, MapPin, Page } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils/cn";
import type { ChronicleEntry, ChronicleKind } from "~/app/countries/[slug]/_utils/profileLayer";
import { CHRONICLE_KIND_LABEL } from "./labels";

const KIND_ICON: Record<ChronicleKind, typeof Flag> = {
  founding: Flag,
  story: MapPin,
  directive: Page,
  decision: CheckCircle,
  diplomacy: Globe,
};

/**
 * ChronicleTimeline — the merged timeline (wiki founding dates, map story pins, enacted
 * directives, resolved issues, diplomatic events) as an ordered list. `order="desc"` for feeds
 * (newest first), `"asc"` to read it as history.
 */
export function ChronicleTimeline({
  entries,
  order = "asc",
  limit,
  className,
}: {
  entries: readonly ChronicleEntry[];
  order?: "asc" | "desc";
  limit?: number;
  className?: string;
}) {
  const sorted = order === "asc" ? entries : [...entries].reverse();
  const shown = limit ? sorted.slice(0, limit) : sorted;
  return (
    <ol className={cn("relative flex flex-col", className)}>
      {shown.map((entry, index) => {
        const Icon = KIND_ICON[entry.kind];
        const last = index === shown.length - 1;
        return (
          <li
            key={entry.id}
            className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0"
          >
            {!last && (
              <span
                aria-hidden
                className="bg-separator absolute top-8 bottom-0 left-4 w-px -translate-x-1/2"
              />
            )}
            <span
              aria-hidden
              className="bg-surface-secondary border-separator text-label-secondary relative flex size-8 items-center justify-center rounded-full border"
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 pt-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-footnote text-label-secondary tabular-nums">
                  {entry.dateLabel}
                </span>
                <Badge variant={entry.source === "ixtime" ? "secondary" : "default"}>
                  {CHRONICLE_KIND_LABEL[entry.kind]}
                </Badge>
              </div>
              <p className="text-headline text-label mt-1">{entry.title}</p>
              {entry.detail && (
                <p className="text-callout text-label-secondary mt-0.5">{entry.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
