"use client";

import { Shield, Globe, AlertTriangle, Users, Anchor, Crosshair, ArrowRightLeft } from "lucide-react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { TabHeroBanner } from "~/components/mycountry/primitives/TabHeroBanner";

interface BorderThreatPanelProps {
  countryId: string;
}

const threatLevelConfig = {
  minimal: { label: "Minimal", color: "bg-emerald-500 text-white", indicator: "bg-emerald-500" },
  low: { label: "Low", color: "bg-emerald-500 text-white", indicator: "bg-emerald-500" },
  moderate: { label: "Moderate", color: "bg-amber-500 text-white", indicator: "bg-amber-500" },
  high: { label: "High", color: "bg-red-500 text-white", indicator: "bg-red-500" },
  critical: { label: "Critical", color: "bg-red-600 text-white", indicator: "bg-red-600" },
};

const diplomaticConfig = {
  hostile: { label: "Hostile", color: "bg-red-500 text-white" },
  tense: { label: "Tense", color: "bg-amber-500 text-white" },
  neutral: { label: "Neutral", color: "bg-slate-500 text-white" },
  friendly: { label: "Friendly", color: "bg-emerald-500 text-white" },
  allied: { label: "Allied", color: "bg-blue-500 text-white" },
};

function StatItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 text-red-600" />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function ThreatRow({
  threat,
}: {
  threat: {
    id: string;
    neighborName: string;
    borderType: string;
    threatLevel: string;
    threatScore: number;
    militaryThreat?: number | null;
    terrorismRisk?: number | null;
    smugglingRisk?: number | null;
    refugeeFlow?: number | null;
    politicalStability?: number | null;
    diplomaticRelations?: string;
    borderLength?: number | null;
    notes?: string | null;
  };
}) {
  const level =
    threatLevelConfig[threat.threatLevel as keyof typeof threatLevelConfig] ?? threatLevelConfig.low;
  const diplomatic =
    diplomaticConfig[threat.diplomaticRelations as keyof typeof diplomaticConfig] ??
    diplomaticConfig.neutral;

  return (
    <div className="space-y-3 rounded-xl border bg-card/50 p-4 transition-colors hover:bg-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-red-600" />
            <h4 className="font-semibold">{threat.neighborName}</h4>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs capitalize">
              {threat.borderType.replace("_", " ")}
            </Badge>
            {threat.borderLength != null && (
              <span className="text-muted-foreground text-xs">
                {threat.borderLength.toLocaleString()} km
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={level.color}>{level.label}</Badge>
          {threat.diplomaticRelations && (
            <Badge className={diplomatic.color}>{diplomatic.label}</Badge>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Threat score</span>
          <span className="font-medium">{threat.threatScore}/100</span>
        </div>
        <Progress
          value={threat.threatScore}
          className="h-2 bg-red-950/20"
          indicatorClassName={level.indicator}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricItem label="Military" value={threat.militaryThreat} icon={Crosshair} />
        <MetricItem label="Terrorism" value={threat.terrorismRisk} icon={AlertTriangle} />
        <MetricItem label="Smuggling" value={threat.smugglingRisk} icon={ArrowRightLeft} />
        <MetricItem label="Refugee flow" value={threat.refugeeFlow} icon={Users} />
      </div>

      {threat.politicalStability != null && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Political stability</span>
          <span className="font-medium">{threat.politicalStability}/100</span>
        </div>
      )}

      {threat.notes && (
        <p className="text-muted-foreground border-t pt-3 text-xs leading-relaxed">{threat.notes}</p>
      )}
    </div>
  );
}

function MetricItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: number | null;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-background/50 px-2 py-1.5">
      <Icon className="text-muted-foreground h-3.5 w-3.5" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value ?? 0}</div>
      </div>
    </div>
  );
}

export function BorderThreatPanel({ countryId }: BorderThreatPanelProps) {
  const { data, isLoading } = api.security.getBorderSecurity.useQuery({ countryId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const border = data;
  const threats = border?.neighborThreats ?? [];

  return (
    <div className="space-y-4">
      <TabHeroBanner
        context="defense_threats"
        title="Border Security"
        subtitle="Neighbor threat assessments and frontier readiness"
        icon={Shield}
        accentColor="red"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Border Security Overview */}
        <Card className="border-red-500/10 bg-gradient-to-br from-card to-card/95 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-red-600" />
              Border Security Overview
            </CardTitle>
            <CardDescription>Current frontier posture and coverage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-red-500/5 p-3">
              <span className="text-sm text-muted-foreground">Security level</span>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">
                  {border?.overallSecurityLevel ?? 0}
                  <span className="text-sm font-normal text-muted-foreground">/100</span>
                </div>
                <Badge variant="outline" className="mt-1 text-xs capitalize">
                  {border?.securityStatus ?? "unknown"}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <StatItem
                label="Border length"
                value={
                  border?.borderLength != null ? `${border.borderLength.toLocaleString()} km` : "—"
                }
                icon={Globe}
              />
              <StatItem label="Land borders" value={border?.landBorders ?? 0} icon={Anchor} />
              <StatItem
                label="Maritime borders"
                value={border?.maritimeBorders ?? 0}
                icon={Anchor}
              />
              <StatItem label="Checkpoints" value={border?.checkpoints ?? 0} icon={Shield} />
              <StatItem
                label="Surveillance systems"
                value={border?.surveillanceSystems ?? 0}
                icon={Crosshair}
              />
            </div>
          </CardContent>
        </Card>

        {/* Neighbor Threats */}
        <Card className="border-red-500/10 bg-gradient-to-br from-card to-card/95 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Neighbor Threats
            </CardTitle>
            <CardDescription>
              {threats.length === 0
                ? "No assessments recorded"
                : `${threats.length} neighbor${threats.length === 1 ? "" : "s"} assessed`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {threats.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                <Globe className="text-muted-foreground/50 mb-2 h-8 w-8" />
                <p className="text-sm font-medium">No neighbor threat assessments recorded yet.</p>
                <p className="text-muted-foreground mt-1 max-w-xs text-xs">
                  Threat assessments will appear here once intelligence evaluates neighboring
                  borders.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[420px] pr-3">
                <div className="space-y-3">
                  {threats.map((threat) => (
                    <ThreatRow key={threat.id} threat={threat} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
