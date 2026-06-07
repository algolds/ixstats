// @ts-nocheck
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, BarChart3, BookOpen, Settings } from "lucide-react";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { CommandPanel, type PanelStat } from "~/components/executive/CommandPanel";
import { CommandPanelItem } from "~/components/executive/CommandPanelItem";

// Lazy-load sub-panels for dialog sheets
const IntelligenceAnalysisPanel = dynamic(
  () => import("./IntelligenceAnalysisPanel").then((m) => ({ default: m.IntelligenceAnalysisPanel })),
  { ssr: false }
);
const KeyFindingsPanel = dynamic(
  () => import("./KeyFindingsPanel").then((m) => ({ default: m.KeyFindingsPanel })),
  { ssr: false }
);
const WikiArchivesPanel = dynamic(
  () => import("~/components/mycountry/intelligence/WikiArchivesPanel").then((m) => ({ default: m.WikiArchivesPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
        ))}
      </div>
    ),
  }
);
const AlertThresholdSettings = dynamic(
  () => import("~/app/mycountry/intelligence/_components/AlertThresholdSettings").then((m) => ({ default: m.AlertThresholdSettings })),
  { ssr: false }
);

interface IntelligenceWarRoomProps {
  countryId: string;
  countryName: string;
}

type SheetView = "alerts" | "analysis" | "archives" | "settings" | null;

const SEVERITY_COLORS: Record<string, string> = {
  critical: "red",
  high: "amber",
  medium: "blue",
  low: "slate",
  CRITICAL: "red",
  HIGH: "amber",
  MEDIUM: "blue",
  LOW: "slate",
};

const SEVERITY_BADGES = {
  critical: { label: "CRITICAL", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" },
  high: { label: "HIGH", colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  medium: { label: "MEDIUM", colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" },
  low: { label: "LOW", colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400" },
  CRITICAL: { label: "CRITICAL", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" },
  HIGH: { label: "HIGH", colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  MEDIUM: { label: "MEDIUM", colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400" },
  LOW: { label: "LOW", colorClass: "bg-slate-100 text-slate-600 dark:bg-slate-950/30 dark:text-slate-400" },
};

export function IntelligenceWarRoom({ countryId, countryName }: IntelligenceWarRoomProps) {
  const [activeSheet, setActiveSheet] = useState<SheetView>(null);

  // Queries
  const { data: intelligenceOverview } = api.intelCore.getOverview.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: embassies = [] } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Computed data
  const alerts = intelligenceOverview?.alerts?.items ?? [];
  const criticalCount = intelligenceOverview?.alerts?.critical ?? 0;
  const totalAlerts = intelligenceOverview?.alerts?.total ?? 0;

  const activeEmbassies = embassies.filter(
    (e: any) => e.status === "ACTIVE" || e.status === "active"
  ).length;

  const alertStats: PanelStat[] = [
    { label: "total", value: totalAlerts },
    ...(criticalCount > 0 ? [{ label: "critical", value: criticalCount }] : []),
  ];

  const analysisStats: PanelStat[] = [
    { label: "score", value: `${defenseOverview?.overallScore ?? 50}/100` },
    { label: "security", value: defenseOverview?.overallScore ?? 50 },
    { label: "embassies", value: activeEmbassies },
  ];

  const archiveStats: PanelStat[] = [
    { label: "archives", value: "active" },
  ];

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
        {/* ── ALERT CENTER ── */}
        <CommandPanel
          title="Alert Center"
          icon={AlertTriangle}
          accentColor="red"
          stats={alertStats}
          ctaLabel="Configure"
          onCta={() => setActiveSheet("settings")}
          footerLabel="View All Findings"
          onFooter={() => setActiveSheet("alerts")}
          totalCount={totalAlerts}
          emptyIcon={AlertTriangle}
          emptyTitle="No intelligence alerts"
          emptyDescription="Everything is currently clear. Custom security alert thresholds can be configured directly in settings."
        >
          {alerts.slice(0, 4).map((alert: any) => (
            <CommandPanelItem
              key={alert.id}
              accentColor={SEVERITY_COLORS[alert.severity] ?? "slate"}
              title={alert.title}
              subtitle={alert.category || "security"}
              badges={SEVERITY_BADGES[alert.severity] ? [SEVERITY_BADGES[alert.severity]] : []}
              trailingText={alert.deviation ? `${alert.deviation > 0 ? "+" : ""}${alert.deviation}%` : undefined}
              trailingColor={alert.severity === "CRITICAL" || alert.severity === "critical" ? "text-red-600" : undefined}
              pulse={alert.severity === "CRITICAL" || alert.severity === "critical"}
            />
          ))}
        </CommandPanel>

        {/* ── SECURITY ANALYSIS ── */}
        <CommandPanel
          title="Security Analysis"
          icon={BarChart3}
          accentColor="blue"
          stats={analysisStats}
          footerLabel="View Analysis Reports"
          onFooter={() => setActiveSheet("analysis")}
          totalCount={1}
          emptyIcon={BarChart3}
          emptyTitle="No analysis data"
          emptyDescription="Security and military assessments are generated dynamically."
        >
          <CommandPanelItem
            accentColor="green"
            title="Defense Condition"
            subtitle="Overall National Readiness"
            trailingText={`${defenseOverview?.overallScore ?? 50}/100`}
            trailingColor="text-emerald-500 font-semibold"
          />
          <CommandPanelItem
            accentColor="blue"
            title="Diplomatic Channels"
            subtitle="Active Embassy Operations"
            trailingText={`${activeEmbassies} active`}
            trailingColor="text-blue-500"
          />
          <CommandPanelItem
            accentColor="indigo"
            title="Military Strength"
            subtitle="Combined Forces Rating"
            trailingText={`${defenseOverview?.militaryStrength ?? 0}/100`}
            trailingColor="text-indigo-500"
          />
        </CommandPanel>

        {/* ── LORE & ARCHIVES ── */}
        <CommandPanel
          title="Lore & Archives"
          icon={BookOpen}
          accentColor="indigo"
          stats={archiveStats}
          footerLabel="Browse Full Archives"
          onFooter={() => setActiveSheet("archives")}
          totalCount={1}
          emptyIcon={BookOpen}
          emptyTitle="No archives"
          emptyDescription="Geopolitical historical database."
        >
          <div className="p-3 text-xs text-muted-foreground leading-relaxed">
            Access compiled media wiki articles, historical database registers, and counter-intelligence scanning archives for {countryName}.
          </div>
        </CommandPanel>
      </div>

      {/* ── Drill-Down Sheets ── */}
      <Dialog
        open={activeSheet === "settings"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Alert Threshold Settings
            </DialogTitle>
            <DialogDescription>
              Configure intelligence alert thresholds and notification preferences.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <AlertThresholdSettings countryId={countryId} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeSheet === "alerts"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>Key Findings & Alerts</DialogTitle>
            <DialogDescription>
              Detailed threat monitoring alerts and logs
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <KeyFindingsPanel countryId={countryId} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeSheet === "analysis"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-3xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>Security Analysis</DialogTitle>
            <DialogDescription>
              Detailed geopolitical reports and analytics
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <IntelligenceAnalysisPanel
              countryId={countryId}
              countryName={countryName}
              userId=""
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeSheet === "archives"}
        onOpenChange={(open) => !open && setActiveSheet(null)}
      >
        <DialogContent className="max-w-2xl" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <DialogHeader>
            <DialogTitle>Lore & Wiki Archives</DialogTitle>
            <DialogDescription>
              Geopolitical and historical registers
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <WikiArchivesPanel countryId={countryId} countryName={countryName} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
