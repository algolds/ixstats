"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Group as Users,
  Dollar as DollarSign,
  StatUp as TrendingUp,
  MapPin,
  City,
  Crown,
  Tournament as Swords,
  Shield,
  EditPencil as Pencil,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { StatCard } from "~/components/maps/core/components/StatCard";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { SOVEREIGNTY_TYPE_MAP } from "~/lib/maps/map-config";
import { sanitizeWikiContent } from "~/lib/utils";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { toTitleCase } from "~/lib/utils";
import type { NeighborTarget } from "../IxWorldMap";
import {
  formatPopulation,
  formatNumber,
  formatGdpPerCapita,
  formatArea,
} from "~/components/maps/core/hooks/useCountryInfoPanelState";
import { Card } from "~/components/ui/card";

interface CountryOverviewTabProps {
  summary: any;
  sovereignty: any;
  neighbors: any[];
  wikiRichIntro: any;
  isOwner: boolean;
  onNeighborClick?: (neighbor: NeighborTarget) => void;
  onGeographyFilter?: (filter: { type: "continent" | "region"; value: string } | null) => void;
  onEditMap?: () => void;
  setActiveTab: (tab: Section) => void;
  setActiveModal: (modal: "gdp" | "population" | null) => void;
}

type Section = "overview" | "info" | "geography";

/** A continent or region worth a filter chip: none for a blank or "Unknown" one. */
function knownPlace(value: string | null | undefined): string | null {
  const place = value?.trim();
  return place && place.toLowerCase() !== "unknown" ? place : null;
}

const SOVEREIGNTY_LABELS = SOVEREIGNTY_TYPE_MAP as Record<string, { label: string; short: string }>;

function OverviewSection({
  title,
  icon: Icon,
  children,
}: {
  title: ReactNode;
  icon?: typeof Swords;
  children: ReactNode;
}) {
  return (
    <div className="mt-3">
      <Eyebrow className={Icon ? "flex items-center gap-2" : "block"}>
        {Icon && <Icon className="h-3 w-3" />}
        {title}
      </Eyebrow>
      {children}
    </div>
  );
}

/** A subject country (domain) or neighbour shown as a pill that selects it on the map. */
function CountryPill({
  name,
  flag,
  suffix,
  variant = "outline",
  onClick,
}: {
  name: string;
  flag?: string | null;
  suffix?: ReactNode;
  variant?: "outline" | "secondary";
  onClick: () => void;
}) {
  return (
    <Button
      variant={variant}
      size="xs"
      className={flag || suffix ? "gap-1 rounded-full" : "rounded-full"}
      onClick={onClick}
    >
      {flag && <img src={flag} alt="" className="h-3 w-4 rounded-xs object-cover" />}
      {name}
      {suffix}
    </Button>
  );
}

function SovereignSection({
  sovereign,
  onNeighborClick,
}: {
  sovereign: any;
  onNeighborClick?: (neighbor: NeighborTarget) => void;
}) {
  const autonomy =
    sovereign.autonomyLevel != null ? Math.round(sovereign.autonomyLevel * 100) : null;
  return (
    <OverviewSection title="Sovereignty" icon={Swords}>
      <Card className="mt-2 p-2">
        <div className="text-label-secondary text-footnote">
          {SOVEREIGNTY_LABELS[sovereign.relationshipType]?.label ?? sovereign.relationshipType} of
        </div>
        <button
          onClick={() =>
            onNeighborClick?.({
              featureId: "",
              countryId: sovereign.countryId,
              displayName: sovereign.name,
            })
          }
          className="text-label text-body hover:text-blue mt-0.5 flex items-center gap-2 font-medium transition-colors"
        >
          {sovereign.flag && (
            <img
              src={sovereign.flag}
              alt=""
              className="border-separator h-3.5 w-5 rounded-xs border object-cover"
            />
          )}
          {sovereign.name}
        </button>
        {autonomy != null && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-label-secondary text-footnote">Autonomy</span>
            <div className="bg-fill-3 h-1.5 flex-1 rounded-full">
              <div className="bg-blue h-1.5 rounded-full" style={{ width: `${autonomy}%` }} />
            </div>
            <span className="text-label text-caption tabular-nums">{autonomy}%</span>
          </div>
        )}
        {sovereign.establishedDate && (
          <div className="text-label-secondary text-footnote mt-1">
            Est. {sovereign.establishedDate}
          </div>
        )}
      </Card>
    </OverviewSection>
  );
}

interface Domain {
  countryId: string;
  name: string;
  flag?: string | null;
  relationshipType?: string;
}

export function CountryOverviewTab({
  summary,
  sovereignty,
  neighbors,
  wikiRichIntro,
  isOwner,
  onNeighborClick,
  onGeographyFilter,
  onEditMap,
  setActiveTab,
  setActiveModal,
}: CountryOverviewTabProps) {
  const geographyFilters = [
    { type: "continent", value: knownPlace(summary.continent) },
    { type: "region", value: knownPlace(summary.region) },
  ] as const;

  return (
    <>
      {summary.claimed === false && (
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="outline">Unclaimed</Badge>
          <span className="text-label-secondary text-footnote">No player holds this nation yet.</span>
        </div>
      )}
      {/* Brief wiki intro — first paragraph only, full content in Info tab */}
      {wikiRichIntro?.paragraphs?.[0] && (
        <div className="mb-3">
          <WikiHtmlContent
            as="p"
            className="text-label-secondary text-footnote line-clamp-3 leading-relaxed"
            html={sanitizeWikiContent(wikiRichIntro.paragraphs[0])}
          />
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => setActiveTab("info")}
            className="text-blue mt-1 h-auto px-0"
          >
            Read more →
          </Button>
        </div>
      )}

      {/* Quick stats — clickable for modals */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon={Users}
          label="Population"
          value={formatPopulation(summary.population)}
          onClick={() => setActiveModal("population")}
        />
        <StatCard
          icon={DollarSign}
          label="GDP"
          value={formatNumber(summary.totalGdp)}
          onClick={() => setActiveModal("gdp")}
        />
        <StatCard
          icon={DollarSign}
          label="GDP/Capita"
          value={formatGdpPerCapita(summary.gdpPerCapita)}
          onClick={() => setActiveModal("gdp")}
        />
        <StatCard
          icon={TrendingUp}
          label="Growth"
          value={summary.gdpGrowth != null ? `${summary.gdpGrowth.toFixed(1)}%` : "—"}
          onClick={() => setActiveModal("gdp")}
        />
        <StatCard icon={MapPin} label="Land area" value={formatArea(summary.landArea)} />
        <StatCard icon={Crown} label="Econ. Tier" value={summary.economicTier ?? "—"} />
        {summary.capitalCity && (
          <div className="col-span-2">
            <StatCard icon={City} label="Capital" value={summary.capitalCity} />
          </div>
        )}
      </div>

      {geographyFilters.some((f) => f.value) && (
        <div className="mt-4">
          <Eyebrow className="block">Geography</Eyebrow>
          <div className="mt-1 flex flex-wrap gap-2">
            {geographyFilters.map(
              ({ type, value }) =>
                value && (
                  <Button
                    key={type}
                    variant="outline"
                    size="xs"
                    className="rounded-full"
                    onClick={() => onGeographyFilter?.({ type, value })}
                  >
                    {value}
                  </Button>
                )
            )}
          </div>
        </div>
      )}

      {(summary.leader || summary.governmentType) && (
        <OverviewSection title="Government">
          <div className="text-label-secondary text-footnote mt-1 space-y-0.5">
            {summary.leader && (
              <p>
                Leader: <span className="text-label font-medium">{summary.leader}</span>
              </p>
            )}
            {summary.governmentType && (
              <p>
                Type:{" "}
                <span className="text-label font-medium">
                  {toTitleCase(summary.governmentType)}
                </span>
              </p>
            )}
          </div>
        </OverviewSection>
      )}

      {sovereignty.sovereign && (
        <SovereignSection sovereign={sovereignty.sovereign} onNeighborClick={onNeighborClick} />
      )}

      {sovereignty.subjects.length > 0 && (
        <OverviewSection title={`Domains (${sovereignty.subjects.length})`} icon={Shield}>
          <div className="mt-1 flex flex-wrap gap-1">
            {sovereignty.subjects.map((s: Domain) => (
              <CountryPill
                key={s.countryId}
                name={s.name}
                flag={s.flag}
                suffix={
                  <span className="text-label-secondary text-footnote">
                    ({SOVEREIGNTY_LABELS[s.relationshipType ?? ""]?.short ?? s.relationshipType})
                  </span>
                }
                onClick={() =>
                  onNeighborClick?.({ featureId: "", countryId: s.countryId, displayName: s.name })
                }
              />
            ))}
          </div>
        </OverviewSection>
      )}

      {neighbors.length > 0 && (
        <OverviewSection title="Neighbors">
          <div className="mt-1 flex flex-wrap gap-1">
            {neighbors.map((n) => (
              <CountryPill
                key={n.featureId}
                name={n.displayName}
                variant="secondary"
                onClick={() => onNeighborClick?.(n)}
              />
            ))}
          </div>
        </OverviewSection>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {isOwner && onEditMap && (
          <Button variant="outline" size="sm" onClick={onEditMap}>
            <Pencil aria-hidden />
            Edit map
          </Button>
        )}
        {summary.slug && (
          <Button asChild size="sm" className="bg-blue text-on-blue hover:bg-blue/90">
            <Link href={`/countries/${summary.slug}`}>
              View full profile
              <ExternalLink aria-hidden />
            </Link>
          </Button>
        )}
      </div>
    </>
  );
}
