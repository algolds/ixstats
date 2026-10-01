import { Building, Globe } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Stat } from "~/components/ui/stat";
import { createUrl } from "~/lib/utils";
import { cn } from "~/lib/utils/cn";
import type { ProfileWorld } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { rankLabel, relationshipBadge } from "./labels";

function FlagDot({ src, name }: { src: string | null; name: string }) {
  if (!src) {
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
      src={src}
      alt=""
      loading="lazy"
      className="border-separator size-7 rounded-full border object-cover"
    />
  );
}

/**
 * World Census standing (mycountry.getRankings): value + rank per category. The census ranks a
 * nation within its realm, so the hint names the realm.
 */
export function RankingGrid({
  rankings,
  realm,
  limit,
  className,
}: {
  rankings: ProfileWorld["rankings"];
  /** The realm the census ranks the nation in. */
  realm?: string | null;
  limit?: number;
  className?: string;
}) {
  const shown = limit ? rankings.slice(0, limit) : rankings;
  if (shown.length === 0) return null;
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3", className)}>
      {shown.map((r) => (
        <div key={r.category}>
          <dt className="sr-only">{r.category}</dt>
          <dd>
            <Stat
              size="sm"
              label={r.category}
              value={r.value}
              hint={rankLabel(r.rank, r.total, realm)}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Bilateral relations (diplomaticCore.getRelationships), strongest first. */
export function RelationRows({
  relations,
  limit,
  header = "Relations",
  footer,
}: {
  relations: ProfileWorld["relations"];
  limit?: number;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const shown = limit ? relations.slice(0, limit) : relations;
  if (shown.length === 0) return null;
  return (
    <FacetListSection header={header} footer={footer}>
      {shown.map((r) => {
        const badge = relationshipBadge(r.relationship);
        return (
          <FacetRow
            key={r.id}
            leading={<FlagDot src={r.flagUrl} name={r.name} />}
            title={r.name}
            subtitle={
              r.treaties.length > 0
                ? `${r.treaties.length} ${r.treaties.length === 1 ? "treaty" : "treaties"} · strength ${Math.round(r.strength)}`
                : `Strength ${Math.round(r.strength)}`
            }
            trailing={<Badge variant={badge.variant}>{badge.label}</Badge>}
            href={createUrl(`/countries/${encodeURIComponent(r.countryId)}`)}
          />
        );
      })}
    </FacetListSection>
  );
}

/** Embassies hosted and held abroad (diplomaticEmbassies.getEmbassies); budgets are not shown. */
export function EmbassyRows({
  embassies,
  limit,
  header = "Embassies",
}: {
  embassies: ProfileWorld["embassies"];
  limit?: number;
  header?: React.ReactNode;
}) {
  const shown = limit ? embassies.slice(0, limit) : embassies;
  if (shown.length === 0) return null;
  return (
    <FacetListSection header={header}>
      {shown.map((e) => (
        <FacetRow
          key={e.id}
          leading={<FlagDot src={e.flagUrl} name={e.countryName} />}
          title={e.countryName}
          subtitle={e.role === "host" ? "Their embassy here" : "Our embassy there"}
          trailing={
            <span className="text-footnote text-label-secondary inline-flex items-center gap-1 tabular-nums">
              {e.role === "host" ? (
                <Building aria-hidden className="size-3.5" />
              ) : (
                <Globe aria-hidden className="size-3.5" />
              )}
              {e.level != null ? `Level ${e.level}` : e.status}
            </span>
          }
          href={
            e.countrySlug ? createUrl(`/countries/${encodeURIComponent(e.countrySlug)}`) : undefined
          }
        />
      ))}
    </FacetListSection>
  );
}
