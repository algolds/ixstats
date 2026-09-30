"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { FacetContainer } from "~/components/ui/facet-container";
import { FacetTabs } from "~/components/ui/facet";
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
        <p className={cn("text-foreground text-2xl font-semibold tabular-nums", valueClassName)}>
          {value !== null && value !== undefined ? value : "-"}
        </p>
      </div>
      {icon && <div className="text-muted-foreground">{icon}</div>}
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
    <FacetContainer
      depth={3}
      surface="solid"
      enableRefraction={false}
      className={cn("rounded-lg p-4", !isSuccess && "border-destructive/40")}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSuccess ? (
            <Check aria-label="Saved" className="h-5 w-5 text-emerald-600" />
          ) : (
            <X aria-label="Failed" className="text-destructive h-5 w-5" />
          )}
          <div>
            <span className="text-foreground font-medium">{getSectionName(autosave.action)}</span>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
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
        <div className="border-border/60 mt-3 space-y-2 border-t pt-3">
          <div className="text-sm">
            <p className="mb-2 font-medium">Changes:</p>
            <pre className="bg-muted max-h-48 overflow-auto rounded-md p-2 text-xs">
              {JSON.stringify(parsedDetails, null, 2)}
            </pre>
          </div>
          {autosave.error && (
            <div
              role="alert"
              className="border-destructive/30 text-destructive rounded-md border p-2 text-sm"
            >
              <p className="font-medium">Error:</p>
              <p className="mt-1">{autosave.error}</p>
            </div>
          )}
        </div>
      )}
    </FacetContainer>
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText aria-hidden="true" className="text-muted-foreground h-5 w-5" />
            Autosave History
          </DialogTitle>
        </DialogHeader>

        {/* Summary stats */}
        <FacetContainer
          depth={3}
          surface="solid"
          enableRefraction={false}
          className="divide-border/60 grid grid-cols-1 divide-y rounded-lg sm:grid-cols-3 sm:divide-x sm:divide-y-0"
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
                ? "text-emerald-600"
                : successRate >= 70
                  ? "text-amber-600"
                  : "text-destructive"
            }
          />
          <Stat label="Last save" value={lastSaveText} icon={<Clock className="h-5 w-5" />} />
        </FacetContainer>

        {/* Section breakdown */}
        {stats && stats.totalAutosaves > 0 && (
          <div className="space-y-2">
            <h3 className="text-foreground text-sm font-semibold">Section breakdown</h3>
            <dl className="border-border/60 divide-border/60 grid grid-cols-2 divide-x rounded-lg border text-sm sm:grid-cols-4">
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
                  <dd className="text-foreground text-lg font-semibold tabular-nums">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Section filter */}
        <FacetTabs
          size="sm"
          tone="neutral"
          className="w-full"
          tabs={[
            { id: "all", label: "All" },
            { id: "identity", label: "Identity" },
            { id: "government", label: "Government" },
            { id: "tax", label: "Tax" },
            { id: "economy", label: "Economy" },
          ]}
          activeTab={selectedSection}
          onChange={handleSectionChange}
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
              <AlertCircle className="text-muted-foreground mb-2 h-12 w-12" />
              <p className="text-muted-foreground">
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
      </DialogContent>
    </Dialog>
  );
}
