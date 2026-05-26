"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { InlineDiplomaticActions } from "~/components/diplomatic/InlineDiplomaticActions";
import {
  Building2,
  Globe,
  Users,
  Sparkles,
  Handshake,
  Activity,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "~/trpc/react";

interface CountryDiplomaticPanelProps {
  country: {
    id: string;
    name: string;
    economicTier: string;
  };
  flagUrl: string | null | undefined;
  isOwnCountry: boolean;
  viewerCountryId?: string | null;
  viewerCountryName?: string | null;
}

export function CountryDiplomaticPanel({
  country,
  flagUrl,
  isOwnCountry,
  viewerCountryId,
  viewerCountryName,
}: CountryDiplomaticPanelProps) {
  const [showDiplomaticActions, setShowDiplomaticActions] = useState(false);
  const [showAllRelationships, setShowAllRelationships] = useState(false);
  const [showAllEmbassies, setShowAllEmbassies] = useState(false);

  const { data: embassies = [], isLoading: embassiesLoading } =
    api.diplomaticEmbassies.getEmbassies.useQuery({ countryId: country.id }, { enabled: !!country.id });

  const { data: relationships = [], isLoading: relationsLoading } =
    api.diplomaticCore.getRelationships.useQuery({ countryId: country.id }, { enabled: !!country.id });

  const { data: alliances = [], isLoading: alliancesLoading } =
    api.diplomaticPolicies.getAlliances.useQuery({ countryId: country.id }, { enabled: !!country.id });

  // Metrics
  const activeEmbassies = useMemo(
    () => embassies.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length,
    [embassies]
  );
  const totalRelationships = relationships.length;
  const strongRelationships = useMemo(
    () => relationships.filter((r: any) => (r.strength ?? 0) >= 70).length,
    [relationships]
  );
  const allianceCount = alliances.length;
  const avgStrength = useMemo(
    () =>
      totalRelationships > 0
        ? Math.round(
            relationships.reduce((sum: number, r: any) => sum + (r.strength ?? 0), 0) /
              totalRelationships
          )
        : 0,
    [relationships, totalRelationships]
  );

  // Sort relationships by strength
  const sortedRelationships = useMemo(
    () => [...relationships].sort((a: any, b: any) => (b.strength ?? 0) - (a.strength ?? 0)),
    [relationships]
  );

  const displayedRelationships = showAllRelationships
    ? sortedRelationships
    : sortedRelationships.slice(0, 8);

  const displayedEmbassies = showAllEmbassies ? embassies : embassies.slice(0, 6);

  const isLoading = embassiesLoading || relationsLoading || alliancesLoading;

  const metrics = [
    {
      label: "Embassies",
      value: activeEmbassies,
      icon: Building2,
      color: "text-cyan-600 bg-cyan-500/10",
    },
    {
      label: "Relations",
      value: totalRelationships,
      icon: Handshake,
      color: "text-blue-600 bg-blue-500/10",
    },
    {
      label: "Alliances",
      value: allianceCount,
      icon: Users,
      color: "text-purple-600 bg-purple-500/10",
    },
    {
      label: "Strong Ties",
      value: strongRelationships,
      icon: Sparkles,
      color: "text-emerald-600 bg-emerald-500/10",
    },
    {
      label: "Avg Strength",
      value: `${avgStrength}%`,
      icon: Globe,
      color: "text-pink-600 bg-pink-500/10",
    },
  ];

  const getStrengthColor = (strength: number) => {
    if (strength >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (strength >= 60) return "text-blue-600 dark:text-blue-400";
    if (strength >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getStrengthLabel = (strength: number) => {
    if (strength >= 80) return "Strong Ally";
    if (strength >= 60) return "Friend";
    if (strength >= 40) return "Neutral";
    if (strength >= 20) return "Cool";
    return "Tense";
  };

  const getProgressColor = (strength: number) => {
    if (strength >= 80) return "bg-emerald-500";
    if (strength >= 60) return "bg-blue-500";
    if (strength >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Diplomatic Network</h2>
          <p className="text-muted-foreground">
            Public diplomatic standing for {country.name.replace(/_/g, " ")}
          </p>
        </div>
        {!isOwnCountry && (
          <Button
            onClick={() => setShowDiplomaticActions(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Activity className="mr-2 h-4 w-4" />
            Diplomatic Actions
          </Button>
        )}
      </div>

      {/* Diplomatic Actions Modal */}
      <InlineDiplomaticActions
        viewerCountryId={viewerCountryId ?? undefined}
        viewerCountryName={viewerCountryName ?? undefined}
        targetCountryId={country.id}
        targetCountryName={country.name}
        isOwner={isOwnCountry}
        isOpen={showDiplomaticActions}
        onClose={() => setShowDiplomaticActions(false)}
      />

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="border-border/50 bg-card/80 rounded-xl border p-4 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <div className={`rounded-lg p-1.5 ${metric.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-muted-foreground text-xs font-medium">{metric.label}</span>
              </div>
              <div className="mt-2 text-xl font-bold">
                {isLoading ? <Skeleton className="h-6 w-12" /> : metric.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Allies & Friends */}
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Handshake className="h-5 w-5 text-blue-500" />
              Allies & Friends
            </CardTitle>
            <CardDescription>Bilateral relationships by strength</CardDescription>
          </CardHeader>
          <CardContent>
            {relationsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : sortedRelationships.length > 0 ? (
              <div className="space-y-2">
                {displayedRelationships.map((relation: any) => {
                  const strength = relation.strength ?? 0;
                  return (
                    <div
                      key={relation.id}
                      className="border-border/40 bg-muted/30 hover:bg-muted/50 rounded-lg border p-3 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <UnifiedCountryFlag
                          countryName={relation.targetCountryName ?? relation.targetCountry ?? ""}
                          size="sm"
                          flagUrl={relation.targetCountryFlag}
                          rounded
                          className="h-8 w-8 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">
                              {(
                                relation.targetCountryName ??
                                relation.targetCountry ??
                                "Unknown"
                              ).replace(/_/g, " ")}
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-xs ${getStrengthColor(strength)}`}
                              >
                                {getStrengthLabel(strength)}
                              </Badge>
                              <span className={`text-sm font-bold ${getStrengthColor(strength)}`}>
                                {strength}%
                              </span>
                            </div>
                          </div>
                          <div className="mt-1.5">
                            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                              <div
                                className={`h-full rounded-full transition-all ${getProgressColor(strength)}`}
                                style={{ width: `${Math.min(strength, 100)}%` }}
                              />
                            </div>
                          </div>
                          {relation.relationship && (
                            <p className="text-muted-foreground mt-1 text-xs capitalize">
                              {relation.relationship.replace(/_/g, " ").toLowerCase()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {sortedRelationships.length > 8 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllRelationships(!showAllRelationships)}
                    className="w-full text-xs"
                  >
                    {showAllRelationships ? (
                      <>
                        <ChevronUp className="mr-1 h-3 w-3" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-1 h-3 w-3" />
                        Show all {sortedRelationships.length} relationships
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Handshake className="text-muted-foreground/50 mx-auto mb-2 h-8 w-8" />
                <p className="text-muted-foreground text-sm">No diplomatic relationships yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Embassy Network */}
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-cyan-500" />
              Embassy Network
            </CardTitle>
            <CardDescription>Established diplomatic missions</CardDescription>
          </CardHeader>
          <CardContent>
            {embassiesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : embassies.length > 0 ? (
              <div className="space-y-2">
                {displayedEmbassies.map((embassy: any) => (
                  <div
                    key={embassy.id}
                    className="border-border/40 bg-muted/30 hover:bg-muted/50 rounded-lg border p-3 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Building2 className="h-4 w-4 shrink-0 text-cyan-500" />
                        <span className="truncate text-sm font-semibold">
                          {(
                            embassy.country ||
                            embassy.hostCountry ||
                            embassy.name ||
                            "Embassy"
                          ).replace(/_/g, " ")}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          (embassy.status || "ACTIVE").toUpperCase() === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : ""
                        }`}
                      >
                        {(embassy.status || "ACTIVE").toLowerCase()}
                      </Badge>
                    </div>
                    {embassy.type && (
                      <p className="text-muted-foreground mt-1 text-xs capitalize">
                        {embassy.type.replace(/_/g, " ").toLowerCase()}
                      </p>
                    )}
                  </div>
                ))}

                {embassies.length > 6 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllEmbassies(!showAllEmbassies)}
                    className="w-full text-xs"
                  >
                    {showAllEmbassies ? (
                      <>
                        <ChevronUp className="mr-1 h-3 w-3" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-1 h-3 w-3" />
                        Show all {embassies.length} embassies
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Building2 className="text-muted-foreground/50 mx-auto mb-2 h-8 w-8" />
                <p className="text-muted-foreground text-sm">No embassies established yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alliances */}
      <Card className="bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-purple-500" />
            Alliances & Blocs
          </CardTitle>
          <CardDescription>International organizations and alliance memberships</CardDescription>
        </CardHeader>
        <CardContent>
          {alliancesLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : alliances.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alliances.map((alliance: any) => (
                <div
                  key={alliance.id}
                  className="rounded-xl border border-purple-200/50 bg-purple-50/30 p-4 dark:border-purple-800/30 dark:bg-purple-900/10"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0 text-purple-500" />
                      <span className="text-sm font-semibold">{alliance.name || "Alliance"}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-purple-200 text-xs text-purple-600 dark:border-purple-700 dark:text-purple-400"
                    >
                      {alliance.myRole || "member"}
                    </Badge>
                  </div>
                  {alliance.description && (
                    <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                      {alliance.description}
                    </p>
                  )}
                  {alliance.memberCount != null && (
                    <div className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                      <Users className="h-3 w-3" />
                      {alliance.memberCount} member{alliance.memberCount !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Shield className="text-muted-foreground/50 mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">Not a member of any alliances</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
