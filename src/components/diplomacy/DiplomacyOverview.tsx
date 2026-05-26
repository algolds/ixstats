"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Building2, Globe, Users, Send, Scale, Handshake, Sparkles } from "lucide-react";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { api } from "~/trpc/react";

interface DiplomacyOverviewProps {
  countryId: string;
  onTabChange?: (tab: string) => void;
}

export function DiplomacyOverview({ countryId, onTabChange }: DiplomacyOverviewProps) {
  // Fetch diplomatic data
  const { data: embassies = [] } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: relationships = [] } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: alliances = [] } = api.diplomaticPolicies.getAlliances.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: policies = [] } = api.diplomaticPolicies.getActiveForeignPolicies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Calculate metrics
  const activeEmbassies = embassies.filter(
    (e: any) => e.status === "ACTIVE" || e.status === "active"
  ).length;
  const totalRelationships = relationships.length;
  const strongRelationships = relationships.filter((r: any) => (r.strength ?? 0) >= 70).length;
  const allianceCount = alliances.length;
  const activePolicies = Array.isArray(policies)
    ? policies.filter((p: any) => p.status === "ACTIVE" || p.status === "active").length
    : 0;
  const avgStrength =
    totalRelationships > 0
      ? Math.round(
          relationships.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelationships
        )
      : 0;

  const diplomacyMetrics = [
    {
      label: "Embassies",
      value: activeEmbassies,
      icon: Building2,
      color: "text-cyan-600",
      tab: "embassies-relations",
    },
    {
      label: "Relations",
      value: totalRelationships,
      icon: Handshake,
      color: "text-blue-600",
      tab: "embassies-relations",
    },
    {
      label: "Alliances",
      value: allianceCount,
      icon: Users,
      color: "text-purple-600",
      tab: "embassies-relations",
    },
    {
      label: "Strong Ties",
      value: strongRelationships,
      icon: Sparkles,
      color: "text-emerald-600",
      tab: "embassies-relations",
    },
    {
      label: "Active Policies",
      value: activePolicies,
      icon: Scale,
      color: "text-amber-600",
      tab: "foreign-policy",
    },
    {
      label: "Avg Strength",
      value: `${avgStrength}%`,
      icon: Globe,
      color: "text-pink-600",
      tab: "embassies-relations",
    },
  ];

  // Get recent embassies (last 5)
  const recentEmbassies = [...embassies]
    .sort(
      (a: any, b: any) =>
        new Date(b.establishedDate ?? b.createdAt ?? b.updatedAt).getTime() -
        new Date(a.establishedDate ?? a.createdAt ?? a.updatedAt).getTime()
    )
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Header with Help */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-semibold">Diplomacy Overview</h3>
          <SectionHelpIcon
            title="Diplomacy Overview"
            content="A snapshot of your diplomatic standing. Track embassies, relations, alliances, and foreign policy at a glance. Use quick actions to navigate to specific areas."
          />
        </div>
      </div>

      {/* Diplomacy Metrics Strip — clickable, navigates to relevant tab */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {diplomacyMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <button
              key={metric.label}
              className="glass-hierarchy-child hover:bg-muted/50 cursor-pointer rounded-lg p-2.5 text-left transition-colors"
              onClick={() => onTabChange?.(metric.tab)}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${metric.color}`} />
                <span className="text-muted-foreground text-xs font-medium">{metric.label}</span>
              </div>
              <div className="mt-0.5 text-lg font-bold">{metric.value}</div>
            </button>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onTabChange?.("embassies-relations")}
        >
          <Building2 className="h-3.5 w-3.5" />
          Embassies & Relations
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onTabChange?.("foreign-policy")}
        >
          <Scale className="h-3.5 w-3.5" />
          Foreign Policy
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onTabChange?.("communications")}
        >
          <Send className="h-3.5 w-3.5" />
          Communications
        </Button>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Embassies */}
        <Card className="glass-hierarchy-child">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-cyan-600" />
                Recent Embassies
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTabChange?.("embassies-relations")}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentEmbassies.length > 0 ? (
              <div className="space-y-2">
                {recentEmbassies.map((embassy: any) => (
                  <div
                    key={embassy.id}
                    className="border-border/40 bg-muted/40 rounded-lg border p-2.5 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
                          <span className="truncate text-sm font-semibold">
                            {embassy.country || embassy.hostCountry || embassy.name || "Embassy"}
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {(embassy.status || "ACTIVE").toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-6 text-center">
                <Building2 className="text-muted-foreground/50 mx-auto mb-2 h-8 w-8" />
                <p className="text-sm">No embassies yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alliances Overview */}
        <Card className="glass-hierarchy-child">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-purple-600" />
                Alliances
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTabChange?.("embassies-relations")}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {alliances.length > 0 ? (
              <div className="space-y-2">
                {alliances.slice(0, 5).map((alliance: any) => (
                  <div
                    key={alliance.id}
                    className="border-border/40 bg-muted/40 rounded-lg border p-2.5 transition-all hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 shrink-0 text-purple-500" />
                          <span className="truncate text-sm font-semibold">
                            {alliance.name || "Alliance"}
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {alliance.myRole || "member"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-6 text-center">
                <Users className="text-muted-foreground/50 mx-auto mb-2 h-8 w-8" />
                <p className="text-sm">No alliances yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
