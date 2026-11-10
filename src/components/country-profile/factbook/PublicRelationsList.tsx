"use client";

import { useState } from "react";
import { Globe } from "iconoir-react";
import type { ProfileWorld } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { FlagImage } from "~/components/ui/facet/identity/FlagImage";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { relationshipBadge } from "../labels";

const FLAG_DOT_CLASS = "border-separator size-7 rounded-full border object-cover";
const FLAG_DOT_MONOGRAM_CLASS =
  "bg-fill-3 text-caption text-label-secondary flex size-7 items-center justify-center rounded-full";

type ForeignFilter = "all" | "relations" | "embassies";

/**
 * PublicRelationsList — the Foreign affairs sheet: every bilateral relation (strongest first,
 * with its standing, strength and treaties) and every embassy hosted or held abroad. Public
 * record only.
 */
export function PublicRelationsList({
  world,
}: {
  world: Pick<ProfileWorld, "relations" | "embassies">;
}) {
  const [filter, setFilter] = useState<ForeignFilter>("all");
  if (world.relations.length === 0 && world.embassies.length === 0) {
    return <EmptyState icon={<Globe />} title="No foreign relations yet" />;
  }
  const relations = [...world.relations].sort((a, b) => b.strength - a.strength);
  const hasBoth = relations.length > 0 && world.embassies.length > 0;
  const showRelations = filter === "all" || filter === "relations";
  const showEmbassies = filter === "all" || filter === "embassies";

  return (
    <div className="flex flex-col gap-4">
      {hasBoth && (
        <div>
          <SegmentedControl
            size="sm"
            aria-label="Filter foreign affairs"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "relations", label: `Relations · ${relations.length}` },
              { value: "embassies", label: `Embassies · ${world.embassies.length}` },
            ]}
          />
        </div>
      )}
      <FacetList>
        {showRelations && relations.length > 0 && (
          <FacetListSection header="Relations">
            {relations.map((r) => {
              const badge = relationshipBadge(r.relationship);
              const pct = Math.max(0, Math.min(100, Math.round(r.strength)));
              const treatySummary =
                r.treaties.length > 0
                  ? `${r.treaties.length} ${r.treaties.length === 1 ? "treaty" : "treaties"} · ${pct}% strength`
                  : `${pct}% strength`;
              return (
                <FacetRow
                  key={r.id}
                  leading={
                    <FlagImage
                      src={r.flagUrl}
                      name={r.name}
                      className={FLAG_DOT_CLASS}
                      monogramClassName={FLAG_DOT_MONOGRAM_CLASS}
                    />
                  }
                  title={r.name}
                  subtitle={treatySummary}
                  trailing={<Badge variant={badge.variant}>{badge.label}</Badge>}
                />
              );
            })}
          </FacetListSection>
        )}
        {showEmbassies && world.embassies.length > 0 && (
          <FacetListSection header="Embassies">
            {world.embassies.map((e) => (
              <FacetRow
                key={e.id}
                leading={
                  <FlagImage
                    src={e.flagUrl}
                    name={e.countryName}
                    className={FLAG_DOT_CLASS}
                    monogramClassName={FLAG_DOT_MONOGRAM_CLASS}
                  />
                }
                title={e.countryName}
                subtitle={e.role === "host" ? "Their embassy here" : "Our embassy there"}
                trailing={e.level != null ? `Level ${e.level}` : e.status}
                href={e.countrySlug ? `/countries/${encodeURIComponent(e.countrySlug)}` : undefined}
              />
            ))}
          </FacetListSection>
        )}
      </FacetList>
    </div>
  );
}
