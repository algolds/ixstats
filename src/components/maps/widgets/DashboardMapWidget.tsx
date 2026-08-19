"use client";

import { useMemo } from "react";
import { Globe, Shield, Building2, Brain, MapPin, Loader2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { CountryMapEmbed, type CountryMapFeature } from "~/components/maps/widgets/CountryMapEmbed";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/utils";
import { cn } from "~/lib/utils";

interface DashboardMapWidgetProps {
  countryId?: string;
  userCountryId?: string; // Backwards compatibility with legacy dashboard prop
  viewMode?: "overview" | "diplomacy" | "defense" | "intelligence";
  className?: string;
  /** Enables click-to-manage: fired when a city/subdivision is clicked on the map. */
  onFeatureClick?: (feature: CountryMapFeature) => void;
}

export function DashboardMapWidget({
  countryId,
  userCountryId,
  viewMode = "overview",
  className = "",
  onFeatureClick,
}: DashboardMapWidgetProps) {
  // Resolve the active country ID from either prop
  const activeCountryId = countryId || userCountryId;

  // 1. Core geo bundle hook
  const {
    areaSqKm,
    cities,
    hasGeometry,
    isLoading: geoLoading,
  } = useCountryMapEmbed(activeCountryId ?? "");

  // 2. Fetch Diplomacy Stats (Embassies) if in diplomacy mode
  const { data: embassies, isLoading: embassyLoading } =
    api.diplomaticEmbassies.getEmbassies.useQuery(
      { countryId: activeCountryId ?? "" },
      { enabled: activeCountryId !== undefined && viewMode === "diplomacy", staleTime: 5 * 60_000 }
    );

  const activePartnerCount = useMemo(() => {
    if (!embassies) return 0;
    return embassies.filter(
      (e) =>
        e.countryId &&
        e.countryId !== activeCountryId &&
        (e.status === "ACTIVE" || e.status === "active")
    ).length;
  }, [embassies, activeCountryId]);

  const partnerCountryIds = useMemo(() => {
    if (!embassies) return [];
    return embassies
      .filter(
        (e) =>
          e.countryId &&
          e.countryId !== activeCountryId &&
          (e.status === "ACTIVE" || e.status === "active")
      )
      .map((e) => e.countryId as string);
  }, [embassies, activeCountryId]);

  const partnerCountryNames = useMemo(() => {
    if (!embassies) return [];
    return embassies
      .filter(
        (e) =>
          e.country &&
          e.country !== "Unknown" &&
          e.countryId !== activeCountryId &&
          (e.status === "ACTIVE" || e.status === "active")
      )
      .map((e) => e.country as string);
  }, [embassies, activeCountryId]);

  // 3. Fetch Defense Stats (Branches + Readiness) if in defense mode
  const { data: securityData, isLoading: securityLoading } =
    api.security.getSecurityAssessment.useQuery(
      { countryId: activeCountryId ?? "" },
      { enabled: activeCountryId !== undefined && viewMode === "defense", staleTime: 5 * 60_000 }
    );

  const { data: branches, isLoading: branchesLoading } = api.security.getMilitaryBranches.useQuery(
    { countryId: activeCountryId ?? "" },
    { enabled: activeCountryId !== undefined && viewMode === "defense", staleTime: 5 * 60_000 }
  );

  const securityLevel = securityData?.securityLevel?.replace("_", " ") ?? "unknown";
  const securityScore = securityData?.overallSecurityScore ?? 0;
  const branchCount = branches?.length ?? 0;
  const avgReadiness = useMemo(() => {
    if (!branches || branches.length === 0) return 0;
    return Math.round(
      branches.reduce((sum, b) => sum + (b.readinessLevel ?? 0), 0) / branches.length
    );
  }, [branches]);

  const readinessColor =
    avgReadiness >= 75
      ? "text-emerald-500 font-semibold"
      : avgReadiness >= 50
        ? "text-yellow-500 font-semibold"
        : "text-red-500 font-semibold";

  // 4. Fetch Intelligence Stats (Relationship Counts) if in intelligence mode
  const { data: relations, isLoading: relationsLoading } =
    api.diplomaticCore.getRelationships.useQuery(
      { countryId: activeCountryId ?? "" },
      {
        enabled: activeCountryId !== undefined && viewMode === "intelligence",
        staleTime: 5 * 60_000,
      }
    );

  const allyCount = useMemo(() => {
    if (!relations) return 0;
    return relations.filter((r) => (r.strength ?? 0) >= 70).length;
  }, [relations]);

  const hostileCount = useMemo(() => {
    if (!relations) return 0;
    return relations.filter((r) => (r.strength ?? 0) < 30).length;
  }, [relations]);

  // Determine mode configuration: title, icon, borders, loading states
  const config = useMemo(() => {
    switch (viewMode) {
      case "diplomacy":
        return {
          title: "Embassy Network",
          Icon: Building2,
          borderColor: "border-cyan-500/15",
          accentColor: "text-cyan-500",
          badgeBorder: "border-cyan-500/30",
          badgeColor: "text-cyan-500",
          isLoading: geoLoading || embassyLoading,
        };
      case "defense":
        return {
          title: "Defense Overview",
          Icon: Shield,
          borderColor: "border-red-500/15",
          accentColor: "text-red-500",
          badgeBorder:
            securityScore >= 75
              ? "border-green-500/30 text-green-500"
              : securityScore >= 50
                ? "border-yellow-500/30 text-yellow-500"
                : "border-red-500/30 text-red-500",
          badgeColor: "",
          isLoading: geoLoading || securityLoading || branchesLoading,
        };
      case "intelligence":
        return {
          title: "Geopolitical Intel",
          Icon: Brain,
          borderColor: "border-indigo-500/15",
          accentColor: "text-indigo-500",
          badgeBorder: "border-indigo-500/30",
          badgeColor: "text-indigo-500",
          isLoading: geoLoading || relationsLoading,
        };
      case "overview":
      default:
        return {
          title: activeCountryId ? "Your Territory" : "Country Map",
          Icon: Globe,
          borderColor: "border-blue-500/15",
          accentColor: "text-blue-500",
          badgeBorder: "border-blue-500/30",
          badgeColor: "text-blue-500",
          isLoading: geoLoading,
        };
    }
  }, [
    viewMode,
    geoLoading,
    embassyLoading,
    securityLoading,
    branchesLoading,
    relationsLoading,
    securityScore,
    activeCountryId,
  ]);

  const { title, Icon, borderColor, accentColor, badgeBorder, badgeColor, isLoading } = config;
  const mapUrl = createUrl(`/maps?country=${activeCountryId}`);

  // ── Loading state ──
  if (isLoading) {
    return (
      <div
        className={cn(
          "glass-surface bg-card/10 overflow-hidden rounded-xl border shadow-xs",
          borderColor,
          className
        )}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-xs font-medium">{title}</span>
          </div>
        </div>
        <div className="bg-muted/40 flex h-52 items-center justify-center">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  // ── No country selected or missing geometry ──
  if (!activeCountryId || !hasGeometry) {
    return (
      <div
        className={cn(
          "glass-surface bg-card/10 overflow-hidden rounded-xl border shadow-xs",
          borderColor,
          className
        )}
      >
        <div className="border-border/10 flex items-center justify-between border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-xs font-medium">{title}</span>
          </div>
        </div>
        <div className="bg-muted/30 flex h-48 flex-col items-center justify-center gap-2 p-4 text-center">
          <MapPin className="text-muted-foreground/60 h-6 w-6" />
          <span className="text-muted-foreground text-xs">
            {!activeCountryId ? "Select a country to view map" : "No map coordinates available"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "glass-surface bg-card/10 overflow-hidden rounded-xl border shadow-xs",
        borderColor,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-3.5 w-3.5", accentColor)} />
          <span className="text-foreground text-xs font-medium">{title}</span>
        </div>
        {viewMode === "diplomacy" && (
          <Badge
            variant="outline"
            className={cn("h-4 px-1.5 text-[9px] uppercase", badgeBorder, badgeColor)}
          >
            {activePartnerCount} Partner{activePartnerCount !== 1 ? "s" : ""}
          </Badge>
        )}
        {viewMode === "defense" && (
          <Badge
            variant="outline"
            className={cn("h-4 px-1.5 text-[9px] uppercase", badgeBorder, badgeColor)}
          >
            {securityLevel}
          </Badge>
        )}
        {viewMode === "intelligence" && (
          <div className="flex items-center gap-1">
            {allyCount > 0 && (
              <Badge
                variant="outline"
                className="h-4 border-green-500/30 px-1.5 text-[9px] text-green-500 uppercase"
              >
                {allyCount} Ally
              </Badge>
            )}
            {hostileCount > 0 && (
              <Badge
                variant="outline"
                className="h-4 border-red-500/30 px-1.5 text-[9px] text-red-500 uppercase"
              >
                {hostileCount} Hostile
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Map Content */}
      <div className="relative h-52 w-full overflow-hidden">
        <CountryMapEmbed
          countryId={activeCountryId}
          highlightCountryIds={viewMode === "diplomacy" ? partnerCountryIds : undefined}
          highlightCountryNames={viewMode === "diplomacy" ? partnerCountryNames : undefined}
          height="h-52"
          interactive={!!onFeatureClick}
          showNeighbors={true}
          showCities={true}
          showSubdivisions={viewMode === "defense" || !!onFeatureClick}
          onFeatureClick={onFeatureClick}
          boundsPadding={50}
        />
      </div>

      {/* Footer statistics depending on mode */}
      <div className="border-border/40 bg-muted/10 flex items-center justify-between border-t px-3 py-1.5">
        {viewMode === "overview" && (
          <div className="text-muted-foreground flex items-center gap-2.5 text-[10px]">
            {areaSqKm ? <span>{Math.round(areaSqKm).toLocaleString()} km²</span> : null}
            {cities.length > 0 && (
              <span>
                {cities.length} {cities.length === 1 ? "city" : "cities"}
              </span>
            )}
          </div>
        )}

        {viewMode === "diplomacy" && (
          <div className="text-muted-foreground flex items-center gap-2.5 text-[10px]">
            <span>{activePartnerCount} active embassies</span>
          </div>
        )}

        {viewMode === "defense" && (
          <div className="text-muted-foreground flex items-center gap-2.5 text-[10px]">
            <span>{branchCount} branches</span>
            <span className={readinessColor}>{avgReadiness}% ready</span>
            {(securityData?.activeThreatCount ?? 0) > 0 && (
              <span className="font-semibold text-red-500">
                {securityData?.activeThreatCount} threats
              </span>
            )}
          </div>
        )}

        {viewMode === "intelligence" && (
          <div className="text-muted-foreground flex items-center gap-2.5 text-[9px]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              Ally
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500" />
              Neutral
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
              Hostile
            </span>
          </div>
        )}

        <a href={mapUrl} className={cn("text-[10px] hover:underline", accentColor)}>
          Full map →
        </a>
      </div>
    </div>
  );
}
