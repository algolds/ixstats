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
import { Progress } from "~/components/ui/progress";
import type {
  SharedCulturalData,
  SharedDataCollection,
  SharedEconomicData,
  SharedIntelligenceData,
  SharedPolicyData,
  SharedResearchData,
} from "~/types/diplomatic-network";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

export const DATA_TYPE_CONFIG = {
  economic: {
    icon: TrendingUp,
    label: "Economic",
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
  },
  intelligence: {
    icon: Eye,
    label: "Intelligence",
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
  },
  research: {
    icon: Beaker,
    label: "Research",
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
  },
  cultural: {
    icon: Palette,
    label: "Cultural",
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
  },
  policy: {
    icon: FileText,
    label: "Policy",
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
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
    <div className="bg-fill-3 rounded-control space-y-1 p-3">
      <div className="text-label-secondary text-footnote">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-label text-title-2 tabular-nums">{value}</div>
        {trend !== undefined && (
          <span className={cn("text-footnote", trend > 0 ? "text-green" : "text-destructive")}>
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        )}
        {positive && <CheckCircle className="text-green h-4 w-4" />}
      </div>
    </div>
  );
}

export function EmptyState({ type }: { type: string }) {
  const config = DATA_TYPE_CONFIG[type as keyof typeof DATA_TYPE_CONFIG];
  const Icon = config?.icon || AlertCircle;

  return (
    <div className="text-label-secondary py-8 text-center">
      <Icon className="mx-auto mb-3 h-6 w-6" />
      <p>No {config?.label || type} data shared yet</p>
    </div>
  );
}

export function EconomicDataTab({ data }: { data: SharedEconomicData | undefined }) {
  if (!data) return <EmptyState type="economic" />;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-label text-title-3 flex items-center gap-2">
          <TrendingUp className="text-label-secondary h-5 w-5" />
          Economic cooperation
        </h3>
        <p className="text-label-secondary text-body">
          Trade volume, joint ventures, and economic benefits
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-0">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <MetricCard
            label="Trade volume"
            value={`$${(data.tradeVolume || 0).toLocaleString()}M`}
            trend={data.tradeGrowth}
          />
          <MetricCard label="Joint ventures" value={data.jointVentures || 0} />
          <MetricCard
            label="Investment"
            value={`$${(data.investmentValue || 0).toLocaleString()}M`}
          />
          <MetricCard label="Tariffs reduced" value={`${data.tariffsReduced || 0}%`} positive />
          <MetricCard
            label="Economic benefit"
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
  data: SharedIntelligenceData[] | undefined;
  isOwner: boolean;
}) {
  if (!data || data.length === 0) return <EmptyState type="intelligence" />;

  return (
    <div className="space-y-4">
      {data.map((report, idx) => (
        <Card key={idx}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-label text-title-3 flex items-center gap-2">
                  <Eye className="text-label-secondary h-5 w-5" />
                  Intelligence Report - {report.reportType}
                </h3>
                <p className="text-label-secondary text-body">{report.summary}</p>
              </div>
              <Badge variant={report.classification === "PUBLIC" ? "secondary" : "default"}>
                {report.classification}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            <div className="space-y-2">
              <div className="text-headline">Key Findings:</div>
              <ul className="space-y-1">
                {report.keyFindings?.map((finding: string, i: number) => (
                  <li key={i} className="text-label-secondary text-body flex items-start gap-2">
                    <CheckCircle className="text-green mt-0.5 h-4 w-4 shrink-0" />
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-label-secondary text-footnote">
                Confidence: {report.confidence}%
              </div>
              <div className="text-label-secondary text-footnote">
                Updated: {new Date(report.lastUpdated).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ResearchDataTab({ data }: { data: SharedResearchData[] | undefined }) {
  if (!data || data.length === 0) return <EmptyState type="research" />;

  return (
    <div className="space-y-4">
      {data.map((project, idx) => (
        <Card key={idx}>
          <CardHeader>
            <h3 className="text-label text-title-3 flex items-center gap-2">
              <Beaker className="text-label-secondary h-5 w-5" />
              {project.researchArea}
            </h3>
            <p className="text-label-secondary text-body">
              {project.collaborators?.length || 0} collaborator(s)
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            <div className="space-y-2">
              <div className="text-body flex items-center justify-between">
                <span className="text-label-secondary">Progress</span>
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

export function CulturalDataTab({ data }: { data: SharedCulturalData | undefined }) {
  if (!data) return <EmptyState type="cultural" />;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-label text-title-3 flex items-center gap-2">
          <Palette className="text-label-secondary h-5 w-5" />
          Cultural exchange
        </h3>
        <p className="text-label-secondary text-body">Programs, events, and cultural impact</p>
      </CardHeader>
      <CardContent className="space-y-4 p-6 pt-0">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <MetricCard label="Exchange programs" value={data.exchangePrograms || 0} />
          <MetricCard label="Cultural events" value={data.culturalEvents || 0} />
          <MetricCard label="Artists exchanged" value={data.artistsExchanged || 0} />
          <MetricCard label="Students exchanged" value={data.studentsExchanged || 0} />
        </div>
        <div className="space-y-2 border-t pt-4">
          <div className="text-body flex items-center justify-between">
            <span className="text-label-secondary">Cultural impact</span>
            <span className="font-semibold">{data.culturalImpactScore || 0}%</span>
          </div>
          <Progress value={data.culturalImpactScore || 0} className="h-2" />
        </div>
        <div className="space-y-2">
          <div className="text-body flex items-center justify-between">
            <span className="text-label-secondary">Diplomatic goodwill</span>
            <span className="font-semibold">{data.diplomaticGoodwill || 0}%</span>
          </div>
          <Progress value={data.diplomaticGoodwill || 0} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PolicyDataTab({ data }: { data: SharedPolicyData[] | undefined }) {
  if (!data || data.length === 0) return <EmptyState type="policy" />;

  return (
    <div className="space-y-4">
      {data.map((policy, idx) => (
        <Card key={idx}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-label text-title-3 flex items-center gap-2">
                  <FileText className="text-label-secondary h-5 w-5" />
                  {policy.policyFramework}
                </h3>
                <p className="text-label-secondary text-body">{policy.agreementType} agreement</p>
              </div>
              <Badge variant={policy.status === "ratified" ? "secondary" : "default"}>
                {policy.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            {policy.keyProvisions && (policy.keyProvisions as string[]).length > 0 && (
              <div className="space-y-2">
                <div className="text-headline">Key Provisions:</div>
                <ul className="space-y-1">
                  {(policy.keyProvisions as string[]).map((provision: string, i: number) => (
                    <li key={i} className="text-label-secondary text-body flex items-start gap-2">
                      <CheckCircle className="text-green mt-0.5 h-4 w-4 shrink-0" />
                      <span>{provision}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-label-secondary text-footnote">
                Compliance: {policy.compliance}%
              </div>
              {policy.effectiveDate && (
                <div className="text-label-secondary text-footnote">
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
      <div className="text-label-secondary py-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No shared data available yet</p>
        {isOwner && (
          <p className="text-footnote mt-2">
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
      <div className="text-label-secondary py-8 text-center">
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
