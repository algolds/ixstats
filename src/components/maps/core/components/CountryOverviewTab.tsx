"use client";

import React from "react";
import Link from "next/link";
import {
  Group as Users,
  Dollar as DollarSign,
  StatUp as TrendingUp,
  MapPin,
  Crown,
  Tournament as Swords,
  Shield,
  EditPencil as Pencil,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { StatCard } from "~/components/maps/core/components/StatCard";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { SOVEREIGNTY_TYPE_MAP } from "~/lib/maps/map-config";
import { sanitizeWikiContent } from "~/lib/utils";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { toTitleCase } from "~/lib/utils";
import type { SelectedCountry } from "../IxWorldMap";
import {
  formatPopulation,
  formatNumber,
  formatGdpPerCapita,
  formatArea,
} from "~/components/maps/core/hooks/useCountryInfoPanelState";
import { Card } from "~/components/ui/card";

interface CountryOverviewTabProps {
  country: SelectedCountry;
  summary: any;
  sovereignty: any;
  neighbors: any[];
  wikiRichIntro: any;
  isOwner: boolean;
  onNeighborClick?: (neighbor: {
    featureId: string;
    countryId: string | null;
    displayName: string;
    centroidLng?: number;
    centroidLat?: number;
  }) => void;
  onGeographyFilter?: (filter: { type: "continent" | "region"; value: string } | null) => void;
  onEditMap?: () => void;
  setActiveTab: (tab: "overview" | "info" | "geography") => void;
  setActiveModal: (modal: "gdp" | "population" | null) => void;
}

export function CountryOverviewTab({
  // oxlint-disable-next-line eslint/no-unused-vars
  country,
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
  return (
    <>
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
      </div>

      {/* Geography — clickable badges to highlight on map */}
      {(summary.continent || summary.region) && (
        <div className="mt-4">
          <Eyebrow className="block">Geography</Eyebrow>
          <div className="mt-1 flex flex-wrap gap-2">
            {summary.continent && (
              <Button
                variant="outline"
                size="xs"
                className="rounded-full"
                onClick={() =>
                  onGeographyFilter?.({ type: "continent", value: summary.continent! })
                }
              >
                {summary.continent}
              </Button>
            )}
            {summary.region && (
              <Button
                variant="outline"
                size="xs"
                className="rounded-full"
                onClick={() => onGeographyFilter?.({ type: "region", value: summary.region! })}
              >
                {summary.region}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Leader / Government */}
      {(summary.leader || summary.governmentType) && (
        <div className="mt-3">
          <Eyebrow className="block">Government</Eyebrow>
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
        </div>
      )}

      {/* Sovereignty - subject of another */}
      {sovereignty.sovereign && (
        <div className="mt-3">
          <Eyebrow className="flex items-center gap-2">
            <Swords className="h-3 w-3" />
            Sovereignty
          </Eyebrow>
          <Card className="mt-2 p-2">
            <div className="text-label-secondary text-footnote">
              {SOVEREIGNTY_TYPE_MAP[
                sovereignty.sovereign.relationshipType as keyof typeof SOVEREIGNTY_TYPE_MAP
              ]?.label ?? sovereignty.sovereign.relationshipType}{" "}
              of
            </div>
            <button
              onClick={() =>
                onNeighborClick?.({
                  featureId: "",
                  countryId: sovereignty.sovereign!.countryId,
                  displayName: sovereignty.sovereign!.name,
                })
              }
              className="text-label text-body hover:text-blue mt-0.5 flex items-center gap-2 font-medium transition-colors"
            >
              {sovereignty.sovereign.flag && (
                <img
                  src={sovereignty.sovereign.flag}
                  alt=""
                  className="border-separator h-3.5 w-5 rounded-xs border object-cover"
                />
              )}
              {sovereignty.sovereign.name}
            </button>
            {sovereignty.sovereign.autonomyLevel != null && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-label-secondary text-footnote">Autonomy</span>
                <div className="bg-fill-3 h-1.5 flex-1 rounded-full">
                  <div
                    className="bg-blue h-1.5 rounded-full"
                    style={{
                      width: `${Math.round(sovereignty.sovereign.autonomyLevel * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-label text-caption tabular-nums">
                  {Math.round(sovereignty.sovereign.autonomyLevel * 100)}%
                </span>
              </div>
            )}
            {sovereignty.sovereign.establishedDate && (
              <div className="text-label-secondary text-footnote mt-1">
                Est. {sovereignty.sovereign.establishedDate}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Sovereignty - sovereign over others */}
      {sovereignty.subjects.length > 0 && (
        <div className="mt-3">
          <Eyebrow className="flex items-center gap-2">
            <Shield className="h-3 w-3" />
            Domains ({sovereignty.subjects.length})
          </Eyebrow>
          <div className="mt-1 flex flex-wrap gap-1">
            {sovereignty.subjects.map(
              (s: {
                countryId: string;
                name: string;
                flag?: string | null;
                relationshipType?: string;
              }) => (
                <Button
                  key={s.countryId}
                  variant="outline"
                  size="xs"
                  className="gap-1 rounded-full"
                  onClick={() =>
                    onNeighborClick?.({
                      featureId: "",
                      countryId: s.countryId,
                      displayName: s.name,
                    })
                  }
                >
                  {s.flag && (
                    <img src={s.flag} alt="" className="h-3 w-4 rounded-xs object-cover" />
                  )}
                  {s.name}
                  <span className="text-label-secondary text-footnote">
                    (
                    {SOVEREIGNTY_TYPE_MAP[s.relationshipType as keyof typeof SOVEREIGNTY_TYPE_MAP]
                      ?.short ?? s.relationshipType}
                    )
                  </span>
                </Button>
              )
            )}
          </div>
        </div>
      )}

      {/* Neighbors */}
      {neighbors.length > 0 && (
        <div className="mt-3">
          <Eyebrow className="block">Neighbors</Eyebrow>
          <div className="mt-1 flex flex-wrap gap-1">
            {neighbors.map((n) => (
              <Button
                key={n.featureId}
                variant="secondary"
                size="xs"
                className="rounded-full"
                onClick={() => onNeighborClick?.(n)}
              >
                {n.displayName}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
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
