"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Shield,
  Globe,
  AlertTriangle,
  BarChart3,
  FileText,
  Swords,
  ArrowRight,
} from "lucide-react";
import { api } from "~/trpc/react";
import { DiplomaticHealthRing } from "~/components/diplomatic/DiplomaticHealthRing";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { TabHeroBanner } from "~/components/mycountry/primitives/TabHeroBanner";

type IntelligenceTab = "dashboard" | "analysis" | "reports";

interface IntelligenceDashboardProps {
  countryId: string;
  countryName: string;
  onTabChange?: (tab: IntelligenceTab) => void;
  onNavigate?: (section: string) => void;
}

export function IntelligenceDashboard({
  countryId,
  countryName,
  onTabChange,
  onNavigate,
}: IntelligenceDashboardProps) {
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: embassies = [] } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: recentDiplomaticChanges = [] } = api.diplomaticCore.getRecentChanges.useQuery(
    { countryId, hours: 48 },
    { enabled: !!countryId }
  );

  const activeEmbassies = embassies.filter(
    (e: any) => e.status === "ACTIVE" || e.status === "active"
  ).length;
  const criticalDiplomaticEvents = recentDiplomaticChanges.filter(
    (c: any) => c.changeType === "mission_failed" || c.changeType === "relationship_change"
  ).length;

  const metrics = useMemo(
    () => [
      {
        label: "Security Score",
        value: defenseOverview?.overallScore ?? 0,
        max: 100,
        icon: Shield,
        color: "text-green-600",
        bgColor: "bg-green-50 dark:bg-green-950/20",
        onClick: () => onTabChange?.("analysis"),
      },
      {
        label: "Diplomatic Network",
        value: activeEmbassies,
        max: null,
        icon: Globe,
        color: "text-blue-600",
        bgColor: "bg-blue-50 dark:bg-blue-950/20",
        onClick: () => onTabChange?.("analysis"),
      },
      {
        label: "Active Alerts",
        value: criticalDiplomaticEvents,
        max: null,
        icon: AlertTriangle,
        color: criticalDiplomaticEvents > 0 ? "text-red-600" : "text-green-600",
        bgColor:
          criticalDiplomaticEvents > 0
            ? "bg-red-50 dark:bg-red-950/20"
            : "bg-green-50 dark:bg-green-950/20",
        onClick: () => onTabChange?.("reports"),
      },
      {
        label: "Economic Trend",
        value: defenseOverview?.economicIndex ?? 72,
        max: 100,
        icon: BarChart3,
        color: "text-purple-600",
        bgColor: "bg-purple-50 dark:bg-purple-950/20",
        onClick: () => onTabChange?.("analysis"),
      },
      {
        label: "Military Strength",
        value: defenseOverview?.militaryStrength ?? 0,
        max: 100,
        icon: Swords,
        color: "text-indigo-600",
        bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
        onClick: () => onNavigate?.("defense"),
      },
      {
        label: "Active Threats",
        value: defenseOverview?.activeThreats ?? 0,
        max: null,
        icon: AlertTriangle,
        color: "text-amber-600",
        bgColor: "bg-amber-50 dark:bg-amber-950/20",
        onClick: () => onTabChange?.("reports"),
      },
    ],
    [defenseOverview, activeEmbassies, criticalDiplomaticEvents, onTabChange, onNavigate]
  );

  return (
    <div className="space-y-4">
      <TabHeroBanner
        context="intelligence"
        title="Intelligence Dashboard"
        subtitle="Live metrics and strategic overview"
        icon={Shield}
        accentColor="indigo"
      />

      {/* 6 Clickable Metric Cells */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const percentage = metric.max ? (metric.value / metric.max) * 100 : null;

          return (
            <button
              key={metric.label}
              className={`glass-hierarchy-child cursor-pointer rounded-lg p-2.5 text-left transition-all hover:shadow-sm hover:ring-2 hover:ring-indigo-500/30 ${metric.bgColor}`}
              onClick={metric.onClick}
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
                    className={`h-full rounded-full ${metric.color.replace("text-", "bg-")}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              )}
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
          onClick={() => onTabChange?.("analysis")}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Full Analysis
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onTabChange?.("reports")}
        >
          <FileText className="h-3.5 w-3.5" />
          Key Findings
        </Button>
      </div>

      {/* Diplomatic Intelligence Card */}
      <Card className="glass-hierarchy-child">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 text-blue-600" />
            Diplomatic Intelligence
            <SectionHelpIcon
              title="Diplomatic Intelligence"
              content="Real-time overview of your diplomatic network health, including active embassies, recent diplomatic changes, and critical events."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="flex items-center justify-center lg:col-span-1">
              <DiplomaticHealthRing
                countryId={countryId}
                size="md"
                interactive={true}
                onClick={() => onTabChange?.("analysis")}
              />
            </div>

            <div className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Active Embassies</p>
                  <p className="mt-0.5 text-lg font-bold text-blue-600">{activeEmbassies}</p>
                </div>
                <div className="bg-muted/30 rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Recent Changes (48h)</p>
                  <p className="mt-0.5 text-lg font-bold text-cyan-600">
                    {recentDiplomaticChanges.length}
                  </p>
                </div>
                {criticalDiplomaticEvents > 0 && (
                  <div className="col-span-2 rounded-lg border border-amber-500/30 bg-amber-50 p-3 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Critical Events Detected</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          Requires immediate attention
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
                className="mt-3 w-full gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
                onClick={() => onTabChange?.("analysis")}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                View Full Analysis
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
