"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  DollarSign,
  TrendingUp,
  MapPin,
  Crown,
  Swords,
  Shield,
  Pencil,
  ExternalLink,
} from "lucide-react";
import { StatCard } from "~/components/maps/core/components/StatCard";
import { SOVEREIGNTY_TYPE_MAP } from "~/lib/map-config";
import { sanitizeWikiContent } from "~/lib/sanitize-html";
import { WikiHtmlContent } from "~/components/wiki/WikiLinkPreview";
import type { SelectedCountry } from "../IxWorldMap";
import {
  formatPopulation,
  formatNumber,
  formatGdpPerCapita,
  formatArea,
} from "~/components/maps/core/hooks/useCountryInfoPanelState";

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
  // eslint-disable-next-line unused-imports/no-unused-vars
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
            className="text-foreground/80 line-clamp-3 text-xs leading-relaxed"
            html={sanitizeWikiContent(wikiRichIntro.paragraphs[0])}
          />
          <button
            onClick={() => setActiveTab("info")}
            className="mt-1 text-[10px] font-medium text-blue-600 transition-colors hover:text-blue-500"
          >
            Read more →
          </button>
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
        <StatCard icon={MapPin} label="Land Area" value={formatArea(summary.landArea)} />
        <StatCard icon={Crown} label="Econ. Tier" value={summary.economicTier ?? "—"} />
      </div>

      {/* Geography — clickable badges to highlight on map */}
      {(summary.continent || summary.region) && (
        <div className="mt-4">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Geography
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            {summary.continent && (
              <button
                onClick={() =>
                  onGeographyFilter?.({ type: "continent", value: summary.continent! })
                }
                className="cursor-pointer rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-600 transition-colors hover:bg-blue-100 hover:ring-1 hover:ring-blue-300/50"
              >
                {summary.continent}
              </button>
            )}
            {summary.region && (
              <button
                onClick={() => onGeographyFilter?.({ type: "region", value: summary.region! })}
                className="cursor-pointer rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600 transition-colors hover:bg-indigo-100 hover:ring-1 hover:ring-indigo-300/50"
              >
                {summary.region}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Leader / Government */}
      {(summary.leader || summary.governmentType) && (
        <div className="mt-3">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Government
          </div>
          <div className="text-foreground/80 mt-1 space-y-0.5 text-xs">
            {summary.leader && (
              <p>
                Leader: <span className="text-foreground font-medium">{summary.leader}</span>
              </p>
            )}
            {summary.governmentType && (
              <p>
                Type: <span className="text-foreground font-medium">{summary.governmentType}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sovereignty - subject of another */}
      {sovereignty.sovereign && (
        <div className="mt-3">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <Swords className="h-3 w-3" />
            Sovereignty
          </div>
          <div className="mt-1.5 rounded-lg border border-amber-200/50 bg-amber-50/50 p-2">
            <div className="text-[10px] text-amber-700">
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
              className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-amber-900 transition-colors hover:text-amber-700"
            >
              {sovereignty.sovereign.flag && (
                <img
                  src={sovereignty.sovereign.flag}
                  alt=""
                  className="border-border h-3.5 w-5 rounded-sm border object-cover"
                />
              )}
              {sovereignty.sovereign.name}
            </button>
            {sovereignty.sovereign.autonomyLevel != null && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[10px] text-amber-600">Autonomy</span>
                <div className="h-1.5 flex-1 rounded-full bg-amber-200">
                  <div
                    className="h-1.5 rounded-full bg-amber-500"
                    style={{
                      width: `${Math.round(sovereignty.sovereign.autonomyLevel * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-medium text-amber-700">
                  {Math.round(sovereignty.sovereign.autonomyLevel * 100)}%
                </span>
              </div>
            )}
            {sovereignty.sovereign.establishedDate && (
              <div className="mt-1 text-[10px] text-amber-600">
                Est. {sovereignty.sovereign.establishedDate}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sovereignty - sovereign over others */}
      {sovereignty.subjects.length > 0 && (
        <div className="mt-3">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <Shield className="h-3 w-3" />
            Domains ({sovereignty.subjects.length})
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {sovereignty.subjects.map((s: { countryId: string; name: string; flag?: string | null; relationshipType?: string }) => (
              <button
                key={s.countryId}
                onClick={() =>
                  onNeighborClick?.({
                    featureId: "",
                    countryId: s.countryId,
                    displayName: s.name,
                  })
                }
                className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                {s.flag && <img src={s.flag} alt="" className="h-3 w-4 rounded-sm object-cover" />}
                {s.name}
                <span className="text-[9px] text-indigo-400">
                  (
                  {SOVEREIGNTY_TYPE_MAP[s.relationshipType as keyof typeof SOVEREIGNTY_TYPE_MAP]
                    ?.short ?? s.relationshipType}
                  )
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Neighbors */}
      {neighbors.length > 0 && (
        <div className="mt-3">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Neighbors
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {neighbors.map((n) => (
              <button
                key={n.featureId}
                onClick={() => onNeighborClick?.(n)}
                className="bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
              >
                {n.displayName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex flex-col gap-2">
        {isOwner && onEditMap && (
          <button
            onClick={onEditMap}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
          >
            <Pencil className="h-3 w-3" />
            Edit Map
          </button>
        )}
        {summary.slug && (
          <Link
            href={`/countries/${summary.slug}`}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50"
          >
            View Full Profile
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </>
  );
}
