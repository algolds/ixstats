"use client";

/**
 * CountryInfoPanel - Slide-out panel for country details on the map.
 *
 * Desktop: Right-side panel. Mobile: Bottom sheet.
 * Shows economic data (clickable for modals), wiki intro, wiki sections TOC,
 * media gallery, sovereignty, and neighbors.
 */

import { useState, useCallback, memo } from "react";
import {
  X, ExternalLink, Users, DollarSign, TrendingUp, MapPin, Globe,
  Crown, BookOpen, Shield, Swords, ChevronDown, ChevronRight, Image as ImageIcon,
  Pencil,
} from "lucide-react";
import { SOVEREIGNTY_TYPE_MAP } from "~/lib/map-config";
import { isStandaloneClient } from "~/lib/standalone-detection";
import { sanitizeWikiContent } from "~/lib/sanitize-html";
import { WikiHtmlContent } from "~/components/wiki/WikiLinkPreview";
import Link from "next/link";
import type { SelectedCountry } from "./IxWorldMap";
import { SwipeableBottomSheet } from "./SwipeableBottomSheet";
import { useCountryPanelData } from "~/hooks/useCountryPanelData";
import { useFlag } from "~/hooks/useFlag";
import { api } from "~/trpc/react";

// Lazy import modals and geo profile to avoid bloating the initial map bundle
import dynamic from "next/dynamic";
const GdpDetailsModal = dynamic(
  () => import("~/components/modals/GdpDetailsModal").then((m) => ({ default: m.GdpDetailsModal })),
  { ssr: false }
);
const PopulationDetailsModal = dynamic(
  () => import("~/components/modals/PopulationDetailsModal").then((m) => ({ default: m.PopulationDetailsModal })),
  { ssr: false }
);
const GeoProfileContent = dynamic(
  () => import("./GeoProfileContent").then((m) => ({ default: m.GeoProfileContent })),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-emerald-500" /></div> }
);

interface CountryInfoPanelProps {
  country: SelectedCountry;
  onClose: () => void;
  onNeighborClick?: (neighbor: { featureId: string; countryId: string | null; displayName: string; centroidLng?: number; centroidLat?: number }) => void;
  onGeographyFilter?: (filter: { type: "continent" | "region"; value: string } | null) => void;
  onEditMap?: () => void;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatPopulation(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatGdpPerCapita(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatArea(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} km\u00B2`;
}

function StatCard({ icon: Icon, label, value, onClick }: {
  icon: typeof Users;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const interactive = !!onClick;
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`rounded-lg bg-muted px-3 py-2 text-left ${
        interactive
          ? "cursor-pointer transition-colors hover:bg-accent hover:ring-1 hover:ring-blue-300/50 active:scale-[0.98]"
          : ""
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
        {interactive && <ChevronRight className="ml-auto h-2.5 w-2.5 opacity-40" />}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
    </Tag>
  );
}

/** Lightbox for viewing images fullscreen */
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      tabIndex={0}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt=""
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export const CountryInfoPanel = memo(function CountryInfoPanel({ country, onClose, onNeighborClick, onGeographyFilter, onEditMap }: CountryInfoPanelProps) {
  const { summary, neighbors, sovereignty, wikiSections, wikiImages, isLoading } = useCountryPanelData(country.countryId, country.displayName);
  // Use summary name for display, but country.displayName for cache-consistent wiki queries
  // (prefetch seeds cache with country.displayName from the GeoJSON layer)
  const displayName = summary?.name ?? country.displayName;
  const wikiName = country.displayName;
  const { flagUrl } = useFlag(displayName);

  // Wiki rich intro — HTML paragraphs from wikitext, cache key consistent with prefetch
  const { data: wikiRichIntro } = api.countries.getWikiRichIntro.useQuery(
    { countryName: wikiName },
    {
      enabled: !!wikiName,
      staleTime: 24 * 60 * 60_000,
      gcTime: 48 * 60 * 60_000,
    }
  );

  // Check ownership for edit button
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const isOwner = !!(userProfile?.countryId && country.countryId && userProfile.countryId === country.countryId);

  // Tab state
  const [activeTab, setActiveTab] = useState<"overview" | "info" | "geography">("overview");
  const hasGeoTab = !!country.countryId;
  const hasInfoTab = !!(wikiRichIntro || wikiSections || wikiImages);

  // Modal state
  const [activeModal, setActiveModal] = useState<"gdp" | "population" | null>(null);

  // Wiki intro expand state (show first paragraph by default, expand for all)
  const [introExpanded, setIntroExpanded] = useState(false);

  // Wiki sections expand state
  const [sectionsExpanded, setSectionsExpanded] = useState(false);

  // Lightbox state
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const handleNeighborClick = useCallback(
    (neighbor: { featureId: string; countryId: string | null; displayName: string; centroidLng?: number; centroidLat?: number }) => {
      onNeighborClick?.(neighbor);
    },
    [onNeighborClick]
  );

  const panelContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {flagUrl ? (
            <img
              src={flagUrl}
              alt=""
              className="h-6 w-9 rounded-sm border border-border object-cover"
            />
          ) : (
            <div
              className="h-6 w-9 rounded-sm border border-border"
              style={{ backgroundColor: country.fillColor }}
            />
          )}
          <h3 className="truncate text-base font-semibold text-foreground">
            {displayName}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border/50 px-4">
        <button
          onClick={() => setActiveTab("overview")}
          className={`relative px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "overview"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview
          {activeTab === "overview" && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("info")}
          className={`relative px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === "info"
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Info
          {activeTab === "info" && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-amber-500" />
          )}
        </button>
        {hasGeoTab && (
          <button
            onClick={() => setActiveTab("geography")}
            className={`relative px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === "geography"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Geography
            {activeTab === "geography" && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-500" />
            )}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="overflow-y-auto p-4" style={{ maxHeight: "calc(100% - 90px)" }}>
        {/* Info tab — wiki content */}
        {activeTab === "info" ? (
          <div className="space-y-3">
            {/* Wiki intro */}
            {wikiRichIntro?.paragraphs && wikiRichIntro.paragraphs.length > 0 && (
              <div className="space-y-1.5">
                {wikiRichIntro.paragraphs.slice(0, introExpanded ? 5 : 2).map((p, i) => (
                  <WikiHtmlContent key={i} as="p" className="text-xs leading-relaxed text-foreground/80"
                     html={sanitizeWikiContent(p)} />
                ))}
                {wikiRichIntro.paragraphs.length > 2 && (
                  <button
                    onClick={() => setIntroExpanded((v) => !v)}
                    className="text-[10px] font-medium text-blue-600 transition-colors hover:text-blue-500"
                  >
                    {introExpanded ? "Show less" : "Read more..."}
                  </button>
                )}
              </div>
            )}

            {/* Wiki sections (TOC) */}
            {wikiSections && wikiSections.length > 0 && (() => {
              const baseWikiUrl = wikiRichIntro?.wikiUrl ?? `https://ixwiki.com/wiki/${encodeURIComponent(displayName)}`;
              return (
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <BookOpen className="h-3 w-3" />
                    Table of Contents ({wikiSections.filter((s) => s.level === 2).length})
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {wikiSections
                      .filter((s) => s.level <= 3)
                      .map((section, i) => {
                        const sectionUrl = `${baseWikiUrl}#${section.anchor}`;
                        if (section.level === 2) {
                          return (
                            <div key={`${section.anchor}-${i}`} className="rounded-md border border-border/30 p-2">
                              <a href={sectionUrl} target="_blank" rel="noopener noreferrer"
                                 className="block text-xs font-medium text-foreground/90 transition-colors hover:text-blue-600">
                                {section.line}
                              </a>
                              {"preview" in section && section.preview && (
                                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground line-clamp-2">
                                  {section.preview as string}
                                </p>
                              )}
                            </div>
                          );
                        }
                        return (
                          <a key={`${section.anchor}-${i}`} href={sectionUrl} target="_blank" rel="noopener noreferrer"
                             className="block truncate pl-3 text-[10px] text-foreground/50 transition-colors hover:text-blue-600">
                            {section.line}
                          </a>
                        );
                      })}
                  </div>
                </div>
              );
            })()}

            {/* Media Gallery */}
            {wikiImages && wikiImages.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ImageIcon className="h-3 w-3" />
                  Media ({wikiImages.length})
                </div>
                <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
                  {wikiImages.slice(0, 12).map((img, i) => (
                    <button key={`${img.title}-${i}`} onClick={() => setLightboxSrc(img.url)}
                            className="flex-shrink-0 overflow-hidden rounded-md border border-border transition-transform hover:scale-105">
                      <img src={img.thumbUrl} alt={img.title.replace(/^File:/, "").replace(/_/g, " ")}
                           className="h-16 w-auto object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Wiki link */}
            {wikiRichIntro?.wikiUrl && (
              <a href={wikiRichIntro.wikiUrl} target="_blank" rel="noopener noreferrer"
                 className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30">
                <BookOpen className="h-3 w-3" />
                Read full article on {wikiRichIntro.wikiUrl.includes("ixwiki") ? "IxWiki" : "IIWiki"}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {!wikiRichIntro && !wikiSections && !wikiImages && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No wiki article found for this country.
              </div>
            )}
          </div>
        ) : activeTab === "geography" && hasGeoTab && country.countryId ? (
          <GeoProfileContent countryId={country.countryId} countryName={country.displayName} />
        ) : !country.countryId ? (
          /* Unclaimed territory */
          <div>
            {wikiRichIntro?.paragraphs && wikiRichIntro.paragraphs.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {wikiRichIntro.paragraphs.slice(0, introExpanded ? 5 : 1).map((p, i) => (
                  <WikiHtmlContent key={i} as="p" className="text-xs leading-relaxed text-foreground/80"
                     html={sanitizeWikiContent(p)} />
                ))}
                {wikiRichIntro.paragraphs.length > 1 && (
                  <button
                    onClick={() => setIntroExpanded((v) => !v)}
                    className="text-[10px] font-medium text-blue-600 transition-colors hover:text-blue-500"
                  >
                    {introExpanded ? "Show less" : "Read more..."}
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={MapPin} label="Location" value={`${country.centroidLat.toFixed(1)}\u00b0, ${country.centroidLng.toFixed(1)}\u00b0`} />
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-muted/50 py-2">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Unclaimed Territory</span>
            </div>

            {wikiRichIntro?.wikiUrl && (
              <div className="mt-3">
                <a
                  href={wikiRichIntro.wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                >
                  <BookOpen className="h-3 w-3" />
                  Read on {wikiRichIntro.wikiUrl.includes("ixwiki") ? "IxWiki" : "IIWiki"}
                </a>
              </div>
            )}
          </div>
        ) : isLoading ? (
          /* Loading skeleton */
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
            <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          </div>
        ) : summary ? (
          <>
            {/* Brief wiki intro — first paragraph only, full content in Info tab */}
            {wikiRichIntro?.paragraphs?.[0] && (
              <div className="mb-3">
                <WikiHtmlContent as="p" className="text-xs leading-relaxed text-foreground/80 line-clamp-3"
                   html={sanitizeWikiContent(wikiRichIntro.paragraphs[0])} />
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
                icon={Users} label="Population" value={formatPopulation(summary.population)}
                onClick={() => setActiveModal("population")}
              />
              <StatCard
                icon={DollarSign} label="GDP" value={formatNumber(summary.totalGdp)}
                onClick={() => setActiveModal("gdp")}
              />
              <StatCard
                icon={DollarSign} label="GDP/Capita" value={formatGdpPerCapita(summary.gdpPerCapita)}
                onClick={() => setActiveModal("gdp")}
              />
              <StatCard
                icon={TrendingUp} label="Growth" value={summary.gdpGrowth != null ? `${summary.gdpGrowth.toFixed(1)}%` : "\u2014"}
                onClick={() => setActiveModal("gdp")}
              />
              <StatCard icon={MapPin} label="Land Area" value={formatArea(summary.landArea)} />
              <StatCard icon={Crown} label="Econ. Tier" value={summary.economicTier ?? "\u2014"} />
            </div>

            {/* Geography — clickable badges to highlight on map */}
            {(summary.continent || summary.region) && (
              <div className="mt-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Geography
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  {summary.continent && (
                    <button
                      onClick={() => onGeographyFilter?.({ type: "continent", value: summary.continent! })}
                      className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-600 cursor-pointer transition-colors hover:bg-blue-100 hover:ring-1 hover:ring-blue-300/50"
                    >
                      {summary.continent}
                    </button>
                  )}
                  {summary.region && (
                    <button
                      onClick={() => onGeographyFilter?.({ type: "region", value: summary.region! })}
                      className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600 cursor-pointer transition-colors hover:bg-indigo-100 hover:ring-1 hover:ring-indigo-300/50"
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
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Government
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-foreground/80">
                  {summary.leader && <p>Leader: <span className="font-medium text-foreground">{summary.leader}</span></p>}
                  {summary.governmentType && <p>Type: <span className="font-medium text-foreground">{summary.governmentType}</span></p>}
                </div>
              </div>
            )}

            {/* Sovereignty - subject of another */}
            {sovereignty.sovereign && (
              <div className="mt-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Swords className="h-3 w-3" />
                  Sovereignty
                </div>
                <div className="mt-1.5 rounded-lg border border-amber-200/50 bg-amber-50/50 p-2">
                  <div className="text-[10px] text-amber-700">
                    {SOVEREIGNTY_TYPE_MAP[sovereignty.sovereign.relationshipType as keyof typeof SOVEREIGNTY_TYPE_MAP]?.label ?? sovereignty.sovereign.relationshipType} of
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
                      <img src={sovereignty.sovereign.flag} alt="" className="h-3.5 w-5 rounded-sm border border-border object-cover" />
                    )}
                    {sovereignty.sovereign.name}
                  </button>
                  {sovereignty.sovereign.autonomyLevel != null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-amber-600">Autonomy</span>
                      <div className="h-1.5 flex-1 rounded-full bg-amber-200">
                        <div
                          className="h-1.5 rounded-full bg-amber-500"
                          style={{ width: `${Math.round(sovereignty.sovereign.autonomyLevel * 100)}%` }}
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
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  Domains ({sovereignty.subjects.length})
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {sovereignty.subjects.map((s) => (
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
                      {s.flag && (
                        <img src={s.flag} alt="" className="h-3 w-4 rounded-sm object-cover" />
                      )}
                      {s.name}
                      <span className="text-[9px] text-indigo-400">
                        ({SOVEREIGNTY_TYPE_MAP[s.relationshipType as keyof typeof SOVEREIGNTY_TYPE_MAP]?.short ?? s.relationshipType})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Neighbors */}
            {neighbors.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Neighbors
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {neighbors.map((n) => (
                    <button
                      key={n.featureId}
                      onClick={() => handleNeighborClick(n)}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted/80 hover:text-foreground"
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
              {summary.slug && !isStandaloneClient() && (
                <Link
                  href={`/countries/${summary.slug}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
                >
                  View Full Profile
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: Right-side panel */}
      <div
        className="absolute right-0 top-0 z-20 hidden h-full w-96 sm:block"
        style={{ animation: "slideInRight 0.25s ease-out" }}
      >
        <div className="h-full bg-card shadow-xl">
          {panelContent}
        </div>
      </div>

      {/* Mobile: Swipeable bottom sheet */}
      <SwipeableBottomSheet onClose={onClose}>
        {panelContent}
      </SwipeableBottomSheet>

      {/* Image lightbox */}
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}

      {/* Metric detail modals */}
      {activeModal === "gdp" && summary && (
        <GdpDetailsModal
          isOpen
          onClose={() => setActiveModal(null)}
          countryId={summary.id}
          countryName={summary.name}
        />
      )}
      {activeModal === "population" && summary && (
        <PopulationDetailsModal
          isOpen
          onClose={() => setActiveModal(null)}
          countryId={summary.id}
          countryName={summary.name}
        />
      )}

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
});
