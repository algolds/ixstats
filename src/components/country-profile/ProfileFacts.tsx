import { Bank, Group, Map as MapIcon, MapPin, Leaf as Mountain, Pin } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Stat } from "~/components/ui/stat";
import { cn } from "~/lib/utils/cn";
import { stripHtml } from "~/lib/utils/sanitize-html";
import type {
  ProfileIdentity,
  ProfileLand,
  ProfileState,
} from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { formatBig, formatIxDate } from "~/app/countries/[slug]/_utils/profileLayer";
import type { VitalStat } from "./vitals";

/** A responsive grid of `Stat`s (definition list for assistive tech). */
export function StatGrid({
  stats,
  className,
  columns = "grid-cols-2 sm:grid-cols-3",
}: {
  stats: readonly VitalStat[];
  className?: string;
  columns?: string;
}) {
  if (stats.length === 0) return null;
  return (
    <dl className={cn("grid gap-x-6 gap-y-5", columns, className)}>
      {stats.map((s) => (
        <div key={s.key}>
          <dt className="sr-only">{s.label}</dt>
          <dd>
            <Stat size="sm" label={s.label} value={s.value} hint={s.hint} delta={s.delta} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Identity facts (national identity record, then the wiki infobox). */
export function IdentityRows({
  identity,
  header = "Identity",
}: {
  identity: ProfileIdentity;
  header?: React.ReactNode;
}) {
  const rows: [string, string | null][] = [
    ["Official name", identity.officialName],
    ["Capital", identity.capital],
    ["Government", identity.governmentType],
    ["Languages", identity.languages],
    ["Currency", identity.currency],
    ["Demonym", identity.demonym],
    ["Anthem", identity.anthem],
  ];
  // Wiki infobox values can carry raw HTML (<div>, <br>…); these fields are plain text.
  const present = rows.flatMap(([label, value]): [string, string][] => {
    const text = value ? stripHtml(value) : "";
    return text ? [[label, text]] : [];
  });
  const leaders = identity.leaders;
  if (present.length === 0 && leaders.length === 0) return null;
  return (
    <FacetListSection header={header}>
      {present.map(([label, value]) => (
        <FacetRow key={label} title={label} trailing={value} />
      ))}
      {leaders.map((l) => (
        <FacetRow
          key={`${l.title}-${l.name}`}
          title={stripHtml(l.title)}
          trailing={stripHtml(l.name)}
        />
      ))}
    </FacetListSection>
  );
}

/** Territory facts from the geo bundle and geo profile. */
export function LandRows({
  land,
  header = "Territory",
}: {
  land: ProfileLand;
  header?: React.ReactNode;
}) {
  const p = land.profile;
  const neighbours = land.neighbors.length;
  const rows = [
    [
      Bank,
      "Capital",
      land.capital &&
        (land.capital.population
          ? `${land.capital.name} · ${formatBig(land.capital.population)}`
          : land.capital.name),
    ],
    [MapIcon, "Mapped area", land.areaSqKm && `${formatBig(land.areaSqKm)} km²`],
    [MapPin, "Coastline", p?.coastlineKm && `${formatBig(p.coastlineKm)} km`],
    [
      MapPin,
      "Setting",
      (p?.isLandlocked || p?.isIsland) && (p.isIsland ? "Island nation" : "Landlocked"),
    ],
    [Mountain, "Dominant climate", p?.dominantClimate],
    [Mountain, "Terrain", p?.dominantElevation],
    [Mountain, "Arable land", p?.arableLandPercent && `${p.arableLandPercent.toFixed(1)}%`],
    [
      Group,
      "Borders",
      neighbours > 0 && `${neighbours} ${neighbours === 1 ? "neighbour" : "neighbours"}`,
    ],
  ] as const;
  const present = rows.filter((row) => row[2]);
  if (present.length === 0) return null;
  return (
    <FacetListSection header={header}>
      {present.map(([Icon, title, value]) => (
        <FacetRow
          key={title}
          leading={<Icon aria-hidden className="text-label-secondary size-4" />}
          title={title}
          trailing={value}
        />
      ))}
    </FacetListSection>
  );
}

/** Principal cities and first-level regions. */
export function PlaceRows({ land, limit = 6 }: { land: ProfileLand; limit?: number }) {
  const cities = land.cities.slice(0, limit);
  const regions = land.subdivisions.slice(0, limit);
  return (
    <>
      {cities.length > 0 && (
        <FacetListSection header="Principal cities">
          {cities.map((c) => (
            <FacetRow
              key={c.id}
              title={c.name}
              subtitle={
                [c.isCapital && "National capital", c.isPort && "Port"]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
              trailing={c.population ? formatBig(c.population) : undefined}
            />
          ))}
        </FacetListSection>
      )}
      {regions.length > 0 && (
        <FacetListSection
          header="Regions"
          footer={
            land.subdivisions.length > limit
              ? `${land.subdivisions.length} regions in all.`
              : undefined
          }
        >
          {regions.map((s) => (
            <FacetRow
              key={s.id}
              title={s.name}
              subtitle={[s.type, s.capital && `seat: ${s.capital}`].filter(Boolean).join(" · ")}
              trailing={s.population ? formatBig(s.population) : undefined}
            />
          ))}
        </FacetListSection>
      )}
    </>
  );
}

/** Story pins placed on the map (map lore). */
export function StoryPinRows({ land, limit = 4 }: { land: ProfileLand; limit?: number }) {
  const pins = land.storyPins.slice(0, limit);
  if (pins.length === 0) return null;
  return (
    <FacetListSection header="Stories on the map">
      {pins.map((p) => (
        <FacetRow
          key={p.id}
          leading={<Pin aria-hidden className="text-label-secondary size-4" />}
          title={p.title}
          subtitle={p.excerpt ?? undefined}
          trailing={
            <span className="flex flex-col items-end gap-1">
              {(p.eraLabel || p.year != null) && (
                <span className="text-footnote tabular-nums">{p.eraLabel ?? p.year}</span>
              )}
              <Badge variant="default">{p.category}</Badge>
            </span>
          }
        />
      ))}
    </FacetListSection>
  );
}

/** Last election result as a seat bar (party colours are data) plus the next scheduled vote. */
export function ElectionSummary({ state, className }: { state: ProfileState; className?: string }) {
  const e = state.election;
  if (!e) return null;
  const seated = e.results.filter((r) => r.seatsWon > 0);
  const totalSeats = seated.reduce((sum, r) => sum + r.seatsWon, 0) || e.totalSeats;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {e.lastName && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-headline text-label">{e.lastName}</p>
          <p className="text-footnote text-label-secondary tabular-nums">
            {e.lastIxTime != null && formatIxDate(e.lastIxTime)}
            {e.turnout != null && ` · turnout ${e.turnout.toFixed(1)}%`}
          </p>
        </div>
      )}
      {seated.length > 0 && totalSeats > 0 && (
        <>
          <div
            className="bg-fill-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
            aria-hidden
          >
            {seated.map((r) => (
              <span
                key={r.partyName}
                className="h-full"
                style={{ width: `${(r.seatsWon / totalSeats) * 100}%`, backgroundColor: r.color }}
              />
            ))}
          </div>
          <ul className="text-footnote text-label-secondary flex flex-wrap gap-x-4 gap-y-1">
            {seated.slice(0, 6).map((r) => (
              <li key={r.partyName} className="inline-flex items-center gap-2 tabular-nums">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: r.color }}
                />
                <span className="text-label">{r.partyName}</span> {r.seatsWon} seats ·{" "}
                {r.votePercentage.toFixed(1)}%
              </li>
            ))}
          </ul>
        </>
      )}
      {e.upcomingName && (
        <p className="text-footnote text-label-secondary">
          Next: {e.upcomingName}
          {e.upcomingIxTime != null && ` · ${formatIxDate(e.upcomingIxTime)}`}
        </p>
      )}
    </div>
  );
}
