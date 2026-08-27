"use client";

import React from "react";
import { cn } from "~/lib/utils";
import {
  StatUp as TrendingUp,
  Eye,
  Flask as Beaker,
  Palette,
  Page as FileText,
  WarningCircle as AlertCircle,
  CheckCircle,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import type { SharedDataCollection } from "~/types/diplomatic-network";

export const DATA_TYPE_CONFIG = {
  economic: {
    icon: TrendingUp,
    label: "Economic",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
  },
  intelligence: {
    icon: Eye,
    label: "Intelligence",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  research: {
    icon: Beaker,
    label: "Research",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
  cultural: {
    icon: Palette,
    label: "Cultural",
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
  },
  policy: {
    icon: FileText,
    label: "Policy",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
} as const;

export function MetricCard({
  label,
  value,
  trend,
  positive,
}: {
  label: string;
  value: string | number;
  trend?: number;
  positive?: boolean;
}) {
  return (
    <div className="bg-background/50 border-border/50 space-y-1 rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-xl font-bold">{value}</div>
        {trend !== undefined && (
          <span className={cn("text-xs", trend > 0 ? "text-green-500" : "text-red-500")}>
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        )}
        {positive && <CheckCircle className="h-4 w-4 text-green-500" />}
      </div>
    </div>
  );
}

export function EmptyState({ type }: { type: string }) {
  const config = DATA_TYPE_CONFIG[type as keyof typeof DATA_TYPE_CONFIG];
  const Icon = config?.icon || AlertCircle;

  return (
    <div className="text-muted-foreground py-8 text-center">
      <Icon className="mx-auto mb-4 h-12 w-12 opacity-50" />
      <p>No {config?.label || type} data shared yet</p>
    </div>
  );
}

export function EconomicDataTab({ data }: { data: any }) {
  if (!data) return <EmptyState type="economic" />;

  return (
    <Card className="facet-hierarchy-child border-green-500/20 bg-green-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          Economic Cooperation
        </CardTitle>
        <CardDescription>Trade volume, joint ventures, and economic benefits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <MetricCard
            label="Trade Volume"
            value={`$${(data.tradeVolume || 0).toLocaleString()}M`}
            trend={data.tradeGrowth}
          />
          <MetricCard label="Joint Ventures" value={data.jointVentures || 0} />
          <MetricCard
            label="Investment"
            value={`$${(data.investmentValue || 0).toLocaleString()}M`}
          />
          <MetricCard label="Tariffs Reduced" value={`${data.tariffsReduced || 0}%`} positive />
          <MetricCard
            label="Economic Benefit"
            value={`+${(data.economicBenefit || 0).toFixed(1)}%`}
            positive
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function IntelligenceDataTab({
  data,
  isOwner,
}: {
  data: any[] | undefined;
  isOwner: boolean;
}) {
  if (!data || data.length === 0) return <EmptyState type="intelligence" />;

  return (
    <div className="space-y-4">
      {data.map((report, idx) => (
        <Card key={idx} className="facet-hierarchy-child border-blue-500/20 bg-blue-500/5">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-500" />
                  Intelligence Report - {report.reportType}
                </CardTitle>
                <CardDescription>{report.summary}</CardDescription>
              </div>
              <Badge variant={report.classification === "PUBLIC" ? "default" : "secondary"}>
                {report.classification}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold">Key Findings:</div>
              <ul className="space-y-1">
                {report.keyFindings?.map((finding: string, i: number) => (
                  <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-muted-foreground text-xs">Confidence: {report.confidence}%</div>
              <div className="text-muted-foreground text-xs">
                Updated: {new Date(report.lastUpdated).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ResearchDataTab({ data }: { data: any[] | undefined }) {
  if (!data || data.length === 0) return <EmptyState type="research" />;

  return (
    <div className="space-y-4">
      {data.map((project, idx) => (
        <Card key={idx} className="facet-hierarchy-child border-purple-500/20 bg-purple-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-purple-500" />
              {project.researchArea}
            </CardTitle>
            <CardDescription>{project.collaborators?.length || 0} collaborator(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-2" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <MetricCard label="Breakthroughs" value={project.breakthroughs?.length || 0} />
              <MetricCard label="Publications" value={project.publications || 0} />
              <MetricCard label="Patents" value={project.patents || 0} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CulturalDataTab({ data }: { data: any }) {
  if (!data) return <EmptyState type="cultural" />;

  return (
    <Card className="facet-hierarchy-child border-pink-500/20 bg-pink-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-pink-500" />
          Cultural Exchange
        </CardTitle>
        <CardDescription>Programs, events, and cultural impact</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <MetricCard label="Exchange Programs" value={data.exchangePrograms || 0} />
          <MetricCard label="Cultural Events" value={data.culturalEvents || 0} />
          <MetricCard label="Artists Exchanged" value={data.artistsExchanged || 0} />
          <MetricCard label="Students Exchanged" value={data.studentsExchanged || 0} />
        </div>
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cultural Impact</span>
            <span className="font-semibold">{data.culturalImpactScore || 0}%</span>
          </div>
          <Progress value={data.culturalImpactScore || 0} className="h-2" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Diplomatic Goodwill</span>
            <span className="font-semibold">{data.diplomaticGoodwill || 0}%</span>
          </div>
          <Progress value={data.diplomaticGoodwill || 0} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PolicyDataTab({ data }: { data: any[] | undefined }) {
  if (!data || data.length === 0) return <EmptyState type="policy" />;

  return (
    <div className="space-y-4">
      {data.map((policy, idx) => (
        <Card key={idx} className="facet-hierarchy-child border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-500" />
                  {policy.policyFramework}
                </CardTitle>
                <CardDescription>{policy.agreementType} agreement</CardDescription>
              </div>
              <Badge variant={policy.status === "ratified" ? "default" : "secondary"}>
                {policy.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {policy.keyProvisions && (policy.keyProvisions as string[]).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold">Key Provisions:</div>
                <ul className="space-y-1">
                  {(policy.keyProvisions as string[]).map((provision: string, i: number) => (
                    <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span>{provision}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-muted-foreground text-xs">Compliance: {policy.compliance}%</div>
              {policy.effectiveDate && (
                <div className="text-muted-foreground text-xs">
                  Effective: {new Date(policy.effectiveDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AllDataTab({
  data,
  isOwner,
}: {
  data: SharedDataCollection | undefined;
  isOwner: boolean;
}) {
  if (!data) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No shared data available yet</p>
        {isOwner && (
          <p className="mt-2 text-xs">
            Share data with your embassy partner to strengthen cooperation
          </p>
        )}
      </div>
    );
  }

  const hasData =
    data.economic ||
    data.intelligence?.length ||
    data.research?.length ||
    data.cultural ||
    data.policy?.length;

  if (!hasData) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No shared data available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.economic && <EconomicDataTab data={data.economic} />}
      {data.intelligence && data.intelligence.length > 0 && (
        <IntelligenceDataTab data={data.intelligence} isOwner={isOwner} />
      )}
      {data.research && data.research.length > 0 && <ResearchDataTab data={data.research} />}
      {data.cultural && <CulturalDataTab data={data.cultural} />}
      {data.policy && data.policy.length > 0 && <PolicyDataTab data={data.policy} />}
    </div>
  );
}
