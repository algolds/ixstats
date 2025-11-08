"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Shield,
  Brain,
  Globe,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";
import { DiplomaticHealthRing } from "~/components/diplomatic/DiplomaticHealthRing";

interface IntelligenceOverviewProps {
  countryId: string;
  countryName: string;
}

export function IntelligenceOverview({ countryId, countryName }: IntelligenceOverviewProps) {
  const router = useRouter();

  // Fetch intelligence metrics
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Fetch diplomatic data
  const { data: embassies = [] } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: recentDiplomaticChanges = [] } = api.diplomatic.getRecentChanges.useQuery(
    { countryId, hours: 48 },
    { enabled: !!countryId }
  );

  // Calculate metrics
  const activeEmbassies = embassies.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length;
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
      status: defenseOverview?.securityLevel?.replace("_", " ") || "Unknown",
    },
    {
      label: "Diplomatic Network",
      value: activeEmbassies,
      max: null,
      icon: Globe,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      status: `${activeEmbassies} active embassies`,
    },
    {
      label: "Military Strength",
      value: defenseOverview?.militaryStrength || 0,
      max: 100,
      icon: Shield,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
      status: "Operational readiness",
    },
    {
      label: "Active Threats",
      value: defenseOverview?.activeThreats || 0,
      max: null,
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      status: "Monitored situations",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Intelligence Header */}
      <Card className="glass-hierarchy-child border-border">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 p-3">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {countryName} Intelligence Operations
                </CardTitle>
                <CardDescription>
                  Strategic intelligence analysis and monitoring dashboard
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Intelligence Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {intelligenceMetrics.map((metric) => {
          const Icon = metric.icon;
          const percentage = metric.max ? (metric.value / metric.max) * 100 : null;

          return (
            <Card key={metric.label} className="glass-hierarchy-child">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-muted-foreground text-sm font-medium">{metric.label}</p>
                    <p className="mt-2 text-3xl font-bold">
                      {metric.value}
                      {metric.max && <span className="text-muted-foreground text-lg">/{metric.max}</span>}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">{metric.status}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${metric.bgColor}`}>
                    <Icon className={`h-6 w-6 ${metric.color}`} />
                  </div>
                </div>
                {percentage !== null && (
                  <div className="bg-muted mt-3 h-2 w-full overflow-hidden rounded-full">
                    <div
                      className={`h-full ${metric.color.replace("text-", "bg-")}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Diplomatic Intelligence */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            Diplomatic Intelligence Network
          </CardTitle>
          <CardDescription>
            Real-time monitoring of diplomatic relations and embassy operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Diplomatic Health Ring */}
            <div className="flex items-center justify-center lg:col-span-1">
              <DiplomaticHealthRing
                countryId={countryId}
                size="md"
                interactive={true}
                onClick={() => router.push("/mycountry/intelligence?tab=diplomatic-ops")}
              />
            </div>

            {/* Stats Grid */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <p className="text-muted-foreground text-sm">Active Embassies</p>
                  <p className="mt-1 text-3xl font-bold text-blue-600">{activeEmbassies}</p>
                </div>
                <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-cyan-50 p-4 dark:from-blue-950/20 dark:to-cyan-950/20">
                  <p className="text-muted-foreground text-sm">Recent Changes (48h)</p>
                  <p className="mt-1 text-3xl font-bold text-cyan-600">
                    {recentDiplomaticChanges.length}
                  </p>
                </div>
                {criticalDiplomaticEvents > 0 && (
                  <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          Critical Events Detected
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Requires immediate diplomatic attention
                        </p>
                      </div>
                      <Badge variant="destructive" className="text-lg">
                        {criticalDiplomaticEvents}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              <Button
                variant="default"
                className="mt-4 w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                onClick={() => router.push("/mycountry/intelligence?tab=diplomatic-ops")}
              >
                <Globe className="mr-2 h-4 w-4" />
                Open Diplomatic Operations
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
