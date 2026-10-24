import { NavArrowRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";

export interface Fact {
  label: string;
  /** Null drops the row; pass "–" to show an empty reading. */
  value: string | null;
}

/** A block's facts as plain rows; rows without a value are left out. */
export function FactList({ facts }: { facts: readonly Fact[] }) {
  const shown = facts.filter((f) => f.value);
  if (shown.length === 0) return null;
  return (
    <FacetList variant="plain">
      <FacetListSection>
        {shown.map((f) => (
          <FacetRow key={f.label} title={f.label} trailing={f.value} />
        ))}
      </FacetListSection>
    </FacetList>
  );
}

/**
 * SnapshotBlock — one subject of the Factbook at a glance: its title, one headline figure, a
 * small visual and a few facts, with More opening the subject's full detail in a sheet.
 */
export function SnapshotBlock({
  title,
  headline,
  onMore,
  children,
}: {
  title: string;
  headline?: { value: string; label: string } | null;
  onMore: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card padding="md" className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-title-3 text-label">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onMore}>
          More
          <span className="sr-only"> about {title}</span>
          <NavArrowRight aria-hidden />
        </Button>
      </div>
      {headline && (
        <p className="flex flex-col gap-0.5">
          <span className="text-large-title text-tint tabular-nums">{headline.value}</span>
          <span className="text-footnote text-label-secondary">{headline.label}</span>
        </p>
      )}
      {children}
    </Card>
  );
}
