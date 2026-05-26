"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Shield, Globe, AlertTriangle, BarChart3, Send, TrendingUp } from "lucide-react";
import { api } from "~/trpc/react";
import { DiplomaticHealthRing } from "~/components/diplomatic/DiplomaticHealthRing";
import { SectionHelpIcon } from "~/components/ui/help-icon";

interface IntelligenceOverviewProps {
  countryId: string;
  countryName: string;
  onTabChange?: (tab: string) => void;
}

export function IntelligenceOverview({
  countryId,
  countryName,
  onTabChange,
}: IntelligenceOverviewProps) {
  // Fetch intelligence metrics
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Fetch diplomatic data
  const { data: embassies = [] } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: recentDiplomaticChanges = [] } = api.diplomaticCore.getRecentChanges.useQuery(
    { countryId, hours: 48 },
    { enabled: !!countryId }
  );

  // Calculate metrics
  const activeEmbassies = embassies.filter(
    (e: any) => e.status === "ACTIVE" || e.status === "active"
  ).length;
  const criticalDiplomaticEvents = recentDiplomaticChanges.filter(
    (c: any) => c.changeType === "mission_failed" || c.changeType === "relationship_change"
  ).length;

  const intelligenceMetrics = [
    {
      label: "Security Score",
      value: defenseOverview?.overallScore || 0,
      max: 100,
      icon: Shield,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/20",
    },
    {
      label: "Diplomatic Network",
      value: activeEmbassies,
      max: null,
      icon: Globe,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
    },
    {
      label: "Military Strength",
      value: defenseOverview?.militaryStrength || 0,
      max: 100,
      icon: Shield,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
    },
    {
      label: "Active Threats",
      value: defenseOverview?.activeThreats || 0,
      max: null,
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Intelligence Metrics Strip */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {intelligenceMetrics.map((metric) => {
          const Icon = metric.icon;
          const percentage = metric.max ? (metric.value / metric.max) * 100 : null;

          return (
            <div
              key={metric.label}
              className={`glass-hierarchy-child rounded-lg p-2.5 ${metric.bgColor}`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${metric.color}`} />
                <span className="text-muted-foreground text-xs font-medium">{metric.label}</span>
              </div>
              <div className="mt-0.5 text-lg font-bold">
                {metric.value}
                {metric.max && <span className="text-muted-foreground text-sm">/{metric.max}</span>}
              </div>
              {percentage !== null && (
                <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className={`h-full ${metric.color.replace("text-", "bg-")}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onTabChange?.("economic")}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Economic Analytics
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onTabChange?.("diplomatic")}
        >
          <Globe className="h-3.5 w-3.5" />
          Diplomatic Network
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onTabChange?.("policy")}
        >
          <Send className="h-3.5 w-3.5" />
          Policy Analysis
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onTabChange?.("forecasting")}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Forecasting
        </Button>
      </div>

      {/* Diplomatic Intelligence */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-600" />
            Diplomatic Intelligence Network
            <SectionHelpIcon
              title="Diplomatic Intelligence"
              content="Real-time overview of your diplomatic network health, including active embassies, recent diplomatic changes, and critical events requiring attention. Click 'Open Diplomatic Operations' to view detailed analytics."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Diplomatic Health Ring */}
            <div className="flex items-center justify-center lg:col-span-1">
              <DiplomaticHealthRing
                countryId={countryId}
                size="md"
                interactive={true}
                onClick={() => onTabChange?.("diplomatic")}
              />
            </div>

            {/* Stats Grid */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-cyan-50 p-3 transition-all hover:shadow-sm dark:from-blue-950/20 dark:to-cyan-950/20">
                  <p className="text-muted-foreground text-xs">Active Embassies</p>
                  <p className="mt-0.5 text-lg font-bold text-blue-600">{activeEmbassies}</p>
                </div>
                <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-cyan-50 p-3 transition-all hover:shadow-sm dark:from-blue-950/20 dark:to-cyan-950/20">
                  <p className="text-muted-foreground text-xs">Recent Changes (48h)</p>
                  <p className="mt-0.5 text-lg font-bold text-cyan-600">
                    {recentDiplomaticChanges.length}
                  </p>
                </div>
                {criticalDiplomaticEvents > 0 && (
                  <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          Critical Events Detected
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Requires immediate diplomatic attention
                        </p>
                      </div>
                      <Badge variant="destructive">{criticalDiplomaticEvents}</Badge>
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="default"
                size="sm"
                className="mt-3 w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
                onClick={() => onTabChange?.("diplomatic")}
              >
                <Globe className="mr-2 h-3.5 w-3.5" />
                Open Diplomatic Operations
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
