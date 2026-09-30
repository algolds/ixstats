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
import { FacetCard, FacetCardHeader, FacetCardContent } from "~/components/ui/facet-container";
import { Progress } from "~/components/ui/progress";
import type {
  SharedCulturalData,
  SharedDataCollection,
  SharedEconomicData,
  SharedIntelligenceData,
  SharedPolicyData,
  SharedResearchData,
} from "~/types/diplomatic-network";

export const DATA_TYPE_CONFIG = {
  economic: {
    icon: TrendingUp,
    label: "Economic",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
  },
  intelligence: {
    icon: Eye,
    label: "Intelligence",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
  },
  research: {
    icon: Beaker,
    label: "Research",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
  },
  cultural: {
    icon: Palette,
    label: "Cultural",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
  },
  policy: {
    icon: FileText,
    label: "Policy",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
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
    <div className="bg-muted/50 space-y-1 rounded-lg p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-foreground text-xl font-semibold tabular-nums">{value}</div>
        {trend !== undefined && (
          <span className={cn("text-xs", trend > 0 ? "text-emerald-500" : "text-destructive")}>
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        )}
        {positive && <CheckCircle className="h-4 w-4 text-emerald-500" />}
      </div>
    </div>
  );
}

export function EmptyState({ type }: { type: string }) {
  const config = DATA_TYPE_CONFIG[type as keyof typeof DATA_TYPE_CONFIG];
  const Icon = config?.icon || AlertCircle;

  return (
    <div className="text-muted-foreground py-8 text-center">
      <Icon className="mx-auto mb-3 h-6 w-6" />
      <p>No {config?.label || type} data shared yet</p>
    </div>
  );
}

export function EconomicDataTab({ data }: { data: SharedEconomicData | undefined }) {
  if (!data) return <EmptyState type="economic" />;

  return (
    <FacetCard surface="solid" className="rounded-xl">
      <FacetCardHeader>
        <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
          <TrendingUp className="text-muted-foreground h-5 w-5" />
          Economic Cooperation
        </h3>
        <p className="text-muted-foreground text-sm">
          Trade volume, joint ventures, and economic benefits
        </p>
      </FacetCardHeader>
      <FacetCardContent className="space-y-4 p-6 pt-0">
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
      </FacetCardContent>
    </FacetCard>
  );
}

export function IntelligenceDataTab({
  data,
  isOwner,
}: {
  data: SharedIntelligenceData[] | undefined;
  isOwner: boolean;
}) {
  if (!data || data.length === 0) return <EmptyState type="intelligence" />;

  return (
    <div className="space-y-4">
      {data.map((report, idx) => (
        <FacetCard surface="solid" key={idx} className="rounded-xl">
          <FacetCardHeader>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                  <Eye className="text-muted-foreground h-5 w-5" />
                  Intelligence Report - {report.reportType}
                </h3>
                <p className="text-muted-foreground text-sm">{report.summary}</p>
              </div>
              <Badge variant={report.classification === "PUBLIC" ? "default" : "secondary"}>
                {report.classification}
              </Badge>
            </div>
          </FacetCardHeader>
          <FacetCardContent className="space-y-4 p-6 pt-0">
            <div className="space-y-2">
              <div className="text-sm font-semibold">Key Findings:</div>
              <ul className="space-y-1">
                {report.keyFindings?.map((finding: string, i: number) => (
                  <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
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
          </FacetCardContent>
        </FacetCard>
      ))}
    </div>
  );
}

export function ResearchDataTab({ data }: { data: SharedResearchData[] | undefined }) {
  if (!data || data.length === 0) return <EmptyState type="research" />;

  return (
    <div className="space-y-4">
      {data.map((project, idx) => (
        <FacetCard surface="solid" key={idx} className="rounded-xl">
          <FacetCardHeader>
            <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
              <Beaker className="text-muted-foreground h-5 w-5" />
              {project.researchArea}
            </h3>
            <p className="text-muted-foreground text-sm">
              {project.collaborators?.length || 0} collaborator(s)
            </p>
          </FacetCardHeader>
          <FacetCardContent className="space-y-4 p-6 pt-0">
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
          </FacetCardContent>
        </FacetCard>
      ))}
    </div>
  );
}

export function CulturalDataTab({ data }: { data: SharedCulturalData | undefined }) {
  if (!data) return <EmptyState type="cultural" />;

  return (
    <FacetCard surface="solid" className="rounded-xl">
      <FacetCardHeader>
        <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
          <Palette className="text-muted-foreground h-5 w-5" />
          Cultural Exchange
        </h3>
        <p className="text-muted-foreground text-sm">Programs, events, and cultural impact</p>
      </FacetCardHeader>
      <FacetCardContent className="space-y-4 p-6 pt-0">
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
      </FacetCardContent>
    </FacetCard>
  );
}

export function PolicyDataTab({ data }: { data: SharedPolicyData[] | undefined }) {
  if (!data || data.length === 0) return <EmptyState type="policy" />;

  return (
    <div className="space-y-4">
      {data.map((policy, idx) => (
        <FacetCard surface="solid" key={idx} className="rounded-xl">
          <FacetCardHeader>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-foreground flex items-center gap-2 text-base font-semibold">
                  <FileText className="text-muted-foreground h-5 w-5" />
                  {policy.policyFramework}
                </h3>
                <p className="text-muted-foreground text-sm">{policy.agreementType} agreement</p>
              </div>
              <Badge variant={policy.status === "ratified" ? "default" : "secondary"}>
                {policy.status}
              </Badge>
            </div>
          </FacetCardHeader>
          <FacetCardContent className="space-y-4 p-6 pt-0">
            {policy.keyProvisions && (policy.keyProvisions as string[]).length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold">Key Provisions:</div>
                <ul className="space-y-1">
                  {(policy.keyProvisions as string[]).map((provision: string, i: number) => (
                    <li key={i} className="text-muted-foreground flex items-start gap-2 text-sm">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
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
          </FacetCardContent>
        </FacetCard>
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
