import { Bank, Coins, Globe } from "iconoir-react";
import { EmptyState } from "~/components/ui/empty-state";
import { cn } from "~/lib/utils/cn";
import { stripHtml } from "~/lib/utils/sanitize-html";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatBig, formatRate } from "~/app/countries/[slug]/_utils/profileLayer";
import { formatRealmDate } from "~/lib/realms/realm-clock";
import type { BadgeVariant } from "~/components/ui/badge";
import { diplomaticMatrix, regionShares, relationNodes, stateLeaders } from "../derive";
import { economyVitals } from "../vitals";
import { FactList, SnapshotBlock } from "./SnapshotBlock";

type BlockProps = { layer: CountryProfileLayer; onMore: () => void };

const plain = (value: string | null | undefined) => (value ? stripHtml(value) : null);

/** Tint steps for the largest regions in the share bar, strongest first. */
const SHARE_FILLS = ["bg-tint", "bg-tint/75", "bg-tint/55", "bg-tint/40"] as const;

export function EconomyBlock({ layer, onMore }: BlockProps) {
  const { vitals, identity, land } = layer;
  const readings = economyVitals(vitals);
  const shares = regionShares(land.subdivisions, vitals.population);
  const empty = vitals.gdpTotal == null && readings.length === 0 && vitals.population == null;
  return (
    <SnapshotBlock
      title="Economy & people"
      onMore={onMore}
      headline={
        vitals.gdpTotal != null
          ? {
              value: formatBig(vitals.gdpTotal, { currency: true }),
              label: vitals.economicTier ? `GDP · ${vitals.economicTier.toLowerCase()}` : "GDP",
            }
          : null
      }
    >
      {empty ? (
        <EmptyState compact icon={<Coins />} title="No economic data" />
      ) : (
        <>
          {shares && (
            <div className="flex flex-col gap-1.5">
              <div aria-hidden className="rounded-control-sm flex h-2.5 gap-0.5 overflow-hidden">
                {shares.regions.map((r, i) => (
                  <span key={r.id} className={SHARE_FILLS[i]} style={{ width: `${r.share}%` }} />
                ))}
                <span className="bg-fill-3 flex-1" />
              </div>
              <p className="text-caption text-label-secondary">
                {shares.regions.length} largest regions hold {shares.topShare.toFixed(1)}% of the
                people
              </p>
            </div>
          )}
          <FactList
            facts={[
              ...readings.map((r) => ({ label: r.label, value: r.value })),
              {
                label: "Population",
                value:
                  vitals.population != null
                    ? [
                        formatBig(vitals.population),
                        vitals.populationGrowth != null && formatRate(vitals.populationGrowth),
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : null,
              },
              { label: "Demonym", value: plain(identity.demonym) },
              { label: "Languages", value: plain(identity.languages) },
            ]}
          />
        </>
      )}
    </SnapshotBlock>
  );
}

export function StateBlock({ layer, onMore }: BlockProps) {
  const { state, identity } = layer;
  const g = state.government;
  const e = state.election;
  const offices = stateLeaders(state, identity);
  const system = g?.type ?? identity.governmentType;
  const next = e?.upcomingName
    ? [
        e.upcomingName,
        e.upcomingIxTime != null ? formatRealmDate(e.upcomingIxTime, layer.clock.calendar) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  return (
    <SnapshotBlock
      title="State"
      onMore={onMore}
      headline={system ? { value: stripHtml(system), label: "System of government" } : null}
    >
      {!g && offices.length === 0 ? (
        <EmptyState compact icon={<Bank />} title="No public record yet" />
      ) : (
        <>
          {offices.length > 0 && (
            <ol className="border-tint/40 flex flex-col gap-2 border-l-2 pl-3">
              {offices.map((o) => (
                <li key={`${o.role}-${o.name}`} className="flex flex-col">
                  <span className="text-caption text-label-secondary">{stripHtml(o.role)}</span>
                  <span className="text-headline text-label">{stripHtml(o.name)}</span>
                </li>
              ))}
            </ol>
          )}
          <FactList
            facts={[
              { label: "Legislature", value: g?.legislature ?? "–" },
              { label: "Judiciary", value: g?.judiciary ?? "–" },
              { label: "Next election", value: next ?? "–" },
            ]}
          />
        </>
      )}
    </SnapshotBlock>
  );
}

const TONE: Partial<Record<BadgeVariant, string>> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function ForeignBlock({ layer, onMore }: BlockProps) {
  const m = diplomaticMatrix(layer.world);
  const embassies = m.embassiesHosted + m.embassiesAbroad;
  const nodes = relationNodes(layer.world).slice(0, 4);
  const empty = m.relationCount === 0 && embassies === 0;
  return (
    <SnapshotBlock
      title="Foreign affairs"
      onMore={onMore}
      headline={
        empty
          ? null
          : embassies > 0
            ? {
                value: `${embassies} ${embassies === 1 ? "embassy" : "embassies"}`,
                label: `${m.embassiesHosted} hosted here, ${m.embassiesAbroad} abroad`,
              }
            : { value: String(m.relationCount), label: "Foreign relations" }
      }
    >
      {empty ? (
        <EmptyState compact icon={<Globe />} title="No foreign relations yet" />
      ) : (
        <>
          <ul className="flex flex-wrap gap-1.5">
            {nodes.map((n) => (
              <li
                key={n.id}
                className="bg-surface border-separator rounded-control-sm flex min-w-0 flex-col border px-2.5 py-1.5"
              >
                <span className="text-footnote text-label truncate font-medium">{n.name}</span>
                <span
                  className={cn(
                    "text-caption",
                    (n.variant && TONE[n.variant]) ?? "text-label-secondary"
                  )}
                >
                  {n.detail}
                </span>
              </li>
            ))}
          </ul>
          <FactList
            facts={[
              { label: "Relations", value: String(m.relationCount) },
              { label: "Partners", value: String(m.partners.length) },
              { label: "Tensions", value: String(m.tensions.length) },
              { label: "Treaties", value: String(m.treatyCount) },
            ]}
          />
        </>
      )}
    </SnapshotBlock>
  );
}
