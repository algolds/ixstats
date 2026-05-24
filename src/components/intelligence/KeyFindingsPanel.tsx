"use client";

import {
  FileText,
  TrendingUp,
  TrendingDown,
  Shield,
  Globe,
  AlertTriangle,
  BarChart3,
  Send,
  Clock,
  Loader2,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { api } from "~/trpc/react";
import { TabHeroBanner } from "~/components/mycountry/primitives/TabHeroBanner";
import { IxTimeDate } from "~/components/ui/ix-time-date";

interface KeyFindingsPanelProps {
  countryId: string;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof Shield; color: string; bgColor: string }> = {
  economic: {
    icon: BarChart3,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
  },
  diplomatic: { icon: Globe, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/20" },
  security: { icon: Shield, color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950/20" },
  policy: { icon: Send, color: "text-indigo-600", bgColor: "bg-indigo-50 dark:bg-indigo-950/20" },
  network: { icon: Globe, color: "text-cyan-600", bgColor: "bg-cyan-50 dark:bg-cyan-950/20" },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; border: string }> = {
  info: {
    label: "Info",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    border: "border-blue-500/20",
  },
  warning: {
    label: "Warning",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    border: "border-amber-500/20",
  },
  critical: {
    label: "Critical",
    color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    border: "border-red-500/20",
  },
};

export function KeyFindingsPanel({ countryId }: KeyFindingsPanelProps) {
  const { data, isLoading } = api.unifiedIntelligence.getKeyFindings.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 60_000 }
  );

  return (
    <div className="space-y-4">
      <TabHeroBanner
        context="intel_forecasting"
        title="Key Findings"
        subtitle="Auto-generated intelligence from live data"
        icon={FileText}
        accentColor="indigo"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : !data || data.findings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-indigo-500/30 p-8 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-indigo-500/40" />
          <p className="text-muted-foreground text-sm">
            No key findings available yet. Findings are auto-generated from your country's live
            data.
          </p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            {(["info", "warning", "critical"] as const).map((sev) => {
              const count = data.findings.filter((f) => f.severity === sev).length;
              const cfg = SEVERITY_CONFIG[sev]!;
              return (
                <div
                  key={sev}
                  className={`glass-hierarchy-child rounded-lg p-2.5 ${cfg.border} border`}
                >
                  <span className="text-muted-foreground text-xs font-medium capitalize">
                    {cfg.label}
                  </span>
                  <div className="mt-0.5 text-lg font-bold">{count}</div>
                </div>
              );
            })}
          </div>

          {/* Findings list */}
          <div className="space-y-3">
            {data.findings.map((finding) => {
              const catCfg = CATEGORY_CONFIG[finding.category] ?? CATEGORY_CONFIG.economic!;
              const sevCfg = SEVERITY_CONFIG[finding.severity] ?? SEVERITY_CONFIG.info!;
              const CatIcon = catCfg.icon;

              return (
                <Card key={finding.id} className={`glass-hierarchy-child ${sevCfg.border} border`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg p-2 ${catCfg.bgColor} flex-shrink-0`}>
                        <CatIcon className={`h-4 w-4 ${catCfg.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{finding.title}</span>
                          <Badge className={`${sevCfg.color} px-1.5 py-0 text-[10px]`}>
                            {sevCfg.label}
                          </Badge>
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px] capitalize">
                            {finding.category}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                          {finding.description}
                        </p>
                        {finding.metric && (
                          <div className="mt-2 flex items-center gap-3">
                            <span className="text-sm font-bold">
                              {finding.metric.value.toLocaleString()}
                              {finding.metric.unit ? ` ${finding.metric.unit}` : ""}
                            </span>
                            {finding.metric.change !== 0 && (
                              <span
                                className={`flex items-center gap-0.5 text-xs font-medium ${finding.metric.change > 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {finding.metric.change > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {finding.metric.change > 0 ? "+" : ""}
                                {finding.metric.change.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Footer */}
          <div className="text-muted-foreground flex items-center justify-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span className="text-[11px]">
              Auto-generated from live data · Last updated{" "}
              <IxTimeDate date={data.generatedAt} format="datetime" accentColor="indigo" />
            </span>
          </div>
        </>
      )}
    </div>
  );
}
