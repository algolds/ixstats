import { useState } from "react";
import { assetUrl } from "~/lib/base-path";
import { Globe } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import type { ProfileWorld } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { relationshipBadge } from "../labels";

function FlagDot({ src, name }: { src: string | null; name: string }) {
  const resolved = assetUrl(src);
  const [failed, setFailed] = useState<string | null>(null);
  if (!resolved || failed === resolved) {
    return (
      <span
        aria-hidden
        className="bg-fill-3 text-caption text-label-secondary flex size-7 items-center justify-center rounded-full"
      >
        {name.charAt(0)}
      </span>
    );
  }
  return (
    // oxlint-disable-next-line nextjs/no-img-element -- remote flag thumbnail
    <img
      src={resolved}
      alt=""
      loading="lazy"
      onError={() => setFailed(resolved)}
      className="border-separator size-7 rounded-full border object-cover"
    />
  );
}

/**
 * PublicRelationsList — the Foreign affairs sheet: every bilateral relation (strongest first,
 * with its standing and treaties) and every embassy hosted or held abroad. Public record only.
 */
export function PublicRelationsList({
  world,
}: {
  world: Pick<ProfileWorld, "relations" | "embassies">;
}) {
  if (world.relations.length === 0 && world.embassies.length === 0) {
    return <EmptyState icon={<Globe />} title="No foreign relations yet" />;
  }
  const relations = [...world.relations].sort((a, b) => b.strength - a.strength);
  return (
    <FacetList>
      {relations.length > 0 && (
        <FacetListSection header="Relations">
          {relations.map((r) => {
            const badge = relationshipBadge(r.relationship);
            return (
              <FacetRow
                key={r.id}
                leading={<FlagDot src={r.flagUrl} name={r.name} />}
                title={r.name}
                subtitle={
                  r.treaties.length > 0
                    ? `${r.treaties.length} ${r.treaties.length === 1 ? "treaty" : "treaties"}`
                    : undefined
                }
                trailing={<Badge variant={badge.variant}>{badge.label}</Badge>}
              />
            );
          })}
        </FacetListSection>
      )}
      {world.embassies.length > 0 && (
        <FacetListSection header="Embassies">
          {world.embassies.map((e) => (
            <FacetRow
              key={e.id}
              leading={<FlagDot src={e.flagUrl} name={e.countryName} />}
              title={e.countryName}
              subtitle={e.role === "host" ? "Their embassy here" : "Our embassy there"}
              trailing={e.level != null ? `Level ${e.level}` : e.status}
              href={e.countrySlug ? `/countries/${encodeURIComponent(e.countrySlug)}` : undefined}
            />
          ))}
        </FacetListSection>
      )}
    </FacetList>
  );
}
