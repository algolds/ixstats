"use client";

import { useState } from "react";
import Link from "next/link";
import { Bank, Coins, Globe, NavArrowRight } from "iconoir-react";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatBig, formatPercent, formatRate } from "~/app/countries/[slug]/_utils/profileLayer";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { FlagImage } from "~/components/ui/facet/identity/FlagImage";
import { assetUrl } from "~/lib/base-path";
import { formatRealmDate } from "~/lib/realms/realm-clock";
import { electionDisplayName } from "~/lib/realms/realm-year";
import { cn } from "~/lib/utils/cn";
import { stripHtml } from "~/lib/utils/sanitize-html";
import { diplomaticMatrix, regionShares, stateLeaders } from "../derive";
import { relationshipBadge } from "../labels";
import { economyVitals } from "../vitals";
import { MapCrop } from "./MapCrop";
import { FactList, SnapshotBlock } from "./SnapshotBlock";

type BlockProps = { layer: CountryProfileLayer; onMore: () => void };
type RegionShareData = NonNullable<ReturnType<typeof regionShares>>;

/** Tint steps for the largest regions in the share bar, strongest first. */
const SHARE_FILLS = ["bg-tint", "bg-tint/75", "bg-tint/55", "bg-tint/40"] as const;

/** Stepped fills for parliamentary party composition segments. */
const PARTY_FILLS = ["bg-tint", "bg-info", "bg-success", "bg-warning", "bg-fill-2"] as const;

function buildSparklinePoints(history: readonly { year: number; gdp: number }[]): {
  polyline: string;
  area: string;
} {
  const values = history.map((h) => h.gdp);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 160;
  const height = 36;
  const pad = 3;
  const coords = history.map((point, index) => {
    const x =
      history.length === 1 ? width / 2 : (index / (history.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((point.gdp - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = coords.join(" ");
  const area = `${pad},${height} ${polyline} ${width - pad},${height}`;
  return { polyline, area };
}

function EconomyTrajectoryWell({ vitals }: { vitals: CountryProfileLayer["vitals"] }) {
  const hasPerCapita = vitals.gdpPerCapita != null;
  const hasSparkline = vitals.history.length >= 2;
  if (!hasPerCapita && !hasSparkline) return null;

  const first = vitals.history[0];
  const last = vitals.history[vitals.history.length - 1];
  const spark = hasSparkline ? buildSparklinePoints(vitals.history) : null;
  const secondaryRight =
    !spark && vitals.urbanShare != null
      ? { label: "Urbanization", value: `${formatPercent(vitals.urbanShare, 0)}` }
      : !spark && vitals.density != null
        ? { label: "Density", value: `${Math.round(vitals.density).toLocaleString("en-US")} / km²` }
        : null;

  return (
    <Card padding="sm" className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-caption text-label-secondary block">
          {hasPerCapita ? "GDP per capita" : "Historical output"}
        </span>
        <span className="text-headline text-label block tabular-nums">
          {hasPerCapita
            ? formatBig(vitals.gdpPerCapita, { currency: true })
            : last
              ? formatBig(last.gdp, { currency: true })
              : "–"}
        </span>
        {first && last && first.year !== last.year && (
          <span className="text-caption text-label-secondary block tabular-nums">
            {`${first.year} – ${last.year}`}
          </span>
        )}
      </div>
      {spark && first && last ? (
        <svg
          role="img"
          aria-label={`GDP trend from ${first.year} to ${last.year}`}
          viewBox="0 0 160 36"
          className="h-9 w-28 shrink-0 overflow-visible"
        >
          <polygon points={spark.area} fill="var(--tint)" fillOpacity="0.14" />
          <polyline
            fill="none"
            stroke="var(--tint)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={spark.polyline}
          />
        </svg>
      ) : (
        secondaryRight && (
          <div className="shrink-0 text-right">
            <span className="text-caption text-label-secondary block">{secondaryRight.label}</span>
            <span className="text-headline text-label block tabular-nums">
              {secondaryRight.value}
            </span>
          </div>
        )
      )}
    </Card>
  );
}

function RegionalPopulationWell({ shares }: { shares: RegionShareData }) {
  const [selection, setSelection] = useState<{ id: string; pinned: boolean } | null>(null);
  const selectedId = selection?.id ?? null;
  const active = shares.regions.find((r) => r.id === selectedId) ?? null;
  const clearUnpinned = () => setSelection((curr) => (curr?.pinned ? curr : null));

  return (
    <Card padding="sm" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-label-secondary">Regional concentration</span>
        <span className="text-caption text-label-secondary tabular-nums">
          {`${shares.topShare.toFixed(1)}% top ${shares.regions.length}`}
        </span>
      </div>
      <div
        className="rounded-control-sm flex h-3 gap-0.5 overflow-hidden"
        onMouseLeave={clearUnpinned}
        onBlur={clearUnpinned}
      >
        {shares.regions.map((r, i) => {
          const isSelected = r.id === selectedId;
          const preview = () =>
            setSelection((curr) =>
              curr?.pinned && curr.id === r.id ? curr : { id: r.id, pinned: false }
            );
          return (
            <button
              key={r.id}
              type="button"
              aria-label={r.name}
              aria-pressed={isSelected}
              onClick={() => setSelection({ id: r.id, pinned: true })}
              onMouseEnter={preview}
              onFocus={preview}
              style={{ width: `${Math.max(r.share, 6)}%` }}
              className={cn(
                SHARE_FILLS[i],
                "focus-visible:outline-tint h-full transition-opacity focus-visible:outline-2",
                selectedId && !isSelected && "opacity-55"
              )}
            />
          );
        })}
        <span aria-hidden className="bg-fill-3 flex-1" />
      </div>
      {active && (
        <p className="text-caption text-label font-medium tabular-nums">
          {`${active.name} · ${formatBig(active.population)} (${active.share.toFixed(1)}%)`}
        </p>
      )}
      <p className="text-caption text-label-secondary">
        {shares.regions.length} largest regions hold {shares.topShare.toFixed(1)}% of the people
      </p>
    </Card>
  );
}

export function EconomyBlock({ layer, onMore }: BlockProps) {
  const { vitals, land } = layer;
  const readings = economyVitals(vitals);
  const shares = regionShares(land.subdivisions, vitals.population);
  const topCities = land.cities.slice(0, 3);
  const empty = vitals.gdpTotal == null && readings.length === 0 && vitals.population == null;
  const growthBadge =
    vitals.gdpGrowth != null && vitals.gdpGrowth !== 0
      ? {
          label: formatRate(vitals.gdpGrowth),
          variant: (vitals.gdpGrowth > 0 ? "success" : "warning") as "success" | "warning",
        }
      : null;

  return (
    <SnapshotBlock
      title="Economy & people"
      icon={<Coins />}
      cover={layer.media?.sectionCovers.economy}
      fallbackMedia={layer.land.hasGeometry && <MapCrop kind="economy" layer={layer} />}
      onMore={onMore}
      headline={
        vitals.gdpTotal != null
          ? {
              value: formatBig(vitals.gdpTotal, { currency: true }),
              label: vitals.economicTier ? `GDP · ${vitals.economicTier.toLowerCase()}` : "GDP",
              badge: growthBadge,
            }
          : null
      }
    >
      {empty ? (
        <EmptyState compact icon={<Coins />} title="No economic data" />
      ) : (
        <>
          <EconomyTrajectoryWell vitals={vitals} />
          {shares && <RegionalPopulationWell shares={shares} />}
          {topCities.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {topCities.map((city) => (
                <Badge
                  key={city.id}
                  variant={city.isCapital ? "secondary" : "default"}
                  className="max-w-full truncate tabular-nums"
                >
                  <span className="truncate">{stripHtml(city.name)}</span>
                  {city.population != null && (
                    <span className="text-label-secondary">{`· ${formatBig(city.population)}`}</span>
                  )}
                </Badge>
              ))}
            </div>
          )}
          <FactList
            facts={[
              // Unemployment, literacy and population are in the hero (Country DNA meters, figures).
              ...readings
                .filter((r) => r.key !== "unemployment")
                .map((r) => ({ label: r.label, value: r.value })),
              {
                label: "Life expectancy",
                value:
                  vitals.lifeExpectancy != null ? `${vitals.lifeExpectancy.toFixed(1)} yrs` : null,
              },
              {
                label: "Debt / GDP",
                value: vitals.debtToGdp != null ? formatPercent(vitals.debtToGdp, 1) : null,
              },
            ]}
          />
        </>
      )}
    </SnapshotBlock>
  );
}

function LegislatureWell({
  legislatureName,
  election,
}: {
  legislatureName: string | null | undefined;
  election: NonNullable<CountryProfileLayer["state"]["election"]>;
}) {
  const parties = election.results.slice(0, 5);
  if (election.totalSeats <= 0 && parties.length === 0) return null;
  const partySeatSum = parties.reduce((sum, p) => sum + (p.seatsWon > 0 ? p.seatsWon : 0), 0);
  const totalSeats = Math.max(election.totalSeats, partySeatSum);

  return (
    <Card padding="sm" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-caption text-label-secondary truncate">
          {legislatureName ? stripHtml(legislatureName) : "Legislature composition"}
        </span>
        <div className="flex items-center gap-1.5">
          {totalSeats > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {`${totalSeats} seats`}
            </Badge>
          )}
          {election.turnout != null && (
            <span className="text-caption text-label-secondary tabular-nums">
              {`${formatPercent(election.turnout, 0)} turnout`}
            </span>
          )}
        </div>
      </div>

      {parties.length > 0 && (
        <>
          <div aria-hidden className="rounded-control-sm flex h-2.5 gap-0.5 overflow-hidden">
            {parties.map((p, index) => {
              const weight =
                totalSeats > 0 && p.seatsWon > 0
                  ? (p.seatsWon / totalSeats) * 100
                  : p.votePercentage > 0
                    ? p.votePercentage
                    : 100 / parties.length;
              return (
                <span
                  key={p.partyName}
                  style={{ width: `${Math.max(weight, 5)}%` }}
                  className={PARTY_FILLS[index % PARTY_FILLS.length]}
                />
              );
            })}
          </div>
          <ul
            className={cn(
              "grid gap-x-3 gap-y-1",
              parties.length > 1 ? "grid-cols-2" : "grid-cols-1"
            )}
          >
            {parties.map((p, index) => (
              <li
                key={p.partyName}
                className="text-caption flex min-w-0 items-center justify-between gap-1.5"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      PARTY_FILLS[index % PARTY_FILLS.length]
                    )}
                  />
                  <span className="text-label truncate">{stripHtml(p.partyName)}</span>
                </span>
                <span className="text-label-secondary shrink-0 tabular-nums">
                  {p.seatsWon > 0 ? p.seatsWon : `${p.votePercentage.toFixed(0)}%`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function StateBlock({ layer, onMore }: BlockProps) {
  const { state, identity } = layer;
  const g = state.government;
  const e = state.election;
  const offices = stateLeaders(state, identity);
  const system = g?.type ?? identity.governmentType;
  const departments = g?.departments ?? [];
  const portraitUrl = assetUrl(layer.media?.leaderPortraitUrl);
  const [failedPortrait, setFailedPortrait] = useState<string | null>(null);
  const showPortrait = Boolean(portraitUrl && failedPortrait !== portraitUrl);
  const next = e?.upcomingName
    ? [
        electionDisplayName(e.upcomingName, e.upcomingIxTime, layer.clock.calendar),
        e.upcomingIxTime != null ? formatRealmDate(e.upcomingIxTime, layer.clock.calendar) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  return (
    <SnapshotBlock
      title="State"
      icon={<Bank />}
      cover={layer.media?.sectionCovers.state}
      fallbackMedia={layer.land.hasGeometry && <MapCrop kind="state" layer={layer} />}
      onMore={onMore}
      headline={system ? { value: stripHtml(system), label: "System of government" } : null}
    >
      {!g && offices.length === 0 ? (
        <EmptyState compact icon={<Bank />} title="No public record yet" />
      ) : (
        <>
          {e && <LegislatureWell legislatureName={g?.legislature} election={e} />}
          {offices.length > 0 && (
            <Card padding="sm" className="flex items-center justify-between gap-3">
              <ol className="border-tint/40 flex min-w-0 flex-col gap-2 border-l-2 pl-3">
                {offices.map((o) => (
                  <li key={`${o.role}-${o.name}`} className="flex min-w-0 flex-col">
                    <span className="text-caption text-label-secondary truncate">
                      {stripHtml(o.role)}
                    </span>
                    <span className="text-headline text-label truncate">{stripHtml(o.name)}</span>
                  </li>
                ))}
              </ol>
              {showPortrait && portraitUrl && (
                // oxlint-disable-next-line nextjs/no-img-element -- remote leader portrait
                <img
                  src={portraitUrl}
                  alt={`${identity.name} leadership portrait`}
                  loading="lazy"
                  onError={() => setFailedPortrait(portraitUrl)}
                  className="border-separator bg-fill-4 rounded-control size-14 shrink-0 border object-cover"
                />
              )}
            </Card>
          )}
          {departments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {departments.slice(0, 5).map((dept) => (
                <Badge key={dept} variant="default" className="max-w-full truncate">
                  {stripHtml(dept)}
                </Badge>
              ))}
              {departments.length > 5 && (
                <span className="text-caption text-label-secondary tabular-nums">
                  {`+${departments.length - 5} more`}
                </span>
              )}
            </div>
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

const FLAG_AVATAR_CLASS = "border-separator h-5 w-7 shrink-0 rounded-xs border object-cover";
const FLAG_AVATAR_MONOGRAM_CLASS =
  "bg-fill-3 text-caption text-label-secondary flex h-5 w-7 shrink-0 items-center justify-center rounded-xs font-medium";

export function ForeignBlock({ layer, onMore }: BlockProps) {
  const m = diplomaticMatrix(layer.world);
  const embassies = m.embassiesHosted + m.embassiesAbroad;
  const topRelations = [...layer.world.relations]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 4);
  const embassyLinks = layer.world.embassies.slice(0, 4);
  const empty = m.relationCount === 0 && embassies === 0;

  return (
    <SnapshotBlock
      title="Foreign affairs"
      icon={<Globe />}
      cover={layer.media?.sectionCovers.foreign}
      fallbackMedia={layer.land.hasGeometry && <MapCrop kind="foreign" layer={layer} />}
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
          {topRelations.length > 0 && (
            <Card padding="sm" className="flex flex-col gap-2">
              <span className="text-caption text-label-secondary">Bilateral ties</span>
              <ul className="flex flex-col gap-2">
                {topRelations.map((r) => {
                  const badge = relationshipBadge(r.relationship);
                  const pct = Math.max(8, Math.min(100, Math.round(r.strength)));
                  return (
                    <li key={r.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <FlagImage
                            src={r.flagUrl}
                            name={r.name}
                            className={FLAG_AVATAR_CLASS}
                            monogramClassName={FLAG_AVATAR_MONOGRAM_CLASS}
                          />
                          <span className="text-footnote text-label truncate font-medium">
                            {r.name}
                          </span>
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {r.treaties.length > 0 && (
                            <span className="text-caption text-label-secondary tabular-nums">
                              {`${r.treaties.length} ${r.treaties.length === 1 ? "treaty" : "treaties"}`}
                            </span>
                          )}
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                      </div>
                      <div
                        aria-hidden
                        className="bg-fill-3 rounded-control-sm h-1 w-full overflow-hidden"
                      >
                        <div className="bg-tint h-full" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {embassyLinks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {embassyLinks.map((emb) => {
                const content = (
                  <>
                    <FlagImage
                      src={emb.flagUrl}
                      name={emb.countryName}
                      className={FLAG_AVATAR_CLASS}
                      monogramClassName={FLAG_AVATAR_MONOGRAM_CLASS}
                    />
                    <span className="text-caption text-label truncate font-medium">
                      {emb.countryName}
                    </span>
                    <span className="text-caption text-label-secondary">
                      {emb.role === "host" ? "Hosted" : "Abroad"}
                    </span>
                    {emb.countrySlug && (
                      <NavArrowRight aria-hidden className="text-label-tertiary size-3 shrink-0" />
                    )}
                  </>
                );
                return emb.countrySlug ? (
                  <Link
                    key={emb.id}
                    href={`/countries/${encodeURIComponent(emb.countrySlug)}`}
                    className="facet-well facet-press facet-press-subtle focus-visible:outline-tint rounded-control-sm inline-flex max-w-full items-center gap-1.5 px-2.5 py-1 focus-visible:outline-2"
                  >
                    {content}
                  </Link>
                ) : (
                  <span
                    key={emb.id}
                    className="facet-well rounded-control-sm inline-flex max-w-full items-center gap-1.5 px-2.5 py-1"
                  >
                    {content}
                  </span>
                );
              })}
            </div>
          )}

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
