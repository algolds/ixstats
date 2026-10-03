"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Check,
  Xmark as X,
  Clock,
  Page as FileText,
  StatUp as TrendingUp,
  WarningCircle as AlertCircle,
} from "iconoir-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "~/lib/utils";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Card } from "~/components/ui/card";

interface AutosaveHistoryPanelProps {
  countryId: string;
  isOpen?: boolean;
  onClose?: () => void;
}

interface StatProps {
  label: string;
  value: string | number | null | undefined;
  icon?: React.ReactNode;
  valueClassName?: string;
}

function Stat({ label, value, icon, valueClassName }: StatProps) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="space-y-1">
        <Eyebrow className="block">{label}</Eyebrow>
        <p className={cn("text-label text-title-1 tabular-nums", valueClassName)}>
          {value !== null && value !== undefined ? value : "-"}
        </p>
      </div>
      {icon && <div className="text-label-secondary">{icon}</div>}
    </div>
  );
}

interface AutosaveItemProps {
  autosave: {
    id: string;
    action: string;
    timestamp: Date;
    details: string | null;
    error: string | null;
  };
}

function AutosaveItem({ autosave }: AutosaveItemProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isSuccess = !autosave.action.includes("_FAILED");

  let parsedDetails: Record<string, unknown> = {};
  try {
    parsedDetails = autosave.details ? JSON.parse(autosave.details) : {};
  } catch (error) {
    console.error("Failed to parse autosave details:", error);
  }

  return (
    <Card className={cn("rounded-control p-4", !isSuccess && "border-destructive/40")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSuccess ? (
            <Check aria-label="Saved" className="text-green h-5 w-5" />
          ) : (
            <X aria-label="Failed" className="text-destructive h-5 w-5" />
          )}
          <div>
            <span className="text-label font-medium">{getSectionName(autosave.action)}</span>
            <div className="text-label-secondary text-body flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(autosave.timestamp))} ago</span>
            </div>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? "Hide" : "View"} Details
        </Button>
      </div>

      {showDetails && (
        <div className="border-separator mt-3 space-y-2 border-t pt-3">
          <div className="text-body">
            <p className="mb-2 font-medium">Changes:</p>
            <pre className="bg-fill-3 rounded-control-sm text-footnote max-h-48 overflow-auto p-2">
              {JSON.stringify(parsedDetails, null, 2)}
            </pre>
          </div>
          {autosave.error && (
            <div
              role="alert"
              className="border-destructive/30 text-destructive rounded-control-sm text-body border p-2"
            >
              <p className="font-medium">Error:</p>
              <p className="mt-1">{autosave.error}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function getSectionName(action: string): string {
  if (action.includes("IDENTITY")) return "National Identity";
  if (action.includes("GOVERNMENT")) return "Government";
  if (action.includes("TAX")) return "Tax System";
  if (action.includes("ECONOMY")) return "Economy";
  return "Unknown";
}

function getSectionFilter(section: string): string | undefined {
  if (section === "all") return undefined;
  return section.toUpperCase();
}

export function AutosaveHistoryPanel({
  countryId,
  isOpen = false,
  onClose,
}: AutosaveHistoryPanelProps) {
  const [selectedSection, setSelectedSection] = useState("all");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Fetch autosave stats
  const { data: stats, isLoading: statsLoading } = api.autosaveHistory.getAutosaveStats.useQuery(
    { countryId },
    { enabled: isOpen }
  );

  // Fetch autosave history with pagination
  const { data: historyData, isLoading: historyLoading } =
    api.autosaveHistory.getAutosaveHistory.useQuery(
      {
        countryId,
        limit,
        offset,
      },
      { enabled: isOpen }
    );

  // Filter autosaves by section on the client side
  const filteredAutosaves =
    selectedSection === "all"
      ? (historyData?.autosaves ?? [])
      : (historyData?.autosaves ?? []).filter((autosave) => {
          const sectionFilter = getSectionFilter(selectedSection);
          return sectionFilter ? autosave.action.includes(sectionFilter) : true;
        });

  const handleLoadMore = () => {
    setOffset((prev) => prev + limit);
  };

  const handleSectionChange = (section: string) => {
    setSelectedSection(section);
    setOffset(0); // Reset pagination when changing sections
  };

  const successRate =
    stats?.totalAutosaves && stats.totalAutosaves > 0
      ? Math.round((stats.successCount / stats.totalAutosaves) * 100)
      : 0;

  const lastSaveText = stats?.lastAutosave
    ? formatDistanceToNow(new Date(stats.lastAutosave)) + " ago"
    : "Never";

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent size="wide" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText aria-hidden="true" className="text-label-secondary h-5 w-5" />
            Autosave History
          </SheetTitle>
        </SheetHeader>

        {/* Summary stats */}
        <Card
          variant="inset"
          padding="none"
          className="divide-separator grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        >
          <Stat
            label="Total saves"
            value={stats?.totalAutosaves ?? 0}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <Stat
            label="Success rate"
            value={`${successRate}%`}
            icon={<Check className="h-5 w-5" />}
            valueClassName={
              successRate >= 90
                ? "text-green"
                : successRate >= 70
                  ? "text-yellow"
                  : "text-destructive"
            }
          />
          <Stat label="Last save" value={lastSaveText} icon={<Clock className="h-5 w-5" />} />
        </Card>

        {/* Section breakdown */}
        {stats && stats.totalAutosaves > 0 && (
          <div className="space-y-2">
            <h3 className="text-label text-headline">Section breakdown</h3>
            <dl className="border-separator divide-separator rounded-control text-body grid grid-cols-2 divide-x border sm:grid-cols-4">
              {[
                { label: "Identity", value: stats.sectionBreakdown.identity },
                { label: "Government", value: stats.sectionBreakdown.government },
                { label: "Tax", value: stats.sectionBreakdown.tax },
                { label: "Economy", value: stats.sectionBreakdown.economy },
              ].map((item) => (
                <div key={item.label} className="p-3">
                  <dt>
                    <Eyebrow>{item.label}</Eyebrow>
                  </dt>
                  <dd className="text-label text-title-3 tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Section filter */}
        <SegmentedControl
          aria-label="Section"
          size="sm"
          fullWidth
          options={[
            { value: "all", label: "All" },
            { value: "identity", label: "Identity" },
            { value: "government", label: "Government" },
            { value: "tax", label: "Tax" },
            { value: "economy", label: "Economy" },
          ]}
          value={selectedSection}
          onValueChange={handleSectionChange}
        />

        {/* Timeline */}
        <div className="space-y-3">
          {statsLoading || historyLoading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading autosave history">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredAutosaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="text-label-secondary mb-2 h-12 w-12" />
              <p className="text-label-secondary">
                {selectedSection === "all"
                  ? "No autosaves found"
                  : `No ${selectedSection} autosaves found`}
              </p>
            </div>
          ) : (
            filteredAutosaves.map((autosave) => (
              <AutosaveItem key={autosave.id} autosave={autosave} />
            ))
          )}
        </div>

        {/* Load More */}
        {historyData?.hasMore && selectedSection === "all" && (
          <div className="flex justify-center pt-2">
            <Button onClick={handleLoadMore} variant="outline" disabled={historyLoading}>
              {historyLoading ? "Loading…" : "Load More"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
